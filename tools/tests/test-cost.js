// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 成本算法与金额格式化：口径对齐 iOS 端 CostCalculatorTests。
module.exports = function (ctx) {
  const cost = ctx.require('cost.js')
  const money = ctx.require('money.js')
  const model = ctx.require('model.js')
  const test = ctx.test
  const equal = ctx.equal
  const approx = ctx.approx
  const assert = ctx.assert

  // ---------- 持有天数 ----------
  test('购买当天持有 1 天', function () {
    equal(cost.holdingDays('2024-06-15', '2024-06-15'), 1, '当天')
  })
  test('次日持有 2 天', function () {
    equal(cost.holdingDays('2024-06-15', '2024-06-16'), 2, '次日')
  })
  test('未来购买日期钳为 1 天', function () {
    equal(cost.holdingDays('2024-06-20', '2024-06-15'), 1, '未来')
  })
  test('跨月天数', function () {
    equal(cost.holdingDays('2024-05-31', '2024-06-02'), 3, '跨月')
  })
  test('跨年天数', function () {
    equal(cost.holdingDays('2023-12-31', '2024-01-01'), 2, '跨年')
  })
  test('闰年 2 月（2024-02-28 → 03-01 为 3 天）', function () {
    equal(cost.holdingDays('2024-02-28', '2024-03-01'), 3, '闰月')
  })

  // ---------- 日均 / 单次成本（单位：分） ----------
  test('日均 = 9499 元 ÷ 426 天 ≈ 22.30 元', function () {
    const cents = cost.dailyCost(949900, 426)
    approx(money.round(cents / 100), 22.3, '日均')
  })
  test('价格为 0 时日均 = 0', function () {
    equal(cost.dailyCost(0, 100), 0, '零价')
  })
  test('负价格无效 → null', function () {
    equal(cost.dailyCost(-100, 10), null, '负价')
  })
  test('天数为 0 无效 → null', function () {
    equal(cost.dailyCost(100, 0), null, '零天')
  })
  test('单次 = 598 元 ÷ 512 次 ≈ 1.17 元', function () {
    const cents = cost.perUseCost(59800, 512)
    approx(money.round(cents / 100), 1.17, '单次')
  })
  test('次数不足 1 → null', function () {
    equal(cost.perUseCost(100, 0), null, '零次')
  })

  // ---------- 有效每日成本 ----------
  function make(costMode, extra) {
    return model.createAsset(Object.assign({
      name: '测试',
      priceCents: 949900,
      purchaseDate: '2024-06-15',
      costMode: costMode,
      now: 1718409600000
    }, extra || {}))
  }
  test('perDay 模式取日均', function () {
    const asset = make('perDay')
    approx(cost.effectiveDailyCost(asset, '2024-06-16') / 100, 9499 / 2, 'perDay')
  })
  test('perUse 模式取单次', function () {
    const asset = make('perUse', { useCount: 500 })
    approx(cost.effectiveDailyCost(asset, '2024-06-16') / 100, 9499 / 500, 'perUse')
  })
  test('custom 模式取自定义金额', function () {
    const asset = make('custom', { targetValueCents: 250 })
    equal(cost.effectiveDailyCost(asset, '2024-06-16'), 250, 'custom')
  })
  test('custom 未填金额 → null', function () {
    const asset = make('custom', { targetValueCents: null })
    equal(cost.effectiveDailyCost(asset, '2024-06-16'), null, 'custom 空')
  })

  // ---------- 目标日均 ----------
  test('byDate 目标日均 = 价格 ÷ 到目标日的持有天数', function () {
    const asset = make('perDay', { targetMode: 'byDate', targetDate: '2025-06-15' })
    // 2024-06-15 → 2025-06-15 自然日差 365，持有 366 天
    approx(cost.resolvedTargetDailyCost(asset) / 100, 949900 / 366 / 100, 'byDate', 0.01)
  })
  test('target none → null', function () {
    equal(cost.resolvedTargetDailyCost(make('perDay')), null, 'none')
  })

  // ---------- 金额解析 / 格式化 ----------
  test('金额解析容忍货币符号与千分位', function () {
    equal(money.parseMoney('¥2,180.50'), 2180.5, '半角')
  })
  test('金额解析容忍全角符号与全角逗号', function () {
    equal(money.parseMoney('￥2，180'), 2180, '全角')
  })
  test('非法金额返回 null', function () {
    equal(money.parseMoney('abc'), null, '字母')
    equal(money.parseMoney(''), null, '空串')
    equal(money.parseMoney('1.2.3'), null, '多点')
  })
  test('元转分四舍五入', function () {
    equal(money.yuanToCents(9499), 949900, '整数元')
    equal(money.yuanToCents(0.1), 10, '一角')
  })
  test('格式化带千分位两位小数', function () {
    equal(money.formatMoney(949900), '¥9,499.00', '正数')
    equal(money.formatMoney(116.8), '¥1.17', '分转元')
  })
  test('导出字符串精度', function () {
    equal(money.centsToYuanString(949900), '9499.00', '导出')
    equal(money.centsFromYuanString('9499'), 949900, '导入')
  })
  test('空值显示为 —', function () {
    equal(money.formatMoney(null), '—', 'null')
  })
  assert(true, '占位')
}
