// 新增 / 编辑资产或心愿。
// 从列表 / 心愿页进入：?mode=new&kind=asset|wishlist 或 ?mode=edit（对象经 globalData.pendingAsset 传入）。
const categories = require('../../utils/categories.js')
const validator = require('../../utils/validator.js')
const model = require('../../utils/model.js')
const date = require('../../utils/date.js')

const STATUS_TITLES = ['使用中', '已退役', '已卖出']
const STATUS_KEYS = ['inUse', 'retired', 'sold']
const COST_MODES = ['perDay', 'perUse', 'custom']
const COST_MODE_TITLES = ['按天计算', '按次计算', '自定义金额']
const TARGET_MODES = ['none', 'byDate', 'custom']
const TARGET_MODE_TITLES = ['不设置', '按目标日期', '自定义金额']

Page({
  data: {
    isEdit: false,
    today: '',
    kind: 'asset',
    name: '',
    priceText: '',
    purchaseDate: '',
    categoryNames: categories.names(),
    categoryIndex: 0,
    statusTitles: STATUS_TITLES,
    statusIndex: 0,
    costMode: 'perDay',
    costModeTitles: COST_MODE_TITLES,
    useCountText: '',
    notes: '',
    tagsText: '',
    targetModeIndex: 0,
    targetModeTitles: TARGET_MODE_TITLES,
    targetValueText: '',
    targetDate: '',
    errors: [],
    saving: false
  },

  onLoad: function (query) {
    const app = getApp()
    const todayStr = date.today()
    const mode = query && query.mode === 'edit' ? 'edit' : 'new'
    const asset = mode === 'edit' ? app.globalData.pendingAsset : null
    const kind = asset
      ? asset.kind
      : (query && query.kind === 'wishlist' ? 'wishlist' : 'asset')

    let form = null
    if (asset) {
      form = validator.toForm(asset, todayStr)
      app.globalData.pendingAsset = null
    } else {
      form = {
        name: '',
        priceText: '',
        purchaseDate: todayStr,
        category: '数码',
        status: 'inUse',
        kind: kind,
        costMode: 'perDay',
        useCountText: '',
        icon: '',
        notes: '',
        tags: [],
        targetMode: 'none',
        targetValueText: '',
        targetDate: todayStr
      }
    }

    this.setData({
      isEdit: mode === 'edit',
      today: todayStr,
      kind: form.kind,
      name: form.name,
      priceText: form.priceText,
      purchaseDate: form.purchaseDate,
      categoryIndex: Math.max(0, categories.names().indexOf(form.category)),
      statusIndex: Math.max(0, STATUS_KEYS.indexOf(form.status)),
      costMode: form.costMode,
      useCountText: form.useCountText,
      notes: form.notes,
      tagsText: (form.tags || []).join('，'),
      targetModeIndex: Math.max(0, TARGET_MODES.indexOf(form.targetMode)),
      targetValueText: form.targetValueText,
      targetDate: form.targetDate || todayStr,
      errors: []
    })
    if (asset) {
      this._editingId = asset.id
      this._createdAt = asset.createdAt
      this._originalIcon = asset.icon || ''
    }
    wx.setNavigationBarTitle({
      title: (this.data.isEdit ? '编辑' : '新增') + (kind === 'wishlist' ? '心愿' : '资产')
    })
  },

  // ---- 输入 ----
  onName: function (event) { this.setData({ name: event.detail.value }) },
  onPrice: function (event) { this.setData({ priceText: event.detail.value }) },
  onUseCount: function (event) { this.setData({ useCountText: event.detail.value }) },
  onNotes: function (event) { this.setData({ notes: event.detail.value }) },
  onTags: function (event) { this.setData({ tagsText: event.detail.value }) },
  onTargetValue: function (event) { this.setData({ targetValueText: event.detail.value }) },

  onKindChange: function (event) {
    this.setData({ kind: Number(event.currentTarget.dataset.index) === 1 ? 'wishlist' : 'asset' })
  },
  onCostModeChange: function (event) {
    this.setData({ costMode: COST_MODES[Number(event.currentTarget.dataset.index)] })
  },
  onCategoryChange: function (event) {
    this.setData({ categoryIndex: Number(event.detail.value) || 0 })
  },
  onStatusChange: function (event) {
    this.setData({ statusIndex: Number(event.detail.value) || 0 })
  },
  onPurchaseDateChange: function (event) {
    this.setData({ purchaseDate: event.detail.value })
  },
  onTargetDateChange: function (event) {
    this.setData({ targetDate: event.detail.value })
  },
  onTargetModeChange: function (event) {
    this.setData({ targetModeIndex: Number(event.detail.value) || 0 })
  },

  // ---- 保存 / 删除 ----
  buildForm: function () {
    return {
      name: this.data.name,
      priceText: this.data.priceText,
      purchaseDate: this.data.purchaseDate,
      kind: this.data.kind,
      category: this.data.categoryNames[this.data.categoryIndex],
      status: STATUS_KEYS[this.data.statusIndex],
      costMode: this.data.costMode,
      useCountText: this.data.useCountText,
      icon: this.data.icon || '',
      notes: this.data.notes,
      tags: this.data.tagsText,
      targetMode: TARGET_MODES[this.data.targetModeIndex],
      targetValueText: this.data.targetValueText,
      targetDate: this.data.targetDate
    }
  },

  currentIcon: function () {
    // 编辑时保留原有图标（演示数据带专属 emoji）；新增时跟随分类
    if (this._originalIcon) return this._originalIcon
    return categories.iconFor(this.data.categoryNames[this.data.categoryIndex])
  },

  onSave: function () {
    if (this.data.saving) return
    const app = getApp()
    const result = validator.validate(this.buildForm(), this.data.today)
    if (!result.valid) {
      this.setData({ errors: result.messages })
      wx.showToast({ title: result.messages[0], icon: 'none' })
      return
    }
    const fields = validator.toAssetFields(this.buildForm())
    fields.icon = this.currentIcon()
    fields.now = Date.now()
    const repo = app.repo()

    if (this.data.isEdit && this._editingId) {
      fields.id = this._editingId
      fields.createdAt = this._createdAt
      repo.update(fields)
    } else {
      repo.add(fields)
    }
    this.setData({ saving: true })
    wx.showToast({ title: '已保存', icon: 'success', duration: 600 })
    setTimeout(function () {
      wx.navigateBack()
    }, 420)
  },

  _editingId: null,
  _createdAt: null,
  _originalIcon: ''
})
