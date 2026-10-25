// 导出 / 导入：JSON 结构与 iOS / macOS 端 ExportService 完全兼容，
// 三端导出的备份文件可以互相导入。金额以「元」字符串、日期以 ISO8601 编码。

const date = require('./date.js')
const money = require('./money.js')
const model = require('./model.js')

const APP_KEY = 'AssetLife'
const FORMAT_VERSION = 1

class TransferError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function isoNow(nowMs) {
  return date.timestampToISO(nowMs)
}

/** 生成导出对象：{ app, formatVersion, exportedAt, assetCount, assets: [...] } */
function makePayload(assets, exportedAtMs) {
  const list = assets || []
  return {
    app: APP_KEY,
    formatVersion: FORMAT_VERSION,
    exportedAt: isoNow(exportedAtMs),
    assetCount: list.length,
    assets: list.map(function (asset) {
      return {
        id: asset.id,
        name: asset.name,
        price: money.centsToYuanString(asset.priceCents),
        purchaseDate: date.dateToISO(asset.purchaseDate),
        category: asset.category,
        status: asset.status,
        kind: asset.kind,
        costMode: asset.costMode,
        useCount: asset.useCount,
        iconName: asset.icon || '',
        notes: asset.notes,
        tags: asset.tags,
        createdAt: date.timestampToISO(asset.createdAt),
        updatedAt: date.timestampToISO(asset.updatedAt),
        targetMode: asset.targetMode,
        targetValue: asset.targetValueCents === null || asset.targetValueCents === undefined
          ? null
          : money.centsToYuanString(asset.targetValueCents),
        targetDate: asset.targetDate ? date.dateToISO(asset.targetDate) : null,
        isDemoData: !!asset.isDemoData
      }
    })
  }
}

function stringifyPayload(assets, exportedAtMs) {
  return JSON.stringify(makePayload(assets, exportedAtMs), null, 2)
}

function suggestedFileName(nowMs) {
  const now = nowMs ? new Date(nowMs) : new Date()
  const stamp = date.toDateString(now).replace(/-/g, '') + '-' + date.pad2(now.getHours()) + date.pad2(now.getMinutes())
  return 'AssetLife-' + stamp + '.json'
}

/**
 * 解析并校验导入文本。任何字段不合法都会抛出 TransferError。
 * @returns {Array} 规范化后的资产数组
 */
function parsePayload(text) {
  let payload = null
  try {
    payload = JSON.parse(String(text || ''))
  } catch (error) {
    throw new TransferError('invalidJSON', '不是有效的 JSON 文件')
  }
  if (!payload || typeof payload !== 'object') {
    throw new TransferError('invalidJSON', '不是有效的 JSON 文件')
  }
  if (payload.formatVersion !== FORMAT_VERSION) {
    throw new TransferError('unsupportedVersion', '不支持的文件版本：' + payload.formatVersion)
  }
  if (!Array.isArray(payload.assets) || payload.assets.length === 0) {
    throw new TransferError('emptyPayload', '文件中没有资产数据')
  }

  const seen = {}
  return payload.assets.map(function (dto, index) {
    const at = 'assets[' + index + ']'
    if (!String(dto.name || '').trim()) {
      throw new TransferError('missingField', '缺少必需字段：' + at + '.name')
    }
    const priceCents = money.centsFromYuanString(dto.price)
    if (priceCents === null || priceCents < 0) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.price = ' + dto.price)
    }
    const purchaseDate = date.dateFromISO(dto.purchaseDate)
    if (!purchaseDate) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.purchaseDate')
    }
    if (model.STATUSES.indexOf(dto.status) < 0) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.status = ' + dto.status)
    }
    if (model.KINDS.indexOf(dto.kind) < 0) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.kind = ' + dto.kind)
    }
    if (model.COST_MODES.indexOf(dto.costMode) < 0) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.costMode = ' + dto.costMode)
    }
    const useCount = Number(dto.useCount)
    if (!isFinite(useCount) || useCount < 0) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.useCount')
    }
    if (!dto.id) {
      throw new TransferError('missingField', '缺少必需字段：' + at + '.id')
    }
    if (seen[dto.id]) {
      throw new TransferError('invalidValue', '字段值无效：' + at + '.id 重复')
    }
    seen[dto.id] = true

    const createdISO = Date.parse(dto.createdAt)
    const updatedISO = Date.parse(dto.updatedAt)
    const createdAt = isFinite(createdISO) ? createdISO : Date.parse(purchaseDate + 'T00:00:00')
    const updatedAt = isFinite(updatedISO) ? updatedISO : createdAt

    return model.normalizeAsset({
      id: String(dto.id),
      name: dto.name,
      priceCents: priceCents,
      purchaseDate: purchaseDate,
      category: dto.category,
      status: dto.status,
      kind: dto.kind,
      costMode: dto.costMode,
      useCount: Math.round(useCount),
      icon: dto.iconName || '',
      notes: dto.notes || '',
      tags: dto.tags,
      targetMode: model.TARGET_MODES.indexOf(dto.targetMode) >= 0 ? dto.targetMode : 'none',
      targetValueCents: dto.targetValue ? money.centsFromYuanString(dto.targetValue) : null,
      targetDate: date.dateFromISO(dto.targetDate) || '',
      createdAt: createdAt,
      updatedAt: updatedAt,
      isDemoData: !!dto.isDemoData
    })
  })
}

module.exports = {
  APP_KEY,
  FORMAT_VERSION,
  TransferError,
  makePayload,
  stringifyPayload,
  suggestedFileName,
  parsePayload
}
