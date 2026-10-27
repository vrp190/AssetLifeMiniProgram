// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 资产 / 心愿详情：成本明细 + 趋势图 + 状态管理 + 删除。
const money = require('../../utils/money.js')
const date = require('../../utils/date.js')
const cost = require('../../utils/cost.js')
const trend = require('../../utils/trend.js')
const categories = require('../../utils/categories.js')
const model = require('../../utils/model.js')

Page({
  data: {
    notFound: false,
    isWish: false,
    icon: '📦',
    name: '',
    categoryLabel: '',
    status: '',
    statusText: '',
    purchaseLabel: '',
    holdingDaysText: '',
    priceText: '',
    dailyText: '',
    dailyCaption: '日均成本',
    targetText: '',
    notes: '',
    tags: [],
    createdLabel: '',
    trendPoints: [],
    hasTrend: false,
    trendGranularityLabel: ''
  },

  onLoad: function (query) {
    this._id = query && query.id ? query.id : ''
  },

  onShow: function () {
    this.refresh()
  },

  refresh: function () {
    const repo = getApp().repo()
    const asset = repo.byId(this._id)
    if (!asset) {
      this.setData({ notFound: true })
      return
    }
    const today = date.today()
    const isWish = asset.kind === 'wishlist'
    const days = cost.holdingDays(asset.purchaseDate, today)
    const eff = cost.effectiveDailyCost(asset, today)
    const target = cost.resolvedTargetDailyCost(asset)

    let dailyCaption = '日均成本'
    if (asset.costMode === 'perUse') dailyCaption = '单次成本'
    if (asset.costMode === 'custom') dailyCaption = '自定义日均'
    if (isWish) dailyCaption = '心愿价'

    const dailyText = isWish
      ? money.formatMoney(asset.priceCents)
      : (eff === null ? '—' : money.formatMoney(money.round(eff)))

    // 趋势：仅按天模式的正式资产
    let trendPoints = []
    if (!isWish) {
      const points = trend.series(asset, today)
      const monthly = points.length > 0 && points[0].date.length === 7
      trendPoints = points.map(function (p) {
        const label = monthly ? date.monthLabel(p.date) : date.monthDayLabel(p.date)
        return {
          label: label,
          value: money.centsToYuan(p.dailyCost),
          valueText: money.formatPlain(money.round(p.dailyCost))
        }
      })
      this.setData({
        trendPoints: trendPoints,
        hasTrend: trendPoints.length > 0,
        trendGranularityLabel: monthly ? '按月采样' : '按天采样'
      })
    }

    this.setData({
      notFound: false,
      isWish: isWish,
      icon: asset.icon || categories.iconFor(asset.category),
      name: asset.name,
      categoryLabel: categories.displayCategory(asset.category),
      status: asset.status,
      statusText: isWish ? '心愿' : model.STATUS_TITLES[asset.status],
      purchaseLabel: date.fullDateLabel(asset.purchaseDate),
      holdingDaysText: isWish ? '尚未购入' : '已持有 ' + days + ' 天',
      priceText: money.formatMoney(asset.priceCents),
      dailyText: dailyText,
      dailyCaption: dailyCaption,
      targetText: target === null ? '' : '目标：' + money.formatMoney(money.round(target)) + '/天',
      notes: asset.notes,
      tags: asset.tags,
      createdLabel: '记录于 ' + date.fullDateLabel(date.toDateString(new Date(asset.createdAt)))
    })
  },

  onEdit: function () {
    const asset = getApp().repo().byId(this._id)
    if (!asset) return
    getApp().globalData.pendingAsset = asset
    wx.navigateTo({ url: '/pages/edit/index?mode=edit' })
  },

  onStatusChange: function () {
    const that = this
    const repo = getApp().repo()
    const asset = repo.byId(this._id)
    if (!asset) return
    wx.showActionSheet({
      itemList: ['设为使用中', '设为已退役', '设为已卖出'],
      success: function (res) {
        const keys = ['inUse', 'retired', 'sold']
        repo.update({ id: asset.id, status: keys[res.tapIndex] })
        that.refresh()
      }
    })
  },

  onConvert: function () {
    const that = this
    const repo = getApp().repo()
    const asset = repo.byId(this._id)
    if (!asset) return
    wx.showModal({
      title: '标记为已购入？',
      content: '「' + asset.name + '」将转为正式资产，购买日期记为今天，开始计算日均成本。',
      confirmText: '已购入',
      success: function (res) {
        if (!res.confirm) return
        repo.update({
          id: asset.id,
          kind: 'asset',
          purchaseDate: date.today(),
          costMode: 'perDay',
          targetMode: 'none',
          tags: asset.tags.indexOf('心愿') >= 0
            ? asset.tags.filter(function (tag) { return tag !== '心愿' })
            : asset.tags
        })
        wx.showToast({ title: '已转为资产', icon: 'success' })
        that.refresh()
      }
    })
  },

  onDelete: function () {
    const that = this
    const repo = getApp().repo()
    const asset = repo.byId(this._id)
    if (!asset) return
    wx.showModal({
      title: '删除「' + asset.name + '」？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#C74A4A',
      success: function (res) {
        if (!res.confirm) return
        repo.remove(asset.id)
        wx.showToast({ title: '已删除', icon: 'success', duration: 600 })
        setTimeout(function () { wx.navigateBack() }, 420)
      }
    })
  }
})
