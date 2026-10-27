// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 设备信息读取：统一取 pixelRatio，供 canvas 高清绘制使用。
// wx.getSystemInfoSync 已废弃（开发者工具会告警，审核的代码质量扫描也会提示），
// 优先使用基础库 2.20.1+ 的 wx.getWindowInfo，老版本自动降级。

var DEFAULT_RATIO = 2

/**
 * 取设备像素比。api 可注入，便于 node 单测。
 * @param {Object} [api] 默认取全局 wx
 * @returns {number}
 */
function pixelRatio(api) {
  var w = api || (typeof wx !== 'undefined' ? wx : null)
  if (!w) return DEFAULT_RATIO
  if (typeof w.getWindowInfo === 'function') {
    var win = w.getWindowInfo()
    if (win && win.pixelRatio) return win.pixelRatio
  }
  if (typeof w.getSystemInfoSync === 'function') {
    var sys = w.getSystemInfoSync()
    if (sys && sys.pixelRatio) return sys.pixelRatio
  }
  return DEFAULT_RATIO
}

module.exports = {
  DEFAULT_RATIO: DEFAULT_RATIO,
  pixelRatio: pixelRatio
}
