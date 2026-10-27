// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 存储适配层：把「读写键值」这一层抽象出来，
// 逻辑层（repository）不直接依赖 wx.*，因此可以在 node 里跑单元测试。

/** 内存实现：单元测试与降级兜底使用。 */
function createMemoryStorage(initial) {
  const dict = Object.assign({}, initial || {})
  return {
    read: function (key) {
      return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : null
    },
    write: function (key, value) {
      dict[key] = value
    },
    remove: function (key) {
      delete dict[key]
    }
  }
}

/**
 * 微信本地存储实现。
 * 小程序单 key 上限 1MB、单小程序总上限 10MB；资产数据体积小，足以覆盖长期使用。
 */
function createWXStorage() {
  const wx = (typeof global !== 'undefined' && global.wx) ? global.wx : null
  return {
    read: function (key) {
      if (!wx) return null
      try {
        const value = wx.getStorageSync(key)
        return value === '' || value === undefined || value === null ? null : value
      } catch (error) {
        return null
      }
    },
    write: function (key, value) {
      if (!wx) return
      try {
        wx.setStorageSync(key, value)
      } catch (error) {
        if (wx.showToast) {
          wx.showToast({ title: '本地存储空间不足，保存失败', icon: 'none' })
        }
      }
    },
    remove: function (key) {
      if (!wx) return
      try {
        wx.removeStorageSync(key)
      } catch (error) {
        // ignore
      }
    }
  }
}

const STORAGE_KEY = 'assetlife.assets.v1'
const SETTINGS_KEY = 'assetlife.settings.v1'

module.exports = {
  STORAGE_KEY,
  SETTINGS_KEY,
  createMemoryStorage,
  createWXStorage
}
