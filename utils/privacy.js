// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 微信「用户隐私保护指引」授权封装。
//
// 本小程序只涉及一类隐私接口：剪贴板（导出时写入 wx.setClipboardData、
// 导入时读取 wx.getClipboardData）。按微信要求，调用前需确保用户已同意
// 《小程序用户隐私保护指引》。
//
// 约定：
//   - 后台未配置隐私指引 / 基础库过老（无 getPrivacySetting）：视为可用，直接放行，
//     由具体接口自己在 fail 回调里降级；
//   - needAuthorization === true：弹官方授权弹窗，用户拒绝则回调 false，
//     调用方必须给出降级路径（例如提示手动粘贴），不得静默失败；
//   - 授权结果按会话缓存，避免同一操作重复弹窗。

var GRANTED = 'granted'
var DENIED = 'denied'
var UNKNOWN = 'unknown'

/**
 * 创建授权检查器。api 可注入，便于 node 单测。
 * @param {Object} [api] 默认取全局 wx
 */
function createPrivacy(api) {
  var state = UNKNOWN

  /**
   * 确保已获得隐私授权。
   * @param {Function} callback (allowed:boolean) => void
   */
  function ensure(callback) {
    var done = callback || function () {}
    var w = api || (typeof wx !== 'undefined' ? wx : null)

    // 无 wx（单测环境）或老基础库没有隐私机制：放行
    if (!w || typeof w.getPrivacySetting !== 'function') {
      done(true)
      return
    }
    if (state === GRANTED) {
      done(true)
      return
    }
    if (state === DENIED) {
      done(false)
      return
    }

    w.getPrivacySetting({
      success: function (res) {
        // res.needAuthorization：是否需要弹窗授权
        if (!res || res.needAuthorization === false) {
          state = GRANTED
          done(true)
          return
        }
        if (typeof w.requirePrivacyAuthorize !== 'function') {
          // 极少见：能查询但不能授权，按未授权处理，交给调用方降级
          done(false)
          return
        }
        w.requirePrivacyAuthorize({
          success: function () {
            state = GRANTED
            done(true)
          },
          fail: function () {
            state = DENIED
            done(false)
          }
        })
      },
      fail: function () {
        // 查询失败（例如未配置隐私指引）：放行，后续接口自行 fail 并降级
        done(true)
      }
    })
  }

  /** 供单测/调试读取当前状态 */
  function stateOf() {
    return state
  }

  /** 重置状态（切换账号、清除缓存时可调用） */
  function reset() {
    state = UNKNOWN
  }

  return {
    ensure: ensure,
    stateOf: stateOf,
    reset: reset
  }
}

module.exports = {
  createPrivacy: createPrivacy,
  GRANTED: GRANTED,
  DENIED: DENIED,
  UNKNOWN: UNKNOWN
}
