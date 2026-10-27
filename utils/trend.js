// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 单件资产的日均成本趋势：与 iOS / macOS 端 AssetCostTrend 同一套规则。
//
// App 不记录历史快照，趋势由购买日期推导（金额 ÷ 截至采样日的持有天数）。
// 因此按月采样时，短期持有只会得到 1 个点、画不出曲线，规则如下：
//   - 持有天数 ≤ 62 天（约两个月）：按天采样，新物品也能立刻看到下降曲线；
//   - 超过 62 天：按月采样，避免长期跨度产生过多点。

const date = require('./date.js')
const cost = require('./cost.js')

const DAILY_WINDOW_DAYS = 62
const MAX_MONTHLY_POINTS = 240

function granularity(days) {
  return days <= DAILY_WINDOW_DAYS ? 'daily' : 'monthly'
}

function costAsOf(asset, asOfDateStr) {
  const days = cost.holdingDays(asset.purchaseDate, asOfDateStr)
  const value = cost.dailyCost(asset.priceCents, days)
  return value === null ? 0 : value
}

function dailySeries(asset, referenceDateStr) {
  const points = []
  let day = asset.purchaseDate
  let guard = 0
  while (day <= referenceDateStr && guard <= DAILY_WINDOW_DAYS + 2) {
    points.push({ date: day, dailyCost: costAsOf(asset, day) })
    day = date.addDays(day, 1)
    guard += 1
  }
  // 购买日期晚于参考日期时（持有天数被钳为 1），至少给一个点，避免图表空白
  if (points.length === 0) {
    points.push({ date: asset.purchaseDate, dailyCost: costAsOf(asset, referenceDateStr) })
  }
  return points
}

function monthlySeries(asset, referenceDateStr) {
  const points = []
  let month = date.startOfMonth(asset.purchaseDate)
  let guard = 0
  while (month <= referenceDateStr && guard < MAX_MONTHLY_POINTS) {
    const monthEnd = date.endOfMonth(month)
    const effectiveEnd = monthEnd <= referenceDateStr ? monthEnd : referenceDateStr
    if (effectiveEnd >= asset.purchaseDate) {
      points.push({ date: month, dailyCost: costAsOf(asset, effectiveEnd) })
    }
    month = date.addMonths(month, 1)
    guard += 1
  }
  return points
}

/**
 * 生成趋势点。返回 [{ date: 'yyyy-MM-dd', dailyCost: number(分) }]，按日期升序。
 * 价格为 0 或非按天模式时返回空数组（此时 UI 应隐藏图表而不是画一条平线）。
 */
function series(asset, referenceDateStr) {
  if (!asset) return []
  if (!(asset.priceCents > 0)) return []
  if (asset.costMode !== 'perDay') return []
  const days = cost.holdingDays(asset.purchaseDate, referenceDateStr)
  return granularity(days) === 'daily'
    ? dailySeries(asset, referenceDateStr)
    : monthlySeries(asset, referenceDateStr)
}

module.exports = {
  DAILY_WINDOW_DAYS,
  granularity,
  series
}
