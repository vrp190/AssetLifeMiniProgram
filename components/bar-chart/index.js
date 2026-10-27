// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 竖向柱状图：canvas 2d 自绘。
// items: [{ label, value, valueText }]
const device = require('../../utils/device.js')

Component({
  properties: {
    items: { type: Array, value: [] },
    color: { type: String, value: '#9BE52E' }
  },
  data: {
    empty: true
  },
  lifetimes: {
    attached: function () {
      this._ctx = null
      this._size = null
    },
    ready: function () {
      const that = this
      this.createSelectorQuery()
        .select('#canvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) return
          that._ctx = res[0].node.getContext('2d')
          that._size = { w: res[0].width, h: res[0].height, node: res[0].node }
          that.redraw()
        })
    }
  },
  observers: {
    items: function () {
      this.setData({ empty: !(this.data.items && this.data.items.length) })
      this.redraw()
    }
  },
  methods: {
    redraw: function () {
      if (!this._ctx || !this._size) return
      const ctx = this._ctx
      const dpr = device.pixelRatio()
      const node = this._size.node
      node.width = this._size.w * dpr
      node.height = this._size.h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const w = this._size.w
      const h = this._size.h
      ctx.clearRect(0, 0, w, h)

      const items = this.data.items || []
      if (!items.length) return

      const padTop = 20
      const padBottom = 20
      const plotH = h - padTop - padBottom
      const slot = w / items.length
      const barW = Math.min(slot * 0.5, 34)

      let max = 0
      items.forEach(function (item) { if (item.value > max) max = item.value })
      if (max <= 0) max = 1

      ctx.textAlign = 'center'
      items.forEach(function (item, i) {
        const cx = slot * i + slot / 2
        const barH = Math.max(3, (item.value / max) * plotH)
        const top = padTop + plotH - barH

        // 柱体（顶部圆角）
        const r = Math.min(5, barW / 2, barH / 2)
        ctx.beginPath()
        ctx.moveTo(cx - barW / 2, padTop + plotH)
        ctx.lineTo(cx - barW / 2, top + r)
        ctx.arcTo(cx - barW / 2, top, cx - barW / 2 + r, top, r)
        ctx.lineTo(cx + barW / 2 - r, top)
        ctx.arcTo(cx + barW / 2, top, cx + barW / 2, top + r, r)
        ctx.lineTo(cx + barW / 2, padTop + plotH)
        ctx.closePath()
        ctx.fillStyle = i === items.length - 1 ? '#4E7D12' : '#9BE52E'
        ctx.fill()

        // 数值
        ctx.fillStyle = '#171717'
        ctx.font = '600 10px sans-serif'
        ctx.textBaseline = 'bottom'
        if (items.length <= 8) {
          ctx.fillText(item.valueText || '', cx, top - 3)
        }

        // 底部标签
        ctx.fillStyle = '#8A8A8A'
        ctx.font = '10px sans-serif'
        ctx.textBaseline = 'bottom'
        const showEvery = items.length > 8 ? 2 : 1
        if (i % showEvery === 0 || i === items.length - 1) {
          ctx.fillText(item.label || '', cx, h - 2)
        }
      })
    }
  }
})
