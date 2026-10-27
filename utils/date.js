// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 日期工具。
//
// 设计约定（重要）：所有「自然日」一律使用 'yyyy-MM-dd' 字符串表示，
// 不存 Date 对象、不存时间戳。原因：
//   1. 微信小程序的 picker / 日历组件天然返回 'yyyy-MM-dd'；
//   2. iOS 的 JavaScriptCore 对 'yyyy-MM-dd' 这类带横线的字符串解析行为与安卓不一致
//      （可能被当成 UTC 甚至 Invalid Date），手动拆解构造可彻底规避；
//   3. 字符串字典序 === 日期先后，排序比较不需要额外处理。
//
// 只有「创建/更新时间」这类需要到秒的字段才用毫秒时间戳（number）。

const DAY_MS = 86400000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/** Date -> 'yyyy-MM-dd' */
function toDateString(date) {
  if (!date) return ''
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

/** 'yyyy-MM-dd' -> Date（本地零点）。非法输入返回 null。 */
function fromDateString(str) {
  const match = DATE_RE.exec(String(str || ''))
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  // 处理 2 月 31 日这类会被 Date 自动进位的输入
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

function isValidDateString(str) {
  return fromDateString(str) !== null
}

function today(date) {
  return toDateString(date || new Date())
}

function addDays(dateStr, days) {
  const date = fromDateString(dateStr)
  if (!date) return dateStr
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

function daysInMonth(year, month /* 1-12 */) {
  return new Date(year, month, 0).getDate()
}

/** 加 N 个月，日溢出时钳到当月最后一天（1/31 + 1 月 => 2/28）。 */
function addMonths(dateStr, months) {
  const date = fromDateString(dateStr)
  if (!date) return dateStr
  const day = date.getDate()
  const targetMonth = date.getMonth() + months
  date.setDate(1)
  date.setMonth(targetMonth)
  const max = daysInMonth(date.getFullYear(), date.getMonth() + 1)
  date.setDate(Math.min(day, max))
  return toDateString(date)
}

function startOfMonth(dateStr) {
  const date = fromDateString(dateStr)
  if (!date) return dateStr
  date.setDate(1)
  return toDateString(date)
}

function endOfMonth(dateStr) {
  const date = fromDateString(dateStr)
  if (!date) return dateStr
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  date.setDate(0)
  return toDateString(date)
}

/** to - from 的自然日差值（可能为负）。用 round 消除夏令时带来的 ±1 小时误差。 */
function diffDays(fromStr, toStr) {
  const a = fromDateString(fromStr)
  const b = fromDateString(toStr)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** 持有天数：自然日差 + 1，购买当天记第 1 天，未来日期钳为 1 天。 */
function holdingDays(fromStr, toStr) {
  return Math.max(1, diffDays(fromStr, toStr) + 1)
}

function minDate(a, b) {
  return a <= b ? a : b
}

function maxDate(a, b) {
  return a >= b ? a : b
}

function clampToToday(dateStr, referenceDateStr) {
  return minDate(dateStr, referenceDateStr)
}

// ---- 展示 ----

function monthLabel(dateStr) {
  const match = DATE_RE.exec(String(dateStr || ''))
  return match ? Number(match[2]) + '月' : ''
}

function monthDayLabel(dateStr) {
  const match = DATE_RE.exec(String(dateStr || ''))
  return match ? Number(match[2]) + '月' + Number(match[3]) + '日' : ''
}

function fullDateLabel(dateStr) {
  const match = DATE_RE.exec(String(dateStr || ''))
  return match ? match[1] + '年' + Number(match[2]) + '月' + Number(match[3]) + '日' : ''
}

/** 近 N 个月的起始点（含当月），返回 'yyyy-MM-01' 数组，升序。 */
function recentMonthStarts(referenceDateStr, months) {
  const points = []
  for (let offset = months - 1; offset >= 0; offset--) {
    points.push(addMonths(startOfMonth(referenceDateStr), -offset))
  }
  return points
}

// ---- 与 iOS / macOS 端互导 ----

/** 'yyyy-MM-dd' -> 'yyyy-MM-ddT00:00:00Z'（与 ExportService 的 ISO8601 口径一致）。 */
function dateToISO(dateStr) {
  return String(dateStr || '') + 'T00:00:00Z'
}

/** 毫秒时间戳 -> ISO8601 字符串。 */
function timestampToISO(ts) {
  const date = ts ? new Date(ts) : new Date()
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** 从 ISO8601 字符串取 'yyyy-MM-dd' 部分；非法输入返回 null。 */
function dateFromISO(iso) {
  const str = String(iso || '')
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(str)
  return match && isValidDateString(match[1]) ? match[1] : null
}

module.exports = {
  DAY_MS,
  pad2,
  toDateString,
  fromDateString,
  isValidDateString,
  today,
  addDays,
  addMonths,
  daysInMonth,
  startOfMonth,
  endOfMonth,
  diffDays,
  holdingDays,
  minDate,
  maxDate,
  clampToToday,
  monthLabel,
  monthDayLabel,
  fullDateLabel,
  recentMonthStarts,
  dateToISO,
  timestampToISO,
  dateFromISO
}
