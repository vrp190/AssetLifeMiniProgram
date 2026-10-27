// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 数据仓库：增删改查 + 演示数据 + 全量替换（导入）。
// 依赖注入的 storage 适配层，因此这份逻辑可以在 node 里完整测试。

const model = require('./model.js')
const demo = require('./demo.js')
const storage = require('./storage.js')

function sortByPurchaseDesc(list) {
  return list.slice().sort(function (a, b) {
    if (a.purchaseDate === b.purchaseDate) return b.updatedAt - a.updatedAt
    return a.purchaseDate < b.purchaseDate ? 1 : -1
  })
}

/**
 * @param {Object} adapter storage 适配层（read/write/remove）
 * @param {Object} options { key, now }
 */
function createRepository(adapter, options) {
  const opts = options || {}
  const key = opts.key || storage.STORAGE_KEY
  const now = function () {
    return typeof opts.now === 'function' ? opts.now() : Date.now()
  }
  let cache = null

  function load() {
    const raw = adapter.read(key)
    if (!raw) return []
    let parsed = null
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (error) {
      parsed = null
    }
    if (!Array.isArray(parsed)) return []
    return parsed.map(model.normalizeAsset)
  }

  function ensure() {
    if (cache === null) cache = load()
    return cache
  }

  function persist() {
    adapter.write(key, JSON.stringify(cache === null ? [] : cache))
  }

  return {
    /** 全部条目（按购买日期降序）。 */
    all: function () {
      return sortByPurchaseDesc(ensure())
    },
    raw: function () {
      return ensure().slice()
    },
    byKind: function (kind) {
      const list = ensure().filter(function (item) { return item.kind === kind })
      return sortByPurchaseDesc(list)
    },
    byId: function (id) {
      const list = ensure()
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i]
      }
      return null
    },
    add: function (asset) {
      const created = model.createAsset(Object.assign({}, asset, { now: now() }))
      ensure().push(created)
      persist()
      return created
    },
    update: function (asset) {
      const list = ensure()
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === asset.id) {
          list[i] = model.applyUpdates(list[i], asset, now())
          persist()
          return list[i]
        }
      }
      return null
    },
    remove: function (id) {
      const list = ensure()
      const next = list.filter(function (item) { return item.id !== id })
      const removed = next.length !== list.length
      cache = next
      persist()
      return removed
    },
    clear: function () {
      cache = []
      persist()
    },
    /** 全量替换（导入备份时使用）。 */
    replaceAll: function (assets) {
      cache = (assets || []).map(function (item) { return model.normalizeAsset(item) })
      persist()
      return cache.length
    },
    hasDemo: function () {
      return ensure().some(function (item) { return item.isDemoData })
    },
    /** 写入演示数据；已有演示数据时返回 0，避免重复。 */
    insertDemo: function (referenceDateStr) {
      if (this.hasDemo()) return 0
      const items = demo.makeAssets(referenceDateStr, now())
      cache = ensure().concat(items)
      persist()
      return items.length
    },
    removeDemo: function () {
      const list = ensure()
      cache = list.filter(function (item) { return !item.isDemoData })
      persist()
      return list.length - cache.length
    },
    count: function () {
      return ensure().length
    }
  }
}

module.exports = { createRepository, sortByPurchaseDesc }
