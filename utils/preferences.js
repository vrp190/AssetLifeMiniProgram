// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 用户偏好：与资产数据分开存放（assetlife.settings.v1），清空数据不影响偏好。
// 与 repository 一样依赖注入的 storage 适配层，可在 node 里直接测试。

const storage = require('./storage.js')
const statistics = require('./statistics.js')

const DEFAULT_SORT = 'purchaseDateDesc'

function isValidSort(key) {
  return statistics.SORT_OPTIONS.some(function (item) { return item.key === key })
}

/** 时间戳只接受有限正数，其余（含 NaN / 字符串 / 负数）一律视为「从未备份」。 */
function normalizeTimestamp(value) {
  const ts = Number(value)
  return isFinite(ts) && ts > 0 ? ts : 0
}

/**
 * @param {Object} adapter storage 适配层（read/write/remove）
 * @param {Object} options { key }
 */
function createPreferences(adapter, options) {
  const opts = options || {}
  const key = opts.key || storage.SETTINGS_KEY

  // 存储内容不可信：非法 JSON、非对象、未知取值一律回落到默认值。
  function load() {
    const raw = adapter.read(key)
    let parsed = null
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (error) {
      parsed = null
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {}
    return {
      defaultSort: isValidSort(parsed.defaultSort) ? parsed.defaultSort : DEFAULT_SORT,
      lastBackupAt: normalizeTimestamp(parsed.lastBackupAt)
    }
  }

  function persist(value) {
    adapter.write(key, JSON.stringify(value))
  }

  return {
    load: load,
    /** 资产列表默认排序（statistics.SORT_OPTIONS 的 key）。 */
    defaultSort: function () {
      return load().defaultSort
    },
    /**
     * 设置默认排序；非法 key 会被忽略并返回当前值。
     * @returns {string} 生效后的排序 key
     */
    setDefaultSort: function (sortKey) {
      const current = load()
      if (!isValidSort(sortKey)) return current.defaultSort
      current.defaultSort = sortKey
      persist(current)
      return current.defaultSort
    },
    /** 恢复默认排序（近期备份时间属于事实记录，不随偏好重置清除）。 */
    reset: function () {
      const current = load()
      current.defaultSort = DEFAULT_SORT
      persist(current)
      return current
    },
    /** 最近一次成功导出备份的时间戳（毫秒）；0 表示从未备份。 */
    lastBackupAt: function () {
      return load().lastBackupAt
    },
    /** 记录备份时间；非法时间戳写入 0（等价于清除记录）。 */
    setLastBackupAt: function (timestamp) {
      const current = load()
      current.lastBackupAt = normalizeTimestamp(timestamp)
      persist(current)
      return current.lastBackupAt
    }
  }
}

module.exports = { DEFAULT_SORT, createPreferences }
