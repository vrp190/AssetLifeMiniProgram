// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 表单校验：口径对齐 iOS 端 AssetEditorViewModelTests。
module.exports = function (ctx) {
  const validator = ctx.require('validator.js')
  const test = ctx.test
  const equal = ctx.equal
  const assert = ctx.assert

  const REF = '2024-06-15'

  function form(extra) {
    return Object.assign({
      name: '测试物品',
      priceText: '100',
      purchaseDate: '2024-06-15',
      kind: 'asset',
      category: '数码',
      status: 'inUse',
      costMode: 'perDay',
      useCountText: '',
      targetMode: 'none',
      targetValueText: '',
      targetDate: '2024-06-15'
    }, extra || {})
  }

  test('合法表单通过', function () {
    const result = validator.validate(form(), REF)
    assert(result.valid, '应通过：' + result.messages.join())
  })

  test('空名称不通过', function () {
    assert(!validator.validate(form({ name: '   ' }), REF).valid, '空名称')
  })

  test('名称超长不通过（>40 字）', function () {
    assert(!validator.validate(form({ name: new Array(42).join('字') }), REF).valid, '超长')
  })

  test('空价格不通过', function () {
    assert(!validator.validate(form({ priceText: '' }), REF).valid, '空价格')
  })

  test('非法价格不通过', function () {
    assert(!validator.validate(form({ priceText: 'abc' }), REF).valid, '字母')
    assert(!validator.validate(form({ priceText: '1.2.3' }), REF).valid, '多点')
  })

  test('资产的购买日期不能晚于今天', function () {
    const result = validator.validate(form({ purchaseDate: '2024-06-16' }), REF)
    assert(!result.valid, '未来日期应拒绝')
  })

  test('心愿允许未来日期', function () {
    const result = validator.validate(form({ purchaseDate: '2024-06-16', kind: 'wishlist' }), REF)
    assert(result.valid, '心愿未来日期应允许：' + result.messages.join())
  })

  test('按次模式必须填使用次数', function () {
    assert(!validator.validate(form({ costMode: 'perUse', useCountText: '' }), REF).valid, '空次数')
    assert(!validator.validate(form({ costMode: 'perUse', useCountText: '0' }), REF).valid, '零次')
    assert(validator.validate(form({ costMode: 'perUse', useCountText: '12' }), REF).valid, '12 次')
  })

  test('自定义模式必须填金额', function () {
    assert(!validator.validate(form({ costMode: 'custom', targetValueText: '' }), REF).valid, '空金额')
    assert(validator.validate(form({ costMode: 'custom', targetValueText: '2.5' }), REF).valid, '2.5')
  })

  test('目标日期不能早于购买日期', function () {
    const result = validator.validate(form({
      targetMode: 'byDate',
      targetDate: '2024-06-14'
    }), REF)
    assert(!result.valid, '目标早于购买应拒绝')
  })

  test('toAssetFields 转换正确', function () {
    const fields = validator.toAssetFields(form({
      costMode: 'perUse',
      useCountText: '12',
      targetMode: 'custom',
      targetValueText: '2.5'
    }))
    equal(fields.priceCents, 10000, '价格分')
    equal(fields.useCount, 12, '次数')
    equal(fields.targetValueCents, 250, '自定义分')
    equal(fields.targetDate, '', 'byDate 未启用时清空')
  })

  test('标签解析（中文/英文逗号、去重）', function () {
    const fields = validator.toAssetFields(form({ name: 'x', tags: '苹果，办公, 苹果' }))
    equal(fields.tags.length, 2, '去重后 2 个')
  })

  test('toForm 回填（价格带千分位、次数、自定义金额）', function () {
    const asset = {
      name: '键盘',
      priceCents: 59800,
      purchaseDate: '2024-06-15',
      useCount: 512,
      costMode: 'perUse',
      targetValueCents: 250,
      tags: ['外设']
    }
    const back = validator.toForm(asset, REF)
    equal(back.priceText, '598.00', '价格（固定两位小数，解析时等值）')
    equal(back.useCountText, '512', '次数')
    equal(back.targetValueText, '2.50', '自定义')
    equal(back.tags.length, 1, '标签')
  })
}
