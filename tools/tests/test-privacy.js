// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 隐私授权封装 & 设备像素比：注入桩对象即可在 node 中完整测试。
module.exports = function (ctx) {
  const test = ctx.test
  const assert = ctx.assert
  const equal = ctx.equal
  const privacy = ctx.require('privacy.js')
  const device = ctx.require('device.js')

  // ---------- device.pixelRatio ----------
  test('像素比：优先使用 getWindowInfo', function () {
    equal(device.pixelRatio({ getWindowInfo: function () { return { pixelRatio: 3 } } }), 3, 'windowInfo')
  })

  test('像素比：老基础库降级到 getSystemInfoSync', function () {
    equal(device.pixelRatio({ getSystemInfoSync: function () { return { pixelRatio: 2.5 } } }), 2.5, 'systemInfo')
  })

  test('像素比：接口缺失时回退默认值 2', function () {
    equal(device.pixelRatio({}), 2, '空接口')
    equal(device.pixelRatio(null), 2, '无 wx')
  })

  test('像素比：返回值缺失 pixelRatio 时回退默认值', function () {
    equal(device.pixelRatio({ getWindowInfo: function () { return {} } }), 2, '空返回值')
  })

  // ---------- privacy ----------
  function stub(opts) {
    const calls = { setting: 0, authorize: 0 }
    return {
      calls: calls,
      api: {
        getPrivacySetting: function (obj) {
          calls.setting++
          if (opts.queryFail) { obj.fail && obj.fail({ errMsg: 'fail' }); return }
          obj.success && obj.success({ needAuthorization: !!opts.need })
        },
        requirePrivacyAuthorize: opts.noAuthorizeApi
          ? undefined
          : function (obj) {
              calls.authorize++
              if (opts.deny) { obj.fail && obj.fail({ errMsg: 'deny' }); return }
              obj.success && obj.success()
            }
      }
    }
  }

  function run(opts, cb) {
    const s = stub(opts)
    privacy.createPrivacy(s.api).ensure(cb)
    return s.calls
  }

  test('隐私：无需授权（needAuthorization=false）直接放行', function () {
    let allowed = null
    const calls = run({ need: false }, function (ok) { allowed = ok })
    assert(allowed === true, '应放行')
    equal(calls.setting, 1, '只查询一次')
    equal(calls.authorize, 0, '不应弹授权框')
  })

  test('隐私：需要授权且用户同意', function () {
    let allowed = null
    const calls = run({ need: true }, function (ok) { allowed = ok })
    assert(allowed === true, '应放行')
    equal(calls.authorize, 1, '弹一次授权框')
  })

  test('隐私：用户拒绝则回调 false，供调用方降级', function () {
    let allowed = null
    run({ need: true, deny: true }, function (ok) { allowed = ok })
    assert(allowed === false, '应拒绝')
  })

  test('隐私：授权结果会被缓存，不重复弹窗', function () {
    const s = stub({ need: true })
    const p = privacy.createPrivacy(s.api)
    let first = null
    let second = null
    p.ensure(function (ok) { first = ok })
    p.ensure(function (ok) { second = ok })
    assert(first === true && second === true, '两次都应放行')
    equal(s.calls.setting, 1, '只查询一次')
    equal(s.calls.authorize, 1, '只弹一次授权框')
    equal(p.stateOf(), privacy.GRANTED, '状态为已授权')
  })

  test('隐私：拒绝状态同样缓存，避免反复打扰用户', function () {
    const s = stub({ need: true, deny: true })
    const p = privacy.createPrivacy(s.api)
    let second = null
    p.ensure(function () {})
    p.ensure(function (ok) { second = ok })
    assert(second === false, '仍为拒绝')
    equal(s.calls.authorize, 1, '只弹一次')
    equal(p.stateOf(), privacy.DENIED, '状态为已拒绝')
  })

  test('隐私：reset 后可重新查询', function () {
    const s = stub({ need: true })
    const p = privacy.createPrivacy(s.api)
    p.ensure(function () {})
    p.reset()
    equal(p.stateOf(), privacy.UNKNOWN, '状态重置')
    p.ensure(function () {})
    equal(s.calls.setting, 2, '再次查询')
  })

  test('隐私：查询失败（未配置隐私指引）按放行处理', function () {
    let allowed = null
    run({ queryFail: true }, function (ok) { allowed = ok })
    assert(allowed === true, '查询失败应放行')
  })

  test('隐私：老基础库无 getPrivacySetting 时放行', function () {
    let allowed = null
    privacy.createPrivacy({}).ensure(function (ok) { allowed = ok })
    assert(allowed === true, '老基础库应放行')
  })

  test('隐私：未注入 api（node 环境）时放行', function () {
    let allowed = null
    privacy.createPrivacy().ensure(function (ok) { allowed = ok })
    assert(allowed === true, 'node 环境应放行')
  })

  test('隐私：能查询但不能授权时按未授权处理', function () {
    let allowed = null
    run({ need: true, noAuthorizeApi: true }, function (ok) { allowed = ok })
    assert(allowed === false, '应视为未授权')
  })
}
