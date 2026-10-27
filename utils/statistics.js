// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 列表 / 趋势页的统计与查询逻辑：与 iOS 端 AssetListViewModel、TrendsViewModel 同口径。

const cost = require('./cost.js')
const model = require('./model.js')
const categories = require('./categories.js')
const date = require('./date.js')

const SORT_OPTIONS = [
  { key: 'purchaseDateDesc', title: '购买日期（最新）' },
  { key: 'recentlyUpdated', title: '最近更新' },
  { key: 'nameAsc', title: '名称 A→Z' },
  { key: 'priceDesc', title: '价格（最高）' },
  { key: 'dailyCostAsc', title: '日均成本（最低）' }
]

function sortTitles() {
  return SORT_OPTIONS.map(function (item) { return item.title })
}

function sortKey(title) {
  for (let i = 0; i < SORT_OPTIONS.length; i++) {
    if (SORT_OPTIONS[i].title === title) return SORT_OPTIONS[i].key
  }
  return 'purchaseDateDesc'
}

/** 排序 key → picker 索引；未知 key 回落到第一项。 */
function sortIndex(key) {
  for (let i = 0; i < SORT_OPTIONS.length; i++) {
    if (SORT_OPTIONS[i].key === key) return i
  }
  return 0
}

/**
 * 总览统计（只统计 kind === 'asset'）。
 *   totalCount        —— 正式资产件数（含已卖出）
 *   totalPurchaseCost —— 购入成本总和（含已卖出/已退役，不含心愿）
 *   totalDailyCost    —— 使用中 + 已退役资产的日均成本之和（不含已卖出、不含心愿）
 */
function summary(assets, referenceDateStr) {
  const list = (assets || []).filter(function (item) { return item.kind === 'asset' })
  const result = {
    totalCount: list.length,
    inUseCount: 0,
    retiredCount: 0,
    soldCount: 0,
    totalPurchaseCost: 0,
    totalDailyCost: 0
  }
  list.forEach(function (item) {
    if (item.status === 'inUse') result.inUseCount += 1
    if (item.status === 'retired') result.retiredCount += 1
    if (item.status === 'sold') result.soldCount += 1
    result.totalPurchaseCost += item.priceCents
  })
  const held = list.filter(function (item) {
    return item.status === 'inUse' || item.status === 'retired'
  })
  result.totalDailyCost = cost.sum(held.map(function (item) {
    return cost.effectiveDailyCost(item, referenceDateStr)
  }))
  return result
}

/** 心愿统计：{ count, budget }。 */
function wishlistSummary(assets) {
  const wishes = (assets || []).filter(function (item) { return item.kind === 'wishlist' })
  return {
    count: wishes.length,
    budget: cost.sum(wishes.map(function (item) { return item.priceCents }))
  }
}

function sortAssets(assets, option, referenceDateStr) {
  const list = (assets || []).slice()
  if (option === 'recentlyUpdated') {
    return list.sort(function (a, b) { return b.updatedAt - a.updatedAt })
  }
  if (option === 'nameAsc') {
    return list.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN')
    })
  }
  if (option === 'priceDesc') {
    return list.sort(function (a, b) { return b.priceCents - a.priceCents })
  }
  if (option === 'dailyCostAsc') {
    return list.sort(function (a, b) {
      const left = cost.effectiveDailyCost(a, referenceDateStr)
      const right = cost.effectiveDailyCost(b, referenceDateStr)
      const lv = left === null ? Number.MAX_SAFE_INTEGER : left
      const rv = right === null ? Number.MAX_SAFE_INTEGER : right
      if (lv === rv) return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN')
      return lv - rv
    })
  }
  // 默认 purchaseDateDesc：日期降序，同日按更新时间降序
  return list.sort(function (a, b) {
    if (a.purchaseDate === b.purchaseDate) return b.updatedAt - a.updatedAt
    return a.purchaseDate < b.purchaseDate ? 1 : -1
  })
}

/**
 * 筛选 + 搜索 + 排序后的可见列表。
 * @param {Object} options { searchText, statusFilter, sort }
 */
function visibleAssets(assets, options, referenceDateStr) {
  const opts = options || {}
  let list = (assets || []).slice()
  if (opts.statusFilter) {
    list = list.filter(function (item) { return item.status === opts.statusFilter })
  }
  if (String(opts.searchText || '').trim()) {
    list = list.filter(function (item) { return model.matchesSearch(item, opts.searchText) })
  }
  return sortAssets(list, opts.sort || 'purchaseDateDesc', referenceDateStr)
}

/**
 * 最近 months 个月序列（含当月），返回：
 *   [{ monthStart, monthlyPurchase, cumulativePurchase, dailyCostAsOf }]
 */
function monthlyPoints(assets, months, referenceDateStr) {
  const list = (assets || []).filter(function (item) { return item.kind === 'asset' })
  const count = months > 0 ? months : 12
  const starts = date.recentMonthStarts(referenceDateStr, count)
  let cumulative = 0
  return starts.map(function (monthStart) {
    const monthEnd = date.endOfMonth(monthStart)
    const effectiveEnd = monthEnd <= referenceDateStr ? monthEnd : referenceDateStr

    let monthly = 0
    list.forEach(function (item) {
      if (date.startOfMonth(item.purchaseDate) === monthStart) monthly += item.priceCents
    })
    cumulative += monthly

    let dailyCostAsOf = 0
    list.forEach(function (item) {
      if (item.purchaseDate <= effectiveEnd) {
        const value = cost.effectiveDailyCost(item, effectiveEnd)
        if (value !== null) dailyCostAsOf += value
      }
    })

    return {
      monthStart: monthStart,
      monthlyPurchase: monthly,
      cumulativePurchase: cumulative,
      dailyCostAsOf: dailyCostAsOf
    }
  })
}

/** 分类分布（按金额降序）。 */
function categoryBreakdown(assets) {
  const dict = {}
  const list = (assets || []).filter(function (item) { return item.kind === 'asset' })
  list.forEach(function (item) {
    const key = categories.displayCategory(item.category)
    if (!dict[key]) dict[key] = { category: key, total: 0, count: 0 }
    dict[key].total += item.priceCents
    dict[key].count += 1
  })
  return Object.keys(dict).map(function (key) { return dict[key] }).sort(function (a, b) {
    return b.total - a.total
  })
}

/** 状态分布（固定返回三个状态，方便画图）。 */
function statusBreakdown(assets) {
  const list = (assets || []).filter(function (item) { return item.kind === 'asset' })
  return model.STATUSES.map(function (status) {
    return {
      status: status,
      count: list.filter(function (item) { return item.status === status }).length
    }
  })
}

/** 日均成本排行（降序，取前 N），单位：分。 */
function dailyCostRanking(assets, referenceDateStr, limit) {
  const list = (assets || []).filter(function (item) {
    return item.kind === 'asset' && (item.status === 'inUse' || item.status === 'retired')
  })
  return list.map(function (item) {
    const value = cost.effectiveDailyCost(item, referenceDateStr)
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      icon: item.icon,
      dailyCost: value === null ? 0 : value
    }
  }).sort(function (a, b) { return b.dailyCost - a.dailyCost })
    .slice(0, limit > 0 ? limit : 8)
}

module.exports = {
  SORT_OPTIONS,
  sortTitles,
  sortKey,
  sortIndex,
  summary,
  wishlistSummary,
  sortAssets,
  visibleAssets,
  monthlyPoints,
  categoryBreakdown,
  statusBreakdown,
  dailyCostRanking
}
