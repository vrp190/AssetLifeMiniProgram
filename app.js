// 格物 AssetLife · 微信小程序版
// 与 iOS / macOS 端同一套业务口径：
//   - 金额以「分」为整数存储，展示时转「元」；
//   - 自然日以 'yyyy-MM-dd' 字符串表示；
//   - 日均成本 = 购入价 ÷ 持有天数（当天按 1 天）。
// 数据全部保存在本机（wx.setStorageSync），不联网、不上传、不收集任何用户信息。

const repository = require('./utils/repository.js')
const storage = require('./utils/storage.js')
const privacy = require('./utils/privacy.js')

// 提审版本号：与开发者工具上传时填写的版本保持一致
var VERSION = '1.0.0'

App({
  globalData: {
    repo: null,
    privacy: null,
    // 跨页传递编辑对象的临时区（小程序页面间传复杂对象最稳妥的方式）
    pendingAsset: null,
    pendingKind: 'asset'
  },

  onLaunch: function () {
    this.globalData.repo = repository.createRepository(storage.createWXStorage(), {})
    this.globalData.privacy = privacy.createPrivacy()
  },

  repo: function () {
    if (!this.globalData.repo) {
      this.globalData.repo = repository.createRepository(storage.createWXStorage(), {})
    }
    return this.globalData.repo
  },

  /** 隐私授权检查器（剪贴板读写的统一入口） */
  privacyOf: function () {
    if (!this.globalData.privacy) {
      this.globalData.privacy = privacy.createPrivacy()
    }
    return this.globalData.privacy
  },

  /** 版本号，设置页「关于」展示 */
  version: function () {
    return VERSION
  },

  referenceDate: function () {
    const dateUtil = require('./utils/date.js')
    return dateUtil.today()
  }
})
