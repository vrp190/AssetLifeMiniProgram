// 偏好存储：默认排序的读写、非法值回落、清空数据不影响偏好。
module.exports = function (ctx) {
  const test = ctx.test
  const equal = ctx.equal
  const assert = ctx.assert
  const preferences = ctx.require('preferences.js')
  const storage = ctx.require('storage.js')
  const statistics = ctx.require('statistics.js')

  function make() {
    const adapter = storage.createMemoryStorage()
    return { adapter: adapter, prefs: preferences.createPreferences(adapter, {}) }
  }

  test('偏好：空存储时默认按购买日期排序', function () {
    const p = make()
    equal(p.prefs.defaultSort(), 'purchaseDateDesc', '默认排序')
  })

  test('偏好：写入后重新读取仍然生效', function () {
    const p = make()
    equal(p.prefs.setDefaultSort('dailyCostAsc'), 'dailyCostAsc', '返回值')
    const reopened = preferences.createPreferences(p.adapter, {})
    equal(reopened.defaultSort(), 'dailyCostAsc', '重开后读取')
    equal(reopened.load().defaultSort, 'dailyCostAsc', 'load 字段')
  })

  test('偏好：非法 key 被忽略且不覆盖已有值', function () {
    const p = make()
    p.prefs.setDefaultSort('priceDesc')
    equal(p.prefs.setDefaultSort('notARealSort'), 'priceDesc', '保持原值')
    equal(p.prefs.defaultSort(), 'priceDesc', '读取仍为原值')
  })

  test('偏好：存储内容损坏时回落到默认值', function () {
    const adapter = storage.createMemoryStorage()
    adapter.write(storage.SETTINGS_KEY, '{ broken json')
    equal(preferences.createPreferences(adapter, {}).defaultSort(), 'purchaseDateDesc', '损坏 JSON')
    adapter.write(storage.SETTINGS_KEY, JSON.stringify(['dailyCostAsc']))
    equal(preferences.createPreferences(adapter, {}).defaultSort(), 'purchaseDateDesc', '数组内容')
    adapter.write(storage.SETTINGS_KEY, JSON.stringify({ defaultSort: 42 }))
    equal(preferences.createPreferences(adapter, {}).defaultSort(), 'purchaseDateDesc', '类型错误')
  })

  test('偏好：与资产数据分 key 存放，清空数据不受影响', function () {
    const assets = ctx.require('repository.js').createRepository(storage.createMemoryStorage(), {})
    const p = make()
    p.prefs.setDefaultSort('nameAsc')
    assets.clear()
    equal(p.prefs.defaultSort(), 'nameAsc', '清空后偏好保留')
  })

  test('偏好：reset 恢复默认排序，但保留备份记录', function () {
    const p = make()
    p.prefs.setDefaultSort('recentlyUpdated')
    p.prefs.setLastBackupAt(1720000000000)
    equal(p.prefs.reset().defaultSort, 'purchaseDateDesc', 'reset 返回值')
    equal(p.prefs.defaultSort(), 'purchaseDateDesc', 'reset 后读取')
    equal(p.prefs.lastBackupAt(), 1720000000000, '备份时间保留')
  })

  test('偏好：备份时间默认 0，写入后可读回，非法值归零', function () {
    const p = make()
    equal(p.prefs.lastBackupAt(), 0, '默认未备份')
    equal(p.prefs.setLastBackupAt(1720000000000), 1720000000000, '写入返回')
    const reopened = preferences.createPreferences(p.adapter, {})
    equal(reopened.lastBackupAt(), 1720000000000, '重开后读取')
    equal(p.prefs.setLastBackupAt('not-a-number'), 0, '非法值归零')
    equal(p.prefs.setLastBackupAt(-5), 0, '负数归零')
  })

  test('备份提醒：从未备份 / 今天 / 30 天内 / 超期', function () {
    const backup = ctx.require('backup.js')
    const REF = '2024-06-15'
    function tsOf(dateStr) {
      return ctx.require('date.js').fromDateString(dateStr).getTime()
    }
    equal(backup.label(0, REF), { text: '尚未导出过备份', stale: true }, '从未备份')
    equal(backup.label(tsOf(REF), REF), { text: '上次导出：今天', stale: false }, '今天')
    equal(backup.label(tsOf('2024-06-12'), REF), { text: '上次导出：3 天前', stale: false }, '3 天前')
    equal(backup.label(tsOf('2024-05-16'), REF), { text: '上次导出：30 天前，建议尽快备份', stale: true }, '刚好 30 天')
    equal(backup.label(tsOf('2024-04-01'), REF).stale, true, '远超过期')
  })

  test('排序索引：key 与 picker 索引互相对应', function () {
    equal(statistics.sortIndex('purchaseDateDesc'), 0, '首项')
    equal(statistics.sortIndex('dailyCostAsc'), statistics.SORT_OPTIONS.length - 1, '末项')
    equal(statistics.sortIndex('unknown'), 0, '未知 key 回落')
    statistics.SORT_OPTIONS.forEach(function (option, index) {
      assert(statistics.sortIndex(option.key) === index, option.key + ' 索引应为 ' + index)
    })
  })
}
