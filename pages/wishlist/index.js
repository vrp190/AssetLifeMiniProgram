// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 心愿清单页：想买的东西、预算合计、长按管理。
const money = require('../../utils/money.js')
const date = require('../../utils/date.js')
const categories = require('../../utils/categories.js')
const model = require('../../utils/model.js')

function toCard(asset) {
  const parts = [categories.displayCategory(asset.category)]
  if (asset.targetMode === 'byDate' && asset.targetDate) {
    parts.push('目标 ' + date.monthLabel(asset.targetDate))
  }
  if (asset.tags.length) parts.push(asset.tags.slice(0, 2).join(' / '))
  return {
    id: asset.id,
    icon: asset.icon || categories.iconFor(asset.category),
    name: asset.name,
    subtitle: parts.join(' · '),
    status: '',
    statusText: '',
    moneyText: money.formatMoney(asset.priceCents),
    moneyCaption: '心愿价'
  }
}

Page({
  data: {
    cards: [],
    isEmpty: false,
    count: 0,
    budgetText: '¥0.00'
  },

  onShow: function () {
    this.refresh()
  },

  refresh: function () {
    const repo = getApp().repo()
    const wishes = repo.byKind('wishlist')
    let budget = 0
    wishes.forEach(function (item) { budget += item.priceCents })
    this.setData({
      cards: wishes.map(toCard),
      isEmpty: wishes.length === 0,
      count: wishes.length,
      budgetText: money.formatMoney(budget)
    })
  },

  onCardTap: function (event) {
    const id = event.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/detail/index?id=' + id })
  },

  onCardLongPress: function (event) {
    const that = this
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: function (res) {
        const asset = getApp().repo().byId(id)
        if (!asset) return
        if (res.tapIndex === 0) {
          getApp().globalData.pendingAsset = asset
          wx.navigateTo({ url: '/pages/edit/index?mode=edit' })
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '删除「' + asset.name + '」？',
            content: '删除后无法恢复。',
            confirmText: '删除',
            confirmColor: '#C74A4A',
            success: function (modalRes) {
              if (modalRes.confirm) {
                getApp().repo().remove(id)
                that.refresh()
              }
            }
          })
        }
      }
    })
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/edit/index?mode=new&kind=wishlist' })
  }
})
