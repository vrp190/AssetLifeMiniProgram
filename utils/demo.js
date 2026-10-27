// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 演示数据：与 iOS / macOS 端 DemoDataFactory 同一组数据（7 件资产 + 3 条心愿）。
// 明确标记 isDemoData，可在设置里一键清除；首次启动不会自动写入。

const model = require('./model.js')
const date = require('./date.js')

function makeAssets(referenceDateStr, nowMs) {
  function daysFromReference(days) {
    return date.addDays(referenceDateStr, days)
  }

  const raw = [
    {
      name: 'MacBook Air M4', yuan: 9499, days: -426, category: '数码', status: 'inUse',
      costMode: 'perDay', icon: '💻', notes: '主力办公本，日均约 22 元。', tags: ['苹果', '办公']
    },
    {
      name: '人体工学椅', yuan: 2180, days: -365, category: '家具', status: 'inUse',
      costMode: 'perDay', icon: '🪑', tags: ['久坐必备']
    },
    {
      name: '机械键盘 Keychron K8', yuan: 598, days: -233, category: '数码', status: 'inUse',
      costMode: 'perUse', useCount: 512, icon: '⌨️', notes: '按次计算：约 1.17 元/次。', tags: ['外设']
    },
    {
      name: '公路自行车', yuan: 4399, days: -198, category: '交通', status: 'inUse',
      costMode: 'perDay', icon: '🚲', notes: '通勤 + 周末骑行。', tags: ['运动', '通勤']
    },
    {
      name: '咖啡机', yuan: 1299, days: -96, category: '厨具', status: 'inUse',
      costMode: 'perDay', icon: '☕', tags: ['早晨仪式']
    },
    {
      name: '降噪耳机', yuan: 1899, days: -540, category: '数码', status: 'retired',
      costMode: 'perDay', icon: '🎧', notes: '已更换新耳机，旧机退役。'
    },
    {
      name: '旧显示器', yuan: 1599, days: -700, category: '数码', status: 'sold',
      costMode: 'perDay', icon: '🖥️', notes: '已卖出，购入成本仍计入历史总额。'
    }
  ]

  const wishes = [
    { name: '相机 Sony A7C2', yuan: 15800, days: 62, category: '数码', icon: '📷' },
    { name: '露营帐篷', yuan: 2380, days: 35, category: '运动', icon: '⛺' },
    { name: '电子书阅读器', yuan: 1099, days: 128, category: '数码', icon: '📚' }
  ]

  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  const assets = raw.map(function (item) {
    return model.createAsset({
      name: item.name,
      priceCents: item.yuan * 100,
      purchaseDate: daysFromReference(item.days),
      category: item.category,
      status: item.status,
      kind: 'asset',
      costMode: item.costMode,
      useCount: item.useCount || 0,
      icon: item.icon,
      notes: item.notes || '',
      tags: item.tags || [],
      isDemoData: true,
      createdAt: now,
      updatedAt: now,
      now: now
    })
  })

  wishes.forEach(function (item) {
    assets.push(model.createAsset({
      name: item.name,
      priceCents: item.yuan * 100,
      purchaseDate: daysFromReference(item.days),
      category: item.category,
      status: 'inUse',
      kind: 'wishlist',
      costMode: 'perDay',
      icon: item.icon,
      notes: '计划购入，尚未购买。',
      tags: ['心愿'],
      isDemoData: true,
      createdAt: now,
      updatedAt: now,
      now: now
    }))
  })

  return assets
}

module.exports = { makeAssets }
