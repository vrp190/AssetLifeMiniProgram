// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 提审前工程自检：node tools/check_project.js
// 覆盖小程序上传/审核最容易踩的硬伤：页面文件缺失、tabBar 图标规格、appid 未填、
// require 路径失效、已废弃 API、语法错误、组件引用缺失。
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const errors = []
const warns = []

function err(msg) { errors.push(msg) }
function warn(msg) { warns.push(msg) }
function readJSON(rel) {
  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full)) { err('缺少文件：' + rel); return null }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch (e) {
    err('JSON 解析失败：' + rel + ' —— ' + e.message)
    return null
  }
}
function walk(dir, out) {
  out = out || []
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir).forEach(function (name) {
    if (name === '.git' || name === 'node_modules') return
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full, out)
    else out.push(path.relative(ROOT, full))
  })
  return out
}
/** 读取 PNG 宽高（IHDR） */
function pngSize(file) {
  const buf = fs.readFileSync(file)
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

console.log('格物 AssetLife 小程序 · 提审前工程自检\n')

// ---- 1. 基础配置文件 ----
const app = readJSON('app.json')
const project = readJSON('project.config.json')
readJSON('sitemap.json')

if (!fs.existsSync(path.join(ROOT, 'app.js'))) err('缺少 app.js')
if (!fs.existsSync(path.join(ROOT, 'app.wxss'))) warn('缺少 app.wxss（全局样式）')

// ---- 2. appid ----
if (project) {
  if (!project.appid || String(project.appid).indexOf('*') >= 0) {
    warn('project.config.json 的 appid 为空 —— 上传前必须在微信开发者工具中填入真实 AppID，或用「测试号」仅做本地调试')
  }
  if (project.compileType !== 'miniprogram') err('project.config.json 的 compileType 应为 miniprogram')
}

const files = walk(ROOT)
const jsFiles = files.filter(function (f) { return f.endsWith('.js') && f.indexOf('tools/') !== 0 })

// ---- 3. 页面完整性 ----
if (app) {
  const pages = app.pages || []
  if (!pages.length) err('app.json 未声明 pages')
  pages.forEach(function (p) {
    ;['.js', '.json', '.wxml'].forEach(function (ext) {
      if (!fs.existsSync(path.join(ROOT, p + ext))) err('页面缺少文件：' + p + ext)
    })
    if (!fs.existsSync(path.join(ROOT, p + '.wxss'))) warn('页面缺少样式（可忽略）：' + p + '.wxss')
  })

  // ---- 4. tabBar ----
  const tabBar = app.tabBar
  if (tabBar && tabBar.list) {
    if (tabBar.list.length < 2 || tabBar.list.length > 5) err('tabBar 数量必须在 2~5 之间')
    tabBar.list.forEach(function (item) {
      if (pages.indexOf(item.pagePath) < 0) err('tabBar 指向的页面未在 pages 中声明：' + item.pagePath)
      ;['iconPath', 'selectedIconPath'].forEach(function (key) {
        const rel = item[key]
        if (!rel) { err('tabBar 项缺少 ' + key + '：' + item.pagePath); return }
        const full = path.join(ROOT, rel)
        if (!fs.existsSync(full)) { err('tabBar 图标不存在：' + rel); return }
        if (!rel.toLowerCase().endsWith('.png')) { err('tabBar 图标必须为 PNG：' + rel); return }
        const size = pngSize(full)
        if (!size) { err('tabBar 图标不是有效 PNG：' + rel); return }
        if (size.w > 81 || size.h > 81) err('tabBar 图标不得超过 81x81：' + rel + '（当前 ' + size.w + 'x' + size.h + '）')
        const bytes = fs.statSync(full).size
        if (bytes > 40 * 1024) warn('tabBar 图标偏大（建议 ≤40KB）：' + rel + '（' + Math.round(bytes / 1024) + 'KB）')
      })
    })
  } else {
    warn('未配置 tabBar')
  }

  // ---- 5. 组件引用 ----
  const jsonFiles = files.filter(function (f) { return f.endsWith('.json') && f.indexOf('tools/') !== 0 })
  jsonFiles.forEach(function (rel) {
    let conf = null
    try {
      conf = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
    } catch (e) { return }
    const using = conf && conf.usingComponents
    if (!using) return
    const base = path.dirname(rel)
    Object.keys(using).forEach(function (tag) {
      const target = using[tag]
      if (target.startsWith('plugin://')) return
      // 以 / 开头是小程序项目根相对路径，其余是相对于当前 json 的路径
      const abs = target.startsWith('/')
        ? path.join(ROOT, target)
        : path.resolve(ROOT, base, target)
      if (fs.existsSync(abs + '.js') || fs.existsSync(path.join(abs, 'index.js'))) return
      err('自定义组件路径无效：' + rel + ' → ' + tag + '：' + target)
    })
  })
}

// ---- 6. require 路径 ----
jsFiles.forEach(function (rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const re = /require\(['"](\.[^'"]+)['"]\)/g
  let m = null
  while ((m = re.exec(src)) !== null) {
    const abs = path.resolve(ROOT, path.dirname(rel), m[1])
    if (!fs.existsSync(abs) && !fs.existsSync(abs + '.js')) {
      err('require 目标不存在：' + rel + ' → ' + m[1])
    }
  }
})

// ---- 7. 已废弃 / 高风险 API ----
const deprecated = [
  { re: /wx\.getSystemInfoSync\s*\(/, msg: 'wx.getSystemInfoSync 已废弃，请改用 utils/device.js（内部优先 wx.getWindowInfo）' },
  { re: /wx\.getUserInfo\s*\(/, msg: 'wx.getUserInfo 已废弃且涉及用户信息采集' },
  { re: /wx\.getUserProfile\s*\(/, msg: 'wx.getUserProfile 涉及用户信息采集，本小程序不应使用' },
  { re: /wx\.request\s*\(/, msg: '出现网络请求，需在 mp 后台配置服务器域名' },
  { re: /<web-view/, msg: '出现 web-view，需配置业务域名' }
]
jsFiles.concat(files.filter(function (f) { return f.endsWith('.wxml') })).forEach(function (rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  deprecated.forEach(function (item) {
    if (item.re.test(src)) err(rel + '：' + item.msg)
  })
})

// ---- 7.5 页面/组件：WXML 与 JS 的一致性 ----
// 这类问题在真机上表现为「按钮点了没反应 / 文字空白」，开发者工具未必报错。
const JS_RESERVED = {
  true: 1, false: 1, null: 1, undefined: 1, typeof: 1, return: 1, if: 1, else: 1,
  in: 1, of: 1, new: 1, this: 1, item: 1, index: 1, length: 1, Math: 1, Number: 1,
  String: 1, Date: 1, JSON: 1, Object: 1, Array: 1, Boolean: 1
}
files.filter(function (f) { return f.endsWith('.wxml') }).forEach(function (rel) {
  const base = rel.replace(/\.wxml$/, '')
  const jsRel = base + '.js'
  if (!fs.existsSync(path.join(ROOT, jsRel))) return
  const wxml = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const js = fs.readFileSync(path.join(ROOT, jsRel), 'utf8')

  // (a) 事件绑定的方法必须已定义
  const handlers = {}
  const evtRe = /(?:bind|catch|capture-bind|capture-catch)[:]?([a-zA-Z]+)\s*=\s*"([^"]+)"/g
  let em = null
  while ((em = evtRe.exec(wxml)) !== null) {
    const name = em[2].trim()
    if (!name || name.indexOf('{{') >= 0) continue
    handlers[name] = true
  }
  Object.keys(handlers).forEach(function (name) {
    const defined = new RegExp('(^|[^\\w$])' + name.replace(/\$/g, '\\$') + '\\s*[:\\(]').test(js)
    if (!defined) err(rel + '：绑定了事件 ' + name + '，但 ' + jsRel + ' 中没有定义')
  })

  // (b) 模板里用到的字段必须在 JS 中出现过（data / properties / setData / 计算变量）
  const fieldRe = /\{\{([^}]+)\}\}/g
  let fm = null
  const missing = {}
  while ((fm = fieldRe.exec(wxml)) !== null) {
    // 剔除字符串字面量（如 {{ a ? 'on' : '' }} 中的 'on'），避免把样式名当字段
    const expr = fm[1].replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
    const idRe = /[A-Za-z_$][\w$]*/g
    let im = null
    while ((im = idRe.exec(expr)) !== null) {
      const id = im[0]
      if (JS_RESERVED[id]) continue
      if (new RegExp('(^|[^\\w$])' + id.replace(/\$/g, '\\$') + '(?!\\w)').test(js)) continue
      missing[id] = true
    }
  }
  Object.keys(missing).forEach(function (id) {
    err(rel + '：模板引用了字段 ' + id + '，但 ' + jsRel + ' 中从未出现（可能是漏写 data 或拼写错误）')
  })
})

// ---- 8. 语法检查 ----
let syntaxBad = 0
jsFiles.forEach(function (rel) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' })
  } catch (e) {
    syntaxBad++
    err('语法错误：' + rel)
  }
})

