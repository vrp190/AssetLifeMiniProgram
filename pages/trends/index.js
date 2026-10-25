// 趋势统计页：月度购入柱状图 + 日均合计折线 + 分类分布 + 日均排行。
const statistics = require('../../utils/statistics.js')
const money = require('../../utils/money.js')
const date = require('../../utils/date.js')
const categories = require('../../utils/categories.js')

Page({
  data: {
    hasData: false,
    totalCount: 0,
    totalPurchaseText: '¥0.00',
    totalDailyText: '¥0.00',
    purchaseBars: [],
    dailyLine: [],
    categoryRows: [],
    ranking: [],
    empty: true
  },

  onShow: function () {
    this.refresh()
  },

  refresh: function () {
    const repo = getApp().repo()
    const today = date.today()
    const all = repo.all()
    const assets = all.filter(function (item) { return item.kind === 'asset' })
    const summary = statistics.summary(all, today)

    const monthly = statistics.monthlyPoints(all, 12, today)
    const purchaseBars = monthly.map(function (point) {
      return {
        label: date.monthLabel(point.monthStart),
        value: money.centsToYuan(point.monthlyPurchase),
        valueText: money.formatCompact(point.monthlyPurchase)
      }
    })
    const dailyLine = monthly.map(function (point) {
      return {
        label: date.monthLabel(point.monthStart),
        value: money.centsToYuan(point.dailyCostAsOf),
        valueText: money.formatCompact(point.dailyCostAsOf)
      }
    })

    const breakdown = statistics.categoryBreakdown(all)
    const maxCategory = breakdown.length ? breakdown[0].total : 0
    const categoryRows = breakdown.map(function (row) {
      return {
        category: row.category,
        icon: categories.iconFor(row.category),
        count: row.count,
        totalText: money.formatMoney(row.total),
        fraction: maxCategory > 0 ? (row.total / maxCategory) * 100 : 0
      }
    })

    const ranking = statistics.dailyCostRanking(all, today, 8).map(function (row) {
      return {
        id: row.id,
        icon: row.icon || categories.iconFor(row.category),
        name: row.name,
        dailyText: money.formatMoney(money.round(row.dailyCost)) + '/天'
      }
    })

    this.setData({
      empty: assets.length === 0,
      hasData: assets.length > 0,
      totalCount: summary.totalCount,
      totalPurchaseText: money.formatMoney(summary.totalPurchaseCost),
      totalDailyText: money.formatMoney(money.round(summary.totalDailyCost)),
      purchaseBars: purchaseBars,
      dailyLine: dailyLine,
      categoryRows: categoryRows,
      ranking: ranking
    })
  }
})
