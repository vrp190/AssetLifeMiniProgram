// 备份提醒文案：把「最近一次成功导出」的时间戳转成设置页展示的文字与提醒状态。
const date = require('./date.js')

/** 超过这个天数就提醒用户导出备份。 */
const STALE_DAYS = 30

/**
 * @param {number} timestamp 毫秒时间戳；0 表示从未备份
 * @param {string} referenceDate 参照日 'yyyy-MM-dd'
 * @returns {{text: string, stale: boolean}}
 */
function label(timestamp, referenceDate) {
  if (!timestamp) return { text: '尚未导出过备份', stale: true }
  const days = date.diffDays(date.toDateString(new Date(timestamp)), referenceDate)
  if (days <= 0) return { text: '上次导出：今天', stale: false }
  if (days >= STALE_DAYS) {
    return { text: '上次导出：' + days + ' 天前，建议尽快备份', stale: true }
  }
  return { text: '上次导出：' + days + ' 天前', stale: false }
}

module.exports = { STALE_DAYS, label }
