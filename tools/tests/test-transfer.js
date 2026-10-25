// 导出 / 导入：结构与 iOS / macOS 端 ExportService 互通。
module.exports = function (ctx) {
  const transfer = ctx.require('transfer.js')
  const model = ctx.require('model.js')
  const test = ctx.test
  const equal = ctx.equal
  const assert = ctx.assert
  const throws = ctx.throws

  const NOW = 1718409600000

  function sample() {
    return [
      model.createAsset({
        name: 'MacBook Air M4',
        priceCents: 949900,
        purchaseDate: '2024-06-15',
        category: '数码',
        status: 'inUse',
        costMode: 'perUse',
        useCount: 512,
        icon: '💻',
        notes: '测试',
        tags: ['苹果', '办公'],
        targetMode: 'custom',
        targetValueCents: 250,
        isDemoData: false,
        now: NOW
      })
    ]
  }

  test('导出结构含版本号与条数', function () {
    const payload = transfer.makePayload(sample(), NOW)
    equal(payload.app, 'AssetLife', 'app')
    equal(payload.formatVersion, 1, '版本')
    equal(payload.assetCount, 1, '条数')
    equal(payload.assets[0].price, '9499.00', '金额为元字符串')
    equal(payload.assets[0].purchaseDate, '2024-06-15T00:00:00Z', 'ISO 日期')
  })

  test('JSON 往返不丢字段', function () {
    const text = transfer.stringifyPayload(sample(), NOW)
    const roundTrip = transfer.parsePayload(text)
    equal(roundTrip.length, 1, '条数')
    equal(roundTrip[0].name, 'MacBook Air M4', '名称')
    equal(roundTrip[0].priceCents, 949900, '价格')
    equal(roundTrip[0].purchaseDate, '2024-06-15', '日期')
    equal(roundTrip[0].costMode, 'perUse', '模式')
    equal(roundTrip[0].useCount, 512, '次数')
    equal(roundTrip[0].tags.length, 2, '标签数')
    equal(roundTrip[0].targetValueCents, 250, '目标金额')
    equal(roundTrip[0].icon, '💻', '图标')
  })

  test('兼容 iOS / macOS 导出的备份文件', function () {
    const iosExport = JSON.stringify({
      app: 'AssetLife',
      formatVersion: 1,
      exportedAt: '2024-06-15T08:00:00Z',
      assetCount: 1,
      assets: [
        {
          id: '3F7B0E12-3D4C-4C1F-9E2A-111111111111',
          name: '人体工学椅',
          price: '2180',
          purchaseDate: '2024-06-15T00:00:00Z',
          category: '家具',
          status: 'inUse',
          kind: 'asset',
          costMode: 'perDay',
          useCount: 0,
          iconName: 'bed.double.fill',
          notes: '',
          tags: ['久坐必备'],
          createdAt: '2024-06-15T08:00:00Z',
          updatedAt: '2024-06-15T08:00:00Z',
          targetMode: 'none',
          targetValue: null,
          targetDate: null,
          isDemoData: false
        }
      ]
    })
    const imported = transfer.parsePayload(iosExport)
    equal(imported.length, 1, '条数')
    equal(imported[0].priceCents, 218000, '价格')
    equal(imported[0].purchaseDate, '2024-06-15', '日期')
    equal(imported[0].icon, 'bed.double.fill', 'SF Symbol 名在小程序端按原样保留')
  })

  test('坏 JSON → invalidJSON', function () {
    throws(function () { transfer.parsePayload('not json') }, 'invalidJSON', '坏 JSON')
  })

  test('版本不符 → unsupportedVersion', function () {
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 99, assets: [{ id: '1', name: 'x', price: '1', purchaseDate: '2024-06-15T00:00:00Z', status: 'inUse', kind: 'asset', costMode: 'perDay', useCount: 0 }] })
    throws(function () { transfer.parsePayload(text) }, 'unsupportedVersion', '版本')
  })

  test('空数据 → emptyPayload', function () {
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [] })
    throws(function () { transfer.parsePayload(text) }, 'emptyPayload', '空')
  })

  test('缺少名称 → missingField', function () {
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [{ id: '1', name: '  ', price: '1', purchaseDate: '2024-06-15T00:00:00Z', status: 'inUse', kind: 'asset', costMode: 'perDay', useCount: 0 }] })
    throws(function () { transfer.parsePayload(text) }, 'missingField', '缺 name')
  })

  test('负价格 → invalidValue', function () {
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [{ id: '1', name: 'x', price: '-5', purchaseDate: '2024-06-15T00:00:00Z', status: 'inUse', kind: 'asset', costMode: 'perDay', useCount: 0 }] })
    throws(function () { transfer.parsePayload(text) }, 'invalidValue', '负价')
  })

  test('坏日期 → invalidValue', function () {
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [{ id: '1', name: 'x', price: '1', purchaseDate: '昨天', status: 'inUse', kind: 'asset', costMode: 'perDay', useCount: 0 }] })
    throws(function () { transfer.parsePayload(text) }, 'invalidValue', '坏日期')
  })

  test('重复 ID → invalidValue', function () {
    const item = { id: 'same', name: 'x', price: '1', purchaseDate: '2024-06-15T00:00:00Z', status: 'inUse', kind: 'asset', costMode: 'perDay', useCount: 0 }
    const text = JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [item, item] })
    throws(function () { transfer.parsePayload(text) }, 'invalidValue', '重复 id')
  })

  test('非法状态 / 类型 / 模式 → invalidValue', function () {
    const base = { id: '1', name: 'x', price: '1', purchaseDate: '2024-06-15T00:00:00Z', useCount: 0 }
    throws(function () {
      transfer.parsePayload(JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [Object.assign({}, base, { status: 'broken', kind: 'asset', costMode: 'perDay' })] }))
    }, 'invalidValue', 'status')
    throws(function () {
      transfer.parsePayload(JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [Object.assign({}, base, { status: 'inUse', kind: 'broken', costMode: 'perDay' })] }))
    }, 'invalidValue', 'kind')
    throws(function () {
      transfer.parsePayload(JSON.stringify({ app: 'AssetLife', formatVersion: 1, assets: [Object.assign({}, base, { status: 'inUse', kind: 'asset', costMode: 'broken' })] }))
    }, 'invalidValue', 'costMode')
  })

  test('导出文件名格式', function () {
    const name = transfer.suggestedFileName(Date.UTC(2024, 5, 15, 9, 30))
    equal(name, 'AssetLife-20240615-1730.json', '含日期时间（按本地时区）')
  })
}
