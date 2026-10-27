// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 资产卡片：纯展示组件，所有字段由页面预先格式化好再传入。
// 注意：事件名用 select / action，避免与原生 tap / longpress 冲突导致双触发。
Component({
  properties: {
    icon: { type: String, value: '📦' },
    name: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    status: { type: String, value: '' },        // inUse | retired | sold | ''
    statusText: { type: String, value: '' },
    moneyText: { type: String, value: '' },     // 右侧主金额（已格式化）
    moneyCaption: { type: String, value: '' }   // 右侧副标题
  },
  methods: {
    onTap: function () {
      this.triggerEvent('select')
    },
    onLongPress: function () {
      this.triggerEvent('action')
    }
  }
})
