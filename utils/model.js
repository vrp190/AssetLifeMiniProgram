// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 资产数据结构、默认值的补齐与规范化。
// 字段语义与 iOS / macOS 端 Asset @Model 一一对应，只是把 Decimal 换成「分」整数。

const date = require('./date.js')
const money = require('./money.js')

let sequence = 0

/** 本地生成的稳定 ID（不依赖任何第三方库）。 */
function uuid() {
  sequence += 1
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return time + '-' + sequence.toString(36) + '-' + rand
}

const STATUSES = ['inUse', 'retired', 'sold']
const KINDS = ['asset', 'wishlist']
const COST_MODES = ['perDay', 'perUse', 'custom']
const TARGET_MODES = ['none', 'byDate', 'custom']

const STATUS_TITLES = {
  inUse: '使用中',
  retired: '已退役',
  sold: '已卖出'
}

const COST_MODE_TITLES = {
  perDay: '按天计算',
  perUse: '按次计算',
  custom: '自定义金额'
}

const COST_MODE_DETAILS = {
  perDay: '日均成本 = 购入价格 ÷ 持有天数（当天按 1 天）',
  perUse: '单次成本 = 购入价格 ÷ 使用次数',
  custom: '直接使用你设定的每日成本金额'
}

const TARGET_MODE_TITLES = {
  none: '不设置',
  byDate: '按目标日期',
  custom: '自定义金额'
}

function normalizeName(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

function normalizeTags(value) {
  let parts = []
  if (Array.isArray(value)) {
    parts = value
  } else {
    // 中英文逗号都视为分隔符
    parts = String(value || '').split(/[,，]/)
  }
  const seen = {}
  const result = []
  parts.map(normalizeName).filter(Boolean).forEach(function (tag) {
    if (!seen[tag]) {
      seen[tag] = true
      result.push(tag)
    }
  })
  return result
}

function pickIn(value, options, fallback) {
  return options.indexOf(value) >= 0 ? value : fallback
}

/**
 * 创建资产对象，补齐所有默认值。传入的 now 用于注入当前时间（便于测试）。
 */
function createAsset(fields) {
  const input = fields || {}
  const now = typeof input.now === 'number' ? input.now : Date.now()
  return normalizeAsset(Object.assign({}, input, {
    id: input.id || uuid(),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now
  }))
}

/** 清洗并补齐字段，用于读取本地存储 / 导入数据后的兜底。 */
function normalizeAsset(raw) {
  const input = raw || {}
  const now = Date.now()
  const purchaseDate = date.isValidDateString(input.purchaseDate)
    ? input.purchaseDate
    : date.today()

  let targetValueCents = null
  if (typeof input.targetValueCents === 'number' && isFinite(input.targetValueCents)) {
    targetValueCents = Math.round(input.targetValueCents)
  }

  return {
    id: input.id || uuid(),
    name: normalizeName(input.name),
    priceCents: Math.max(0, Math.round(Number(input.priceCents) || 0)),
    purchaseDate: purchaseDate,
    category: normalizeName(input.category) || '其他',
    status: pickIn(input.status, STATUSES, 'inUse'),
    kind: pickIn(input.kind, KINDS, 'asset'),
    costMode: pickIn(input.costMode, COST_MODES, 'perDay'),
    useCount: Math.max(0, Math.round(Number(input.useCount) || 0)),
    icon: typeof input.icon === 'string' ? input.icon : '',
    notes: typeof input.notes === 'string' ? input.notes : '',
    tags: normalizeTags(input.tags),
    targetMode: pickIn(input.targetMode, TARGET_MODES, 'none'),
    targetValueCents: targetValueCents,
    targetDate: date.isValidDateString(input.targetDate) ? input.targetDate : '',
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
    isDemoData: !!input.isDemoData
  }
}

/** 更新已有资产的字段（会刷新 updatedAt）。返回新对象，不改原对象。 */
function applyUpdates(asset, patch, nowMs) {
  const updated = Object.assign({}, asset, patch || {}, {
    id: asset.id,
    updatedAt: typeof nowMs === 'number' ? nowMs : Date.now()
  })
  return normalizeAsset(updated)
}

function matchesSearch(asset, searchText) {
  const needle = String(searchText || '').trim().toLowerCase()
  if (!needle) return true
  if (String(asset.name || '').toLowerCase().indexOf(needle) >= 0) return true
  if (String(asset.category || '').toLowerCase().indexOf(needle) >= 0) return true
  return asset.tags.some(function (tag) {
    return String(tag).toLowerCase().indexOf(needle) >= 0
  })
}

module.exports = {
  uuid,
  createAsset,
  normalizeAsset,
  applyUpdates,
  normalizeTags,
  matchesSearch,
  STATUSES,
  KINDS,
  COST_MODES,
  TARGET_MODES,
  STATUS_TITLES,
  COST_MODE_TITLES,
  COST_MODE_DETAILS,
  TARGET_MODE_TITLES
}
