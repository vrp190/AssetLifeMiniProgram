// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 新增 / 编辑表单校验：与 iOS 端 AssetEditorViewModel.validate 同一套规则。

const money = require('./money.js')
const model = require('./model.js')

const MAX_NAME_LENGTH = 40

/**
 * @param {Object} form { name, priceText, purchaseDate, kind, costMode,
 *                        useCountText, targetMode, targetValueText, targetDate }
 * @param {String} referenceDate 'yyyy-MM-dd'
 * @returns {Object} { valid: Boolean, messages: Array<String> }
 */
function validate(form, referenceDate) {
  const input = form || {}
  const messages = []
  const kind = input.kind === 'wishlist' ? 'wishlist' : 'asset'

  const name = String(input.name || '').trim()
  if (!name) {
    messages.push('名称不能为空')
  } else if (name.length > MAX_NAME_LENGTH) {
    messages.push('名称不能超过 ' + MAX_NAME_LENGTH + ' 个字符')
  }

  const priceText = String(input.priceText || '').trim()
  if (!priceText) {
    messages.push('价格不能为空')
  } else if (money.parseMoney(priceText) === null) {
    messages.push('价格格式不正确')
  } else {
    const price = money.yuanToCents(money.parseMoney(priceText))
    if (price < 0) messages.push('价格不能为负数')
  }

  // 未来日期仅心愿可用；资产必须是今天或更早
  const purchaseDate = input.purchaseDate
  if (kind === 'asset' && purchaseDate && purchaseDate > referenceDate) {
    messages.push('资产的购买日期不能晚于今天（未来计划请选择「心愿」类型）')
  }

  if (input.costMode === 'perUse') {
    const countText = String(input.useCountText || '').trim()
    const count = Number(/^\d+$/.test(countText) ? countText : '')
    if (!countText || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
      messages.push('按次计算需要填写使用次数（至少 1 次）')
    }
  }

  if (input.costMode === 'custom') {
    const targetText = String(input.targetValueText || '').trim()
    const value = money.parseMoney(targetText)
    if (!targetText || value === null || value < 0) {
      messages.push('自定义模式需要填写有效的每日成本金额')
    }
  }

  if (input.targetMode === 'byDate' && input.targetDate && purchaseDate) {
    if (input.targetDate < purchaseDate) {
      messages.push('目标日期不能早于购买日期')
    }
  }

  return { valid: messages.length === 0, messages: messages }
}

/**
 * 表单 -> 资产字段（不含 id / 时间戳）。调用前必须先 validate 通过。
 */
function toAssetFields(form) {
  const input = form || {}
  const price = money.parseMoney(input.priceText)
  let targetValueCents = null
  if (input.targetMode === 'custom') {
    const value = money.parseMoney(input.targetValueText)
    targetValueCents = value === null ? null : money.yuanToCents(value)
  }
  let useCount = 0
  if (input.costMode === 'perUse') {
    useCount = Math.max(0, Math.round(Number(String(input.useCountText || '').trim()) || 0))
  }
  return {
    name: String(input.name || '').trim(),
    priceCents: price === null ? 0 : money.yuanToCents(price),
    purchaseDate: input.purchaseDate,
    category: input.category,
    status: input.status,
    kind: input.kind,
    costMode: input.costMode,
    useCount: useCount,
    icon: input.icon,
    notes: input.notes,
    tags: model.normalizeTags(input.tags),
    targetMode: input.targetMode,
    targetValueCents: targetValueCents,
    targetDate: input.targetMode === 'byDate' ? input.targetDate : ''
  }
}

/** 资产 -> 表单初值（用于编辑页回填）。 */
function toForm(asset, referenceDate) {
  const source = asset || {}
  return {
    name: source.name || '',
    priceText: source.priceCents === undefined ? '' : money.formatPlain(source.priceCents),
    purchaseDate: source.purchaseDate || referenceDate,
    category: source.category || '数码',
    status: source.status || 'inUse',
    kind: source.kind || 'asset',
    costMode: source.costMode || 'perDay',
    useCountText: source.useCount > 0 ? String(source.useCount) : '',
    icon: source.icon || '',
    notes: source.notes || '',
    tags: Array.isArray(source.tags) ? source.tags : [],
    targetMode: source.targetMode || 'none',
    targetValueText: typeof source.targetValueCents === 'number'
      ? money.formatPlain(source.targetValueCents)
      : '',
    targetDate: source.targetDate || source.purchaseDate || referenceDate
  }
}

module.exports = {
  MAX_NAME_LENGTH,
  validate,
  toAssetFields,
  toForm
}
