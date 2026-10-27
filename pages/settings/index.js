// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 设置页：数据概览、备份导入导出、默认排序偏好、清空数据、口径说明。
// 数据只存本机（wx.setStorageSync），导出为剪贴板文本 / 备份文件，与 iOS、macOS 端互通。
const transfer = require('../../utils/transfer.js')
const date = require('../../utils/date.js')
const money = require('../../utils/money.js')
const statistics = require('../../utils/statistics.js')
const backup = require('../../utils/backup.js')

Page({
  data: {
    overview: {
      totalCount: 0,
      inUseCount: 0,
      retiredCount: 0,
      soldCount: 0,
      wishCount: 0,
      recordCount: 0,
      totalPurchaseText: '¥0.00',
      totalDailyText: '¥0.00',
      wishBudgetText: '¥0.00'
    },
    backupText: '',
    backupStale: false,
    sortIndex: 0,
    sortTitles: statistics.sortTitles(),
    version: '',
    // 手动导入区：剪贴板不可用时（未授权 / 读取失败）的降级入口
    importOpen: false,
    importText: ''
  },

  onShow: function () {
    this.refresh()
  },

  refresh: function () {
    const repo = getApp().repo()
    const referenceDate = date.today()
    const all = repo.all()
    const summary = statistics.summary(all, referenceDate)
    const wish = statistics.wishlistSummary(all)
    const backupState = backup.label(getApp().prefs().lastBackupAt(), referenceDate)
    this.setData({
      overview: {
        totalCount: summary.totalCount,
        inUseCount: summary.inUseCount,
        retiredCount: summary.retiredCount,
        soldCount: summary.soldCount,
        wishCount: wish.count,
        recordCount: repo.count(),
        totalPurchaseText: money.formatMoney(summary.totalPurchaseCost),
        totalDailyText: money.formatMoney(money.round(summary.totalDailyCost)),
        wishBudgetText: money.formatMoney(wish.budget)
      },
      // 没有数据时不必催备份
      backupText: backupState.text,
      backupStale: backupState.stale && (summary.totalCount > 0 || wish.count > 0),
      sortIndex: statistics.sortIndex(getApp().prefs().defaultSort()),
      sortTitles: statistics.sortTitles(),
      version: getApp().version()
    })
  },

  // 导出成功后才记录备份时间，避免用户取消导出也被当成已备份。
  markBackedUp: function () {
    getApp().prefs().setLastBackupAt(Date.now())
    this.refresh()
  },

  // ---- 偏好 ----
  onSortChange: function (event) {
    const index = Number(event.detail.value) || 0
    const applied = getApp().prefs().setDefaultSort(statistics.SORT_OPTIONS[index].key)
    this.setData({ sortIndex: statistics.sortIndex(applied) })
    wx.showToast({ title: '默认排序已更新', icon: 'none' })
  },

  // ---- 导出 ----
  // 剪贴板写入属于微信隐私接口，写入前须确认已同意隐私保护指引；
  // 未获授权时引导改用「导出备份文件」（wx.shareFileMessage 不涉及隐私接口）。
  onExport: function () {
    const that = this
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
          that.markBackedUp()
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
        success: function () {
          that.markBackedUp()
        },
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
        that.refresh()
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
        that.refresh()
      }
    })
  }
})
