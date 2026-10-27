// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 趋势采样：口径对齐 iOS 端 CostTrendTests。
module.exports = function (ctx) {
  const trend = ctx.require('trend.js')
  const money = ctx.require('money.js')
  const model = ctx.require('model.js')
  const test = ctx.test
  const equal = ctx.equal
  const approx = ctx.approx
  const assert = ctx.assert

  const REF = '2024-06-15'

  function asset(purchaseDate, yuan, extra) {
    return model.createAsset(Object.assign({
      name: '测试',
      priceCents: Math.round(yuan * 100),
      purchaseDate: purchaseDate,
      costMode: 'perDay',
      now: 1718409600000
    }, extra || {}))
  }

  test('同月持有 15 天 → 15 个点，首点 = 购入价', function () {
    const points = trend.series(asset('2024-06-01', 1200), REF)
    equal(points.length, 15, '点数')
    approx(points[0].dailyCost / 100, 1200, '首点', 0.01)
    approx(points[14].dailyCost / 100, 1200 / 15, '末点', 0.01)
  })

  test('逐日单调下降', function () {
    const points = trend.series(asset('2024-06-01', 1200), REF)
    for (let i = 1; i < points.length; i++) {
      assert(points[i].dailyCost < points[i - 1].dailyCost, '第 ' + i + ' 点应下降')
    }
  })

  test('日期升序', function () {
    const points = trend.series(asset('2024-06-01', 1200), REF)
    for (let i = 1; i < points.length; i++) {
      assert(points[i].date > points[i - 1].date, '日期应递增')
    }
  })

  test('当天购买 → 单点（持有 1 天）', function () {
    const points = trend.series(asset('2024-06-15', 300), REF)
    equal(points.length, 1, '点数')
    approx(points[0].dailyCost / 100, 300, '值', 0.01)
    equal(points[0].date, '2024-06-15', '日期')
  })

  test('购买日期在未来 → 至少 1 个点（钳为 1 天）', function () {
    const points = trend.series(asset('2024-06-20', 300), REF)
    equal(points.length, 1, '点数')
    approx(points[0].dailyCost / 100, 300, '值', 0.01)
  })

  test('按次模式无趋势序列', function () {
    equal(trend.series(asset('2024-06-01', 1200, { costMode: 'perUse', useCount: 10 }), REF).length, 0, 'perUse')
  })

  test('自定义模式无趋势序列', function () {
    equal(trend.series(asset('2024-06-01', 1200, { costMode: 'custom', targetValueCents: 100 }), REF).length, 0, 'custom')
  })

  test('价格为 0 无趋势序列', function () {
    equal(trend.series(asset('2024-06-01', 0), REF).length, 0, '零价')
  })

  test('持有 63 天 → 切换为按月采样', function () {
    // 2024-03-15 → 2024-06-15 = 93 天（>62）
    const points = trend.series(asset('2024-03-15', 9300), REF)
    equal(points.length, 4, '月数（3/4/5/6 月）')
    equal(points[0].date, '2024-03-01', '首点月初')
    equal(points[3].date, '2024-06-01', '末点月初')
  })

  test('跨年按月对齐每月 1 号，共 13 点', function () {
    const points = trend.series(asset('2023-06-15', 7300), REF)
    equal(points.length, 13, '月数')
    equal(points[0].date, '2023-06-01', '首点')
    equal(points[12].date, '2024-06-01', '末点')
    // 末点 = 截至 2024-06-15 的日均
    const last = points[12].dailyCost / 100
    approx(last, 7300 / (ctx.require('date.js').holdingDays('2023-06-15', '2024-06-15')), '末点值', 0.01)
  })

  test('月度序列同样单调下降', function () {
    const points = trend.series(asset('2023-06-15', 7300), REF)
    for (let i = 1; i < points.length; i++) {
      assert(points[i].dailyCost < points[i - 1].dailyCost, '第 ' + i + ' 月应下降')
    }
  })

  test('粒度阈值：62 天按天、63 天按月', function () {
    equal(trend.granularity(62), 'daily', '62')
    equal(trend.granularity(63), 'monthly', '63')
  })
}
