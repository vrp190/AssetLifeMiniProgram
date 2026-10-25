// 成本计算：与 iOS / macOS 端 CostCalculator 完全相同的口径，纯函数、无副作用。
//
// 口径说明：
//   - 持有天数按自然日计算，购买当天记为第 1 天；
//   - 未来购买日期同样钳为 1 天，不产生负值；
//   - 输入金额单位为「分」，输出成本单位也是「分」（除法结果保留浮点）。

const date = require('./date.js')

/** 持有天数：自然日差 + 1，至少 1 天。 */
function holdingDays(purchaseDateStr, referenceDateStr) {
  return date.holdingDays(purchaseDateStr, referenceDateStr)
}

/** 日均成本 = 购入价 ÷ 持有天数。价格为负或天数 < 1 视为无效输入。 */
function dailyCost(priceCents, days) {
  if (typeof priceCents !== 'number' || !isFinite(priceCents)) return null
  if (priceCents < 0 || days < 1) return null
  return priceCents / days
}

/** 单次成本 = 购入价 ÷ 使用次数。 */
function perUseCost(priceCents, useCount) {
  if (typeof priceCents !== 'number' || !isFinite(priceCents)) return null
  if (priceCents < 0 || useCount < 1) return null
  return priceCents / useCount
}

/** 求和（跳过 null）。 */
function sum(values) {
  let total = 0
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (typeof value === 'number' && isFinite(value)) total += value
  }
  return total
}

/**
 * 当前成本模式下「有效的每日成本」：
 *   perDay  -> 日均成本
 *   perUse  -> 单次成本
 *   custom  -> 自定义金额（targetValueCents）
 * 不可计算时返回 null。
 */
function effectiveDailyCost(asset, referenceDateStr) {
  if (!asset) return null
  if (asset.costMode === 'perDay') {
    return dailyCost(asset.priceCents, holdingDays(asset.purchaseDate, referenceDateStr))
  }
  if (asset.costMode === 'perUse') {
    return perUseCost(asset.priceCents, asset.useCount)
  }
  if (asset.costMode === 'custom') {
    return typeof asset.targetValueCents === 'number' ? asset.targetValueCents : null
  }
  return null
}

/**
 * 目标日均成本：
 *   none   -> null
 *   custom -> targetValueCents
 *   byDate -> price ÷ (购买日 到 目标日 的持有天数)
 */
function resolvedTargetDailyCost(asset) {
  if (!asset) return null
  if (asset.targetMode === 'custom') {
    return typeof asset.targetValueCents === 'number' ? asset.targetValueCents : null
  }
  if (asset.targetMode === 'byDate') {
    if (!asset.targetDate) return null
    const days = holdingDays(asset.purchaseDate, asset.targetDate)
    return dailyCost(asset.priceCents, days)
  }
  return null
}

module.exports = {
  holdingDays,
  dailyCost,
  perUseCost,
  sum,
  effectiveDailyCost,
  resolvedTargetDailyCost
}
