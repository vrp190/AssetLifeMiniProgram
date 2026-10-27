// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 统计与查询：口径对齐 iOS 端 AssetListViewModelTests。
module.exports = function (ctx) {
  const statistics = ctx.require('statistics.js')
  const model = ctx.require('model.js')
  const money = ctx.require('money.js')
  const test = ctx.test
  const equal = ctx.equal
  const approx = ctx.approx
  const assert = ctx.assert

  const REF = '2024-06-15'

  function make(name, yuan, days, status, kind, extra) {
    const opts = extra || {}
    return model.createAsset(Object.assign({
      name: name,
      priceCents: Math.round(yuan * 100),
      purchaseDate: ctx.require('date.js').addDays(REF, -days),
      status: status || 'inUse',
      kind: kind || 'asset',
      category: opts.category || '其他',
      now: 1718409600000
    }, opts))
  }

  function fixture() {
    return [
      make('MacBook', 9499, 426, 'inUse', 'asset', { category: '数码' }),
      make('椅子', 2180, 365, 'inUse', 'asset', { category: '家具' }),
      make('键盘', 598, 233, 'inUse', 'asset', { costMode: 'perUse', useCount: 512, category: '数码' }),
      make('咖啡机', 1299, 96, 'inUse', 'asset', { category: '厨具' }),
      make('降噪耳机', 1899, 540, 'retired', 'asset', { category: '数码' }),
      make('旧显示器', 1599, 700, 'sold', 'asset', { category: '数码' }),
      make('相机', 15800, 62, 'inUse', 'wishlist')
    ]
  }

  function real(list) {
    // 与页面一致：visibleAssets 的入参已经过 kind 过滤（心愿不进入资产列表）
    return list.filter(function (item) { return item.kind === 'asset' })
  }

  test('汇总只统计正式资产（心愿排除）', function () {
    const summary = statistics.summary(fixture(), REF)
    equal(summary.totalCount, 6, '件数')
    equal(summary.inUseCount, 4, '使用中')
    equal(summary.retiredCount, 1, '已退役')
    equal(summary.soldCount, 1, '已卖出')
  })

  test('资产总额含已卖出、日均合计不含', function () {
    const summary = statistics.summary(fixture(), REF)
    equal(summary.totalPurchaseCost, (9499 + 2180 + 598 + 1299 + 1899 + 1599) * 100, '总额')
    // sold 的旧显示器不计入日均
    const sold = make('sold-only', 1000, 100, 'sold')
    const only = statistics.summary([sold], REF)
    equal(only.totalDailyCost, 0, '已卖出不计日均')
    equal(only.totalPurchaseCost, 100000, '但计入总额')
  })

  test('日均合计 = 各件有效成本之和', function () {
    const summary = statistics.summary(fixture(), REF)
    const manual =
      949900 / (426 + 1) +
      218000 / (365 + 1) +
      59800 / 512 +
      129900 / (96 + 1) +
      189900 / (540 + 1)
    approx(summary.totalDailyCost, manual, '求和', 0.5)
  })

  test('心愿预算统计', function () {
    const wish = statistics.wishlistSummary(fixture())
    equal(wish.count, 1, '件数')
    equal(wish.budget, 1580000, '预算')
  })

  test('搜索命中名称 / 分类 / 标签', function () {
    const list = fixture()
    equal(statistics.visibleAssets(real(list), { searchText: 'mac' }, REF).length, 1, '名称')
    equal(statistics.visibleAssets(real(list), { searchText: '键盘' }, REF).length, 1, '名称中文')
    assert(statistics.visibleAssets(real(list), { searchText: '苹果' }, REF).length === 0, '无标签命中为 0')
    equal(statistics.visibleAssets(real(list), { searchText: '   ' }, REF).length, 6, '空白不筛选')
  })

  test('状态筛选', function () {
    equal(statistics.visibleAssets(real(fixture()), { statusFilter: 'sold' }, REF).length, 1, 'sold')
    equal(statistics.visibleAssets(real(fixture()), { statusFilter: 'inUse' }, REF).length, 4, 'inUse')
  })

  test('价格排序（降序）', function () {
    const sorted = statistics.visibleAssets(real(fixture()), { sort: 'priceDesc' }, REF)
    for (let i = 1; i < sorted.length; i++) {
      assert(sorted[i - 1].priceCents >= sorted[i].priceCents, '应降序')
    }
  })

  test('日均成本排序（升序，最便宜的在前）', function () {
    const sorted = statistics.visibleAssets(real(fixture()), { sort: 'dailyCostAsc' }, REF)
    // 键盘按次：59800/512 ≈ 1.17 元/次，最低
    approx(sorted[0].priceCents / 100, 598, '最低为键盘', 0.01)
  })

  test('名称排序', function () {
    const sorted = statistics.visibleAssets(real(fixture()), { sort: 'nameAsc' }, REF)
    equal(sorted.length, 6, '数量')
  })

  test('月度序列：12 个月、当月购入、累计', function () {
    const points = statistics.monthlyPoints(fixture(), 12, REF)
    equal(points.length, 12, '月数')
    // 最后一个点是 2024-06：当月无购入
    equal(points[11].monthlyPurchase, 0, '当月购入 0')
    // 12 个月窗口（2023-07 ~ 2024-06）内购入的只有键盘（2023-10）与咖啡机（2024-03）；
    // 更早的（MacBook/椅子/耳机/显示器）在窗口外，不计入窗口内累计
    equal(points[11].cumulativePurchase, (598 + 1299) * 100, '窗口内累计')
    // 窗口内第一天的累计从 0 开始
    equal(points[0].cumulativePurchase, points[0].monthlyPurchase, '起点累计')
  })

  test('分类分布按金额降序', function () {
    const rows = statistics.categoryBreakdown(fixture())
    equal(rows[0].category, '数码', '最大分类')
    equal(rows[0].count, 4, '数码 4 件')
    for (let i = 1; i < rows.length; i++) {
      assert(rows[i - 1].total >= rows[i].total, '应降序')
    }
  })

  test('状态分布固定三项', function () {
    const rows = statistics.statusBreakdown(fixture())
    equal(rows.length, 3, '三项')
    equal(rows[0].count, 4, 'inUse')
  })

  test('日均排行不含已卖出与心愿', function () {
    const rows = statistics.dailyCostRanking(fixture(), REF, 8)
    rows.forEach(function (row) {
      assert(row.name !== '旧显示器', '不含已卖出')
      assert(row.name !== '相机', '不含心愿')
    })
  })

  test('空列表不崩溃', function () {
    const summary = statistics.summary([], REF)
    equal(summary.totalCount, 0, '件数')
    equal(statistics.monthlyPoints([], 12, REF).length, 12, '月度仍 12 点')
  })
}
