// 金额工具。
//
// 设计约定（重要）：内部金额一律用「分」（整数 number）存储与计算，
// 避免浮点误差；只有在展示与导出时才转成「元」。
// 例外：日均成本 / 单次成本这类除法结果保留浮点（单位仍是「分」），
// 展示时四舍五入到两位小数——与原 iOS 端 Decimal 的结果在 2 位小数口径上一致。

/**
 * 归一化金额输入：容忍前后空格、千分位逗号（半角/全角）、人民币符号（半角/全角）。
 * 与 iOS 端 MoneyFormatter.parse 保持同一套宽松规则。
 */
function normalizeMoneyInput(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/，/g, '')
    .replace(/¥/g, '')
    .replace(/￥/g, '')
}

function isValidMoneyText(text) {
  const normalized = normalizeMoneyInput(text)
  if (!normalized) return false
  // 允许 "12"、"12."、"12.5"、".5" 这类常见输入，禁止符号、科学计数、多个小数点
  return /^\d*\.?\d*$/.test(normalized) && normalized !== '.'
}

/** 解析金额文本 -> 元（number）。非法输入返回 null。 */
function parseMoney(text) {
  if (!isValidMoneyText(text)) return null
  const value = Number(normalizeMoneyInput(text))
  if (!isFinite(value) || value < 0) return null
  return value
}

/** 元 -> 分（四舍五入到整数分）。 */
function yuanToCents(yuan) {
  if (yuan === null || yuan === undefined) return 0
  return Math.round(Number(yuan) * 100)
}

/** 分 -> 元（浮点）。 */
function centsToYuan(cents) {
  return (Number(cents) || 0) / 100
}

/** 元 -> 分，非法输入返回 null（用于表单）。 */
function parseMoneyToCents(text) {
  const yuan = parseMoney(text)
  return yuan === null ? null : yuanToCents(yuan)
}

function groupThousands(intPart) {
  return String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 分 -> '¥1,234.56'（固定两位小数）。nil 用 '—' 表示。 */
function formatMoney(cents) {
  if (cents === null || cents === undefined || !isFinite(cents)) return '—'
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const yuan = Math.floor(abs / 100)
  const rest = abs % 100
  const text = groupThousands(yuan) + '.' + (rest < 10 ? '0' + rest : String(rest))
  return (negative ? '-¥' : '¥') + text
}

/** 分 -> '1,234.56'（不带货币符号，用于表单回填与紧凑场景）。 */
function formatPlain(cents) {
  if (cents === null || cents === undefined || !isFinite(cents)) return '—'
  const yuan = Math.floor(Math.abs(Math.round(cents)) / 100)
  const rest = Math.abs(Math.round(cents)) % 100
  return groupThousands(yuan) + '.' + (rest < 10 ? '0' + rest : String(rest))
}

/** 精简金额：小于 100 元保留两位，大于等于 100 元取整，用于图表标签与卡片副标题。 */
function formatCompact(cents) {
  if (cents === null || cents === undefined || !isFinite(cents)) return '—'
  if (Math.abs(cents) >= 10000) return groupThousands(Math.round(cents / 100))
  if (Math.abs(cents) >= 1000) return (Math.round(cents) / 100).toFixed(1)
  return (Math.round(cents) / 100).toFixed(2)
}

/** 分 -> '1234.56'（导出专用的纯数字字符串，保留精度）。 */
function centsToYuanString(cents) {
  if (cents === null || cents === undefined) return '0'
  return (Math.round(cents) / 100).toFixed(2)
}

/** '1234.56' -> 分。非法输入返回 null。 */
function centsFromYuanString(text) {
  if (!isValidMoneyText(text)) return null
  return yuanToCents(Number(normalizeMoneyInput(text)))
}

/** 四舍五入到指定小数位（默认 2 位）。 */
function round(value, scale) {
  const digits = scale === undefined ? 2 : scale
  const factor = Math.pow(10, digits)
  const rounded = Math.round(Number(value) * factor) / factor
  return rounded
}

module.exports = {
  normalizeMoneyInput,
  isValidMoneyText,
  parseMoney,
  yuanToCents,
  centsToYuan,
  parseMoneyToCents,
  formatMoney,
  formatPlain,
  formatCompact,
  centsToYuanString,
  centsFromYuanString,
  round
}
