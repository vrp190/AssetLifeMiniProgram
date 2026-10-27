// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 极简测试运行器：node tools/tests/run.js
// 小程序的 utils 全部是纯 CommonJS 模块，可直接在 node 里 require 测试。
const path = require('path')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (error) {
    failed++
    failures.push({ name: name, error: error })
    console.log('  ✗ ' + name)
    console.log('      ' + (error && error.message ? error.message : String(error)))
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败')
}

function equal(actual, expected, label) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) {
    throw new Error((label || '值不等') + '：期望 ' + b + '，实际 ' + a)
  }
}

function approx(actual, expected, label, epsilon) {
  const eps = epsilon === undefined ? 0.005 : epsilon
  if (typeof actual !== 'number' || !isFinite(actual) || Math.abs(actual - expected) > eps) {
    throw new Error((label || '近似值不等') + '：期望 ' + expected + '，实际 ' + actual)
  }
}

function throws(fn, code, label) {
  try {
    fn()
  } catch (error) {
    if (code && (!error || error.code !== code)) {
      throw new Error((label || '异常码不符') + '：期望 ' + code + '，实际 ' + (error && error.code))
    }
    return
  }
  throw new Error((label || '应当抛出异常') + '：但未抛出')
}

const context = {
  test,
  assert,
  equal,
  approx,
  throws,
  require: function (name) {
    return require(path.join('..', '..', 'utils', name))
  }
}

const suites = [
  'test-cost.js',
  'test-trend.js',
  'test-statistics.js',
  'test-validator.js',
  'test-repository.js',
  'test-transfer.js',
  'test-privacy.js',
  'test-preferences.js'
]

console.log('格物 AssetLife 小程序 · 核心逻辑单元测试\n')

suites.forEach(function (file) {
  console.log('[' + file + ']')
  const suite = require(path.join(__dirname, file))
  suite(context)
  console.log('')
})

console.log('----------------------------------------')
console.log('通过 ' + passed + ' / ' + (passed + failed))
if (failed > 0) {
  console.log('失败 ' + failed + ' 个：')
  failures.forEach(function (item) {
    console.log('  - ' + item.name + '：' + item.error.message)
  })
  process.exit(1)
} else {
  console.log('全部通过 ✓')
}
