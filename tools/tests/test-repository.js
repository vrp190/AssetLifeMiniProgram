// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 仓库 CRUD 与持久化：用内存存储适配层完整测试。
module.exports = function (ctx) {
  const repository = ctx.require('repository.js')
  const storage = ctx.require('storage.js')
  const test = ctx.test
  const equal = ctx.equal
  const assert = ctx.assert

  const NOW = 1718409600000

  function makeRepo(initial) {
    const adapter = storage.createMemoryStorage(initial)
    let tick = 0
    return {
      adapter: adapter,
      repo: repository.createRepository(adapter, {
        now: function () { return NOW + (tick++) * 1000 }
      })
    }
  }

  function asset(name, yuan, purchaseDate, kind) {
    return {
      name: name,
      priceCents: yuan * 100,
      purchaseDate: purchaseDate,
      kind: kind || 'asset'
    }
  }

  test('新增后可查询，按购买日期降序', function () {
    const env = makeRepo()
    env.repo.add(asset('A', 100, '2024-06-01'))
    env.repo.add(asset('B', 200, '2024-06-10'))
    env.repo.add(asset('C', 300, '2024-05-01'))
    const all = env.repo.all()
    equal(all.length, 3, '数量')
    equal(all[0].name, 'B', '最新购买在前')
    equal(all[2].name, 'C', '最早在后')
  })

  test('byId 找到 / 找不到', function () {
    const env = makeRepo()
    const created = env.repo.add(asset('A', 100, '2024-06-01'))
    assert(env.repo.byId(created.id) !== null, '应找到')
    equal(env.repo.byId('nope'), null, '找不到')
  })

  test('更新保留 id 与 createdAt、刷新 updatedAt', function () {
    const env = makeRepo()
    const created = env.repo.add(asset('A', 100, '2024-06-01'))
    const updated = env.repo.update({ id: created.id, name: 'A2', priceCents: 20000 })
    equal(updated.id, created.id, 'id 不变')
    equal(updated.createdAt, created.createdAt, 'createdAt 不变')
    assert(updated.updatedAt > created.updatedAt, 'updatedAt 刷新')
    equal(updated.priceCents, 20000, '新价格')
  })

  test('删除', function () {
    const env = makeRepo()
    const created = env.repo.add(asset('A', 100, '2024-06-01'))
    equal(env.repo.remove(created.id), true, '删除成功')
    equal(env.repo.remove(created.id), false, '重复删除 false')
    equal(env.repo.count(), 0, '清空')
  })

  test('byKind 过滤心愿', function () {
    const env = makeRepo()
    env.repo.add(asset('A', 100, '2024-06-01'))
    env.repo.add(asset('W', 200, '2024-06-02', 'wishlist'))
    equal(env.repo.byKind('asset').length, 1, '资产')
    equal(env.repo.byKind('wishlist').length, 1, '心愿')
  })

  test('演示数据只写一次，可定向清除', function () {
    const env = makeRepo()
    const first = env.repo.insertDemo('2024-06-15')
    equal(first, 10, '7 资产 + 3 心愿')
    equal(env.repo.insertDemo('2024-06-15'), 0, '重复写入返回 0')
    env.repo.add(asset('我的', 100, '2024-06-01'))
    equal(env.repo.count(), 11, '共 11 条')
    const removed = env.repo.removeDemo()
    equal(removed, 10, '清除 10 条演示')
    equal(env.repo.count(), 1, '剩自己的 1 条')
  })

  test('持久化：数据写入存储适配层', function () {
    const env = makeRepo()
    env.repo.add(asset('A', 100, '2024-06-01'))
    const raw = env.adapter.read(storage.STORAGE_KEY)
    assert(typeof raw === 'string', '应写为 JSON 字符串')
    const parsed = JSON.parse(raw)
    equal(parsed.length, 1, '一条')
    equal(parsed[0].name, 'A', '名称')
  })

  test('启动时从存储恢复', function () {
    const env = makeRepo()
    env.repo.add(asset('A', 100, '2024-06-01'))
    // 用同一个 adapter 建第二个仓库，模拟重启
    const repo2 = repository.createRepository(env.adapter, { now: function () { return NOW } })
    equal(repo2.count(), 1, '恢复一条')
    equal(repo2.all()[0].name, 'A', '名称一致')
  })

  test('存储内容损坏时按空数据处理', function () {
    const adapter = storage.createMemoryStorage()
    adapter.write(storage.STORAGE_KEY, '{broken json')
    const repo = repository.createRepository(adapter, { now: function () { return NOW } })
    equal(repo.count(), 0, '不崩溃且为空')
  })

  test('replaceAll 全量替换（导入）', function () {
    const env = makeRepo()
    env.repo.add(asset('旧', 100, '2024-06-01'))
    env.repo.replaceAll([asset('新1', 200, '2024-06-02'), asset('新2', 300, '2024-06-03')])
    equal(env.repo.count(), 2, '替换后数量')
    equal(env.repo.all()[0].name, '新2', '新数据')
  })

  test('清空', function () {
    const env = makeRepo()
    env.repo.add(asset('A', 100, '2024-06-01'))
    env.repo.clear()
    equal(env.repo.count(), 0, '清空后为 0')
  })

  test('脏数据自动规范化（未知状态回退默认值）', function () {
    const adapter = storage.createMemoryStorage({
      assetlife: JSON.stringify([{ name: 'X', priceCents: 100, purchaseDate: '2024-06-01', status: 'hacker', kind: 'alien', costMode: 'yolo' }])
    })
    const repo = repository.createRepository(adapter, {
      key: 'assetlife',
      now: function () { return NOW }
    })
    const all = repo.all()
    equal(all.length, 1, '数量')
    equal(all[0].status, 'inUse', '状态回退')
    equal(all[0].kind, 'asset', '类型回退')
    equal(all[0].costMode, 'perDay', '模式回退')
  })
}
