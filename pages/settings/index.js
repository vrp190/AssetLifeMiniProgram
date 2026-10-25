// 设置页：备份导入导出、演示数据、清空数据、口径说明。
// 数据只存本机（wx.setStorageSync），导出为剪贴板文本 / 备份文件，与 iOS、macOS 端互通。
const transfer = require('../../utils/transfer.js')
const date = require('../../utils/date.js')

Page({
  data: {
    totalCount: 0,
    hasDemo: false,
    todayText: '',
    version: '',
    // 手动导入区：剪贴板不可用时（未授权 / 读取失败）的降级入口
    importOpen: false,
    importText: ''
  },

  onShow: function () {
    const repo = getApp().repo()
    this.setData({
      totalCount: repo.count(),
      hasDemo: repo.hasDemo(),
      todayText: date.fullDateLabel(date.today()),
      version: getApp().version()
    })
  },

  // ---- 导出 ----
  // 剪贴板写入属于微信隐私接口，写入前须确认已同意隐私保护指引；
  // 未获授权时引导改用「导出备份文件」（wx.shareFileMessage 不涉及隐私接口）。
  onExport: function () {
    const repo = getApp().repo()
    const assets = repo.raw()
    if (!assets.length) {
      wx.showToast({ title: '还没有可导出的数据', icon: 'none' })
      return
    }
    const text = transfer.stringifyPayload(assets, Date.now())
    getApp().privacyOf().ensure(function (allowed) {
      if (!allowed) {
        wx.showModal({
          title: '需要剪贴板权限',
          content: '复制备份需要你先同意《用户隐私保护指引》。你也可以改用「导出备份文件」，通过微信会话发送备份。',
          showCancel: false
        })
        return
      }
      wx.setClipboardData({
        data: text,
        success: function () {
          wx.showModal({
            title: '备份已复制到剪贴板',
            content: '共 ' + assets.length + ' 条记录。可粘贴到备忘录 / 微信收藏保存，或在「导入」中粘贴恢复。三端（iOS / macOS / 小程序）备份格式互通。',
            showCancel: false,
            confirmText: '好的'
          })
        },
        fail: function () {
          wx.showToast({ title: '复制失败，请改用导出文件', icon: 'none' })
        }
      })
    })
  },

  onExportFile: function () {
    const that = this
    const repo = getApp().repo()
    const assets = repo.raw()
    if (!assets.length) {
      wx.showToast({ title: '还没有可导出的数据', icon: 'none' })
      return
    }
    const text = transfer.stringifyPayload(assets, Date.now())
    const fileName = transfer.suggestedFileName(Date.now())
    const fs = wx.getFileSystemManager()
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName
    try {
      fs.writeFileSync(filePath, text, 'utf8')
      wx.shareFileMessage({
        filePath: filePath,
        success: function () {},
        fail: function () {
          // 用户取消或环境不支持分享文件时，回退到剪贴板
          that.onExport()
        }
      })
    } catch (error) {
      that.onExport()
    }
  },

  // ---- 导入 ----
  // 统一流程：先取剪贴板内容（需隐私授权）→ 填入下方文本框供确认/修改 → 点「覆盖导入」生效。
  // 剪贴板不可用时，文本框仍可手动长按粘贴，保证功能不中断。
  onImport: function () {
    const that = this
    const open = function (text, hint) {
      that.setData({ importOpen: true, importText: text || '' })
      if (hint) wx.showToast({ title: hint, icon: 'none' })
    }

    getApp().privacyOf().ensure(function (allowed) {
      if (!allowed) {
        open('', '请手动粘贴备份内容')
        return
      }
      wx.getClipboardData({
        success: function (res) {
          const text = (res && res.data) || ''
          if (!text) {
            open('', '剪贴板为空，请手动粘贴')
            return
          }
          try {
            transfer.parsePayload(text)
          } catch (error) {
            // 内容不是本小程序的备份：仍然打开文本框，让用户自行替换
            open('', '剪贴板不是有效备份')
            return
          }
          open(text, '')
        },
        fail: function () {
          open('', '请手动粘贴备份内容')
        }
      })
    })
  },

  onImportText: function (event) {
    this.setData({ importText: (event && event.detail && event.detail.value) || '' })
  },

  onCloseImport: function () {
    this.setData({ importOpen: false, importText: '' })
  },

  // 执行导入：解析 → 二次确认 → 覆盖
  onConfirmImport: function () {
    const that = this
    const text = this.data.importText || ''
    if (!text.trim()) {
      wx.showToast({ title: '请先粘贴备份内容', icon: 'none' })
      return
    }
    let imported = null
    try {
      imported = transfer.parsePayload(text)
    } catch (error) {
      wx.showModal({
        title: '导入失败',
        content: error && error.message ? error.message : '备份内容无效',
        showCancel: false
      })
      return
    }
    wx.showModal({
      title: '导入 ' + imported.length + ' 条记录？',
      content: '导入将覆盖当前全部数据（共 ' + getApp().repo().count() + ' 条），此操作无法撤销。',
      confirmText: '覆盖导入',
      confirmColor: '#C74A4A',
      success: function (modalRes) {
        if (!modalRes.confirm) return
        getApp().repo().replaceAll(imported)
        that.setData({ importOpen: false, importText: '' })
        wx.showToast({ title: '导入成功', icon: 'success' })
        that.onShow()
      }
    })
  },

  // ---- 演示数据 ----
  onLoadDemo: function () {
    const that = this
    const repo = getApp().repo()
    if (repo.hasDemo()) {
      wx.showToast({ title: '演示数据已存在', icon: 'none' })
      return
    }
    wx.showModal({
      title: '载入演示数据？',
      content: '将写入 7 件资产 + 3 条心愿（带演示标记，可一键清除）。',
      success: function (res) {
        if (!res.confirm) return
        const count = repo.insertDemo(date.today())
        wx.showToast({ title: '已载入 ' + count + ' 条', icon: 'none' })
        that.onShow()
      }
    })
  },

  onRemoveDemo: function () {
    const that = this
    const repo = getApp().repo()
    wx.showModal({
      title: '清除演示数据？',
      content: '仅删除带演示标记的记录，你自己的数据不受影响。',
      success: function (res) {
        if (!res.confirm) return
        const removed = repo.removeDemo()
        wx.showToast({ title: '已清除 ' + removed + ' 条', icon: 'none' })
        that.onShow()
      }
    })
  },

  // ---- 危险操作 ----
  onClearAll: function () {
    const that = this
    const repo = getApp().repo()
    if (!repo.count()) {
      wx.showToast({ title: '当前没有数据', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清空全部数据？',
      content: '共 ' + repo.count() + ' 条记录将被删除，此操作无法撤销。建议先导出备份。',
      confirmText: '清空',
      confirmColor: '#C74A4A',
      success: function (res) {
        if (!res.confirm) return
        repo.clear()
        wx.showToast({ title: '已清空', icon: 'none' })
        that.onShow()
      }
    })
  }
})
