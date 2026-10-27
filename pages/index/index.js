// 资产总览页：汇总统计 + 筛选搜索排序 + 资产卡片列表。
const statistics = require('../../utils/statistics.js')
const money = require('../../utils/money.js')
const date = require('../../utils/date.js')
const cost = require('../../utils/cost.js')
const categories = require('../../utils/categories.js')
const model = require('../../utils/model.js')

const FILTER_ITEMS = [
  { key: '', title: '全部' },
  { key: 'inUse', title: '使用中' },
  { key: 'retired', title: '已退役' },
  { key: 'sold', title: '已卖出' }
]

function toCard(asset, referenceDateStr) {
  const isWish = asset.kind === 'wishlist'
  const eff = cost.effectiveDailyCost(asset, referenceDateStr)
  let moneyCaption = '日均'
  if (asset.costMode === 'perUse') moneyCaption = '单次'
  if (asset.costMode === 'custom') moneyCaption = '自定义日均'
  const parts = [categories.displayCategory(asset.category), date.monthDayLabel(asset.purchaseDate)]
  if (asset.tags.length) parts.push(asset.tags.slice(0, 2).join(' / '))
  return {
    id: asset.id,
    icon: asset.icon || categories.iconFor(asset.category),
    name: asset.name,
    subtitle: parts.join(' · '),
    status: asset.status,
    statusText: model.STATUS_TITLES[asset.status] || '',
    moneyText: eff === null ? money.formatMoney(asset.priceCents) : money.formatMoney(money.round(eff)),
    moneyCaption: eff === null ? '购入价' : moneyCaption,
    purchaseDate: asset.purchaseDate
  }
}

Page({
  data: {
    referenceDate: '',
    searchText: '',
    statusFilter: '',
    sortIndex: 0,
    sortTitles: statistics.sortTitles(),
    filterItems: FILTER_ITEMS,
    cards: [],
    isEmpty: false,
    hasAny: false,
    summary: {
      totalPurchaseText: '¥0.00',
      totalDailyText: '¥0.00',
      totalCount: 0
    },
    statusBar: []
  },

  onShow: function () {
    this.setData({
      referenceDate: date.today(),
      sortIndex: statistics.sortIndex(getApp().prefs().defaultSort())
    })
    this.refresh()
  },

  refresh: function () {
    const repo = getApp().repo()
    const referenceDate = this.data.referenceDate || date.today()
    const all = repo.all()
    const assets = all.filter(function (item) { return item.kind === 'asset' })
    const summary = statistics.summary(all, referenceDate)
    const visible = statistics.visibleAssets(assets, {
      searchText: this.data.searchText,
      statusFilter: this.data.statusFilter,
      sort: statistics.SORT_OPTIONS[this.data.sortIndex].key
    }, referenceDate)

    const total = summary.totalCount || 1
    const statusBar = [
      { key: 'inUse', count: summary.inUseCount, fraction: (summary.inUseCount / total) * 100, cls: 'seg-inUse' },
      { key: 'retired', count: summary.retiredCount, fraction: (summary.retiredCount / total) * 100, cls: 'seg-retired' },
      { key: 'sold', count: summary.soldCount, fraction: (summary.soldCount / total) * 100, cls: 'seg-sold' }
    ]

    this.setData({
      hasAny: assets.length > 0,
      isEmpty: visible.length === 0,
      cards: visible.map(function (item) { return toCard(item, referenceDate) }),
      summary: {
        totalPurchaseText: money.formatMoney(summary.totalPurchaseCost),
        totalDailyText: money.formatMoney(money.round(summary.totalDailyCost)),
        totalCount: summary.totalCount
      },
      statusBar: statusBar
    })
  },

  onSearchInput: function (event) {
    this.setData({ searchText: event.detail.value })
    this.refresh()
  },

  onSearchClear: function () {
    this.setData({ searchText: '' })
    this.refresh()
  },

  onFilterChange: function (event) {
    this.setData({ statusFilter: event.detail.key })
    this.refresh()
  },

  onSortChange: function (event) {
    const sortIndex = Number(event.detail.value) || 0
    this.setData({ sortIndex: sortIndex })
    getApp().prefs().setDefaultSort(statistics.SORT_OPTIONS[sortIndex].key)
    this.refresh()
  },

  onTapCard: function (event) {
    const id = event.currentTarget.dataset.id || event.detail.id
    const card = event.currentTarget.dataset.id ? this.findCard(event.currentTarget.dataset.id) : null
    if (!card) return
    wx.navigateTo({ url: '/pages/detail/index?id=' + card.id })
  },

  findCard: function (id) {
    const list = this.data.cards
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i]
    }
    return null
  },

  onCardTap: function (event) {
    // asset-card 组件触发的事件，id 挂在当前节点 dataset 上
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
        if (res.tapIndex === 0) {
          that.startEdit(id)
        } else if (res.tapIndex === 1) {
          that.confirmRemove(id)
        }
      }
    })
  },

  startEdit: function (id) {
    const asset = getApp().repo().byId(id)
    if (!asset) return
    getApp().globalData.pendingAsset = asset
    wx.navigateTo({ url: '/pages/edit/index?mode=edit' })
  },

  confirmRemove: function (id) {
    const that = this
    const asset = getApp().repo().byId(id)
    if (!asset) return
    wx.showModal({
      title: '删除「' + asset.name + '」？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#C74A4A',
      success: function (res) {
        if (res.confirm) {
          getApp().repo().remove(id)
          that.refresh()
        }
      }
    })
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/edit/index?mode=new&kind=asset' })
  }
})
