// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 AssetLife contributors

// 折线 / 面积趋势图：canvas 2d 自绘，零第三方依赖。
// points: [{ label, value, valueText }] —— value 用于定位（元），valueText 用于标注。
const device = require('../../utils/device.js')

Component({
  properties: {
    points: { type: Array, value: [] },
    color: { type: String, value: '#4E7D12' }
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
    points: function () {
      this.setData({ empty: !(this.data.points && this.data.points.length >= 1) })
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

      const points = this.data.points || []
      if (points.length < 1) return

      const padTop = 26
      const padBottom = 22
      const padX = 10
      const plotW = w - padX * 2
      const plotH = h - padTop - padBottom

      let lo = Infinity
      let hi = -Infinity
      points.forEach(function (p) {
        if (p.value < lo) lo = p.value
        if (p.value > hi) hi = p.value
      })
      if (hi - lo < 1e-9) {
        lo = hi * 0.9
        hi = hi * 1.1 + 1
      } else {
        const span = hi - lo
        lo = lo - span * 0.08
        hi = hi + span * 0.08
      }

      function xPos(i) {
        return points.length === 1 ? padX + plotW / 2 : padX + (plotW * i) / (points.length - 1)
      }
      function yPos(v) {
        return padTop + (1 - (v - lo) / (hi - lo)) * plotH
      }

      const color = this.data.color

      // 面积渐变
      if (points.length >= 2) {
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH)
        gradient.addColorStop(0, hexToRGBA(color, 0.28))
        gradient.addColorStop(1, hexToRGBA(color, 0.02))
        ctx.beginPath()
        ctx.moveTo(xPos(0), padTop + plotH)
        points.forEach(function (p, i) { ctx.lineTo(xPos(i), yPos(p.value)) })
        ctx.lineTo(xPos(points.length - 1), padTop + plotH)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()

        ctx.beginPath()
        points.forEach(function (p, i) {
          if (i === 0) ctx.moveTo(xPos(i), yPos(p.value))
          else ctx.lineTo(xPos(i), yPos(p.value))
        })
        ctx.strokeStyle = color
        ctx.lineWidth = 2.2
        ctx.lineJoin = 'round'
        ctx.stroke()
      }

      // 端点 / 单点
      const showDots = points.length <= 14 || points.length < 2
      if (showDots) {
        points.forEach(function (p, i) {
          ctx.beginPath()
          ctx.arc(xPos(i), yPos(p.value), 2.6, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1.4
          ctx.stroke()
        })
      }

      // 顶部标注最大值
      ctx.fillStyle = '#171717'
      ctx.font = '600 11px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(points.reduce(function (a, b) { return b.value > a.value ? b : a }).valueText || '', padX, 2)

      // 底部标签：首 / 中 / 尾
      ctx.fillStyle = '#8A8A8A'
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'bottom'
      const n = points.length
      const idx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1]
      idx.forEach(function (i, order) {
        let align = 'center'
        if (n > 1 && order === 0) align = 'left'
        if (n > 1 && order === 2) align = 'right'
        ctx.textAlign = align
        ctx.fillText(points[i].label, xPos(i), h - 2)
      })
    }
  }
})

function hexToRGBA(hex, alpha) {
  const value = String(hex).replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}