// ---- 9. 体积 ----
const totalBytes = files
  .filter(function (f) { return f.indexOf('tools/') !== 0 })
  .reduce(function (sum, f) { return sum + fs.statSync(path.join(ROOT, f)).size }, 0)
const codeBytes = jsFiles.concat(files.filter(function (f) { return f.endsWith('.wxml') || f.endsWith('.wxss') }))
  .reduce(function (sum, f) { return sum + fs.statSync(path.join(ROOT, f)).size }, 0)

console.log('检查文件 ' + files.length + ' 个，其中 JS ' + jsFiles.length + ' 个，语法错误 ' + syntaxBad + ' 个')
console.log('代码+模板+样式约 ' + Math.round(codeBytes / 1024) + 'KB，全量（含图标）约 ' + Math.round(totalBytes / 1024) + 'KB（小程序包上限 2MB）')
console.log('')

if (warns.length) {
  console.log('提醒 ' + warns.length + ' 条：')
  warns.forEach(function (w) { console.log('  · ' + w) })
  console.log('')
}
if (errors.length) {
  console.log('错误 ' + errors.length + ' 条：')
  errors.forEach(function (e) { console.log('  ✗ ' + e) })
  process.exit(1)
}
console.log('工程自检通过 ✓（提醒项不影响上传，但建议处理）')
