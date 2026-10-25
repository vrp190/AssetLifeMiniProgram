# 格物 AssetLife · 微信小程序版

个人物品日均成本管理工具。与 iOS / macOS 端共享同一套业务口径，数据仅保存在本机，
**不联网、不上传、不采集任何用户信息**，三端备份格式互通。

## 快速开始

```bash
# 1. 核心逻辑单元测试（102 个用例，纯 node，无需微信环境）
node tools/tests/run.js

# 2. 提审前工程自检（页面/组件完整性、图标规格、appid、废弃 API、语法）
node tools/check_project.js

# 3. 重新生成图标（tabBar 8 个 81×81 + 头像 144/512）
python3 tools/gen_icons.py
```

真机运行：用**微信开发者工具**导入本目录，填入你的 AppID（见 `project.config.json`），
点「预览」扫码即可。图标资源在 `assets/`，业务逻辑在 `utils/`。

## 目录结构

```
AssetLifeMiniProgram/
├── app.js / app.json / app.wxss      入口、路由与 tabBar、全局样式
├── project.config.json                工程配置（appid 需自行填写）
├── sitemap.json
├── assets/tabs/*.png                  tabBar 图标（81×81，普通 + 选中）
├── assets/app-icon-144.png            小程序头像（提审上传用）
├── components/                        5 个自定义组件
│   ├── empty-state/                   空状态
│   ├── status-filter/                 状态分段筛选
│   ├── asset-card/                    资产卡片
│   ├── line-chart/                    折线/面积趋势图（canvas 2d 自绘）
│   └── bar-chart/                     柱状图（canvas 2d 自绘）
├── pages/                             6 个页面
│   ├── index/                         资产总览（汇总 + 搜索/筛选/排序 + 列表）
│   ├── wishlist/                      心愿清单（预算统计 + 转资产）
│   ├── trends/                        趋势统计（月度购入、日均合计、分类、排行）
│   ├── settings/                      设置（备份导入导出、演示数据、口径说明）
│   ├── detail/                        资产详情（成本明细 + 趋势 + 改状态）
│   └── edit/                          新增 / 编辑表单
├── utils/                             12 个纯逻辑模块（可在 node 中直接测试）
│   ├── date.js                        日期全部用 'yyyy-MM-dd' 字符串
│   ├── money.js                       金额全部用「分」整数，展示转「元」
│   ├── cost.js                        日均成本 / 单次成本（与 CostCalculator 同口径）
│   ├── trend.js                       趋势采样（≤62 天按天，超过按月）
│   ├── statistics.js                  汇总、排序、月度序列、分类分布
│   ├── validator.js                   表单校验（与 iOS 端规则一致）
│   ├── model.js                       资产规范化（未知字段回退默认值）
│   ├── categories.js                  12 个分类 + Emoji 图标
│   ├── repository.js                  仓库层（依赖注入存储适配器）
│   ├── storage.js                     内存 / wx 存储适配器
│   ├── transfer.js                    备份导出导入（ExportPayload 三端互通）
│   ├── privacy.js                     剪贴板隐私授权封装
│   └── device.js                      pixelRatio（替代已废弃的 getSystemInfoSync）
└── tools/
    ├── gen_icons.py                   图标生成
    ├── tests/                         单元测试（102 个用例）
    └── check_project.js                提审前工程自检
```

## 与 iOS / macOS 端的对应关系

| 概念 | iOS / macOS (Swift) | 小程序 (JS) |
|---|---|---|
| 存储 | SwiftData | `wx.setStorageSync`（JSON 数组，key `assetlife.assets.v1`） |
| 金额 | `Decimal`（元） | 整数「分」，展示时转元 |
| 日期 | `Date` | `'yyyy-MM-dd'` 字符串（字典序即时间序） |
| 图标 | SF Symbols | Emoji |
| 图表 | Swift Charts | canvas 2d 自绘（零第三方依赖） |
| 模型 | `@Model` | 普通 JS 对象 + `utils/model.js` 规范化 |
| 备份 | `ExportService` | `utils/transfer.js`（同一 `ExportPayload`） |

**成本口径（三端一致）**：日均成本 = 购入价 ÷ 持有天数，购买当天按 1 天，未来日期同样按 1 天；
单次成本 = 购入价 ÷ 使用次数；资产总额含已卖出、不含心愿；日均合计只含使用中 + 已退役。

## 注意事项

1. **隐私指引必须配置**：导出复制/导入读取用到剪贴板，属微信隐私接口。需在
   微信公众平台「设置 → 服务内容声明 → 用户隐私保护指引」勾选**剪贴板**，
   否则复制备份功能会被拦截（代码已做降级：导入可手动粘贴、导出可改用文件分享）。
   详见 `发布准备.md`。
2. **不要引入网络请求**：本小程序全部数据本地化，一旦引入 `wx.request` 就需要配置
   服务器域名并可能触发额外审核要求。
3. **修改 `utils/` 后跑测试**：`node tools/tests/run.js`；上传前跑 `node tools/check_project.js`。
4. **`appid` 未填写**：只能用「测试号」调试，无法真机预览与上传。
5. 图表用 canvas 2d，需通过 `fields({node:true, size:true})` 拿到节点再取 `getContext('2d')`，
   不要用已废弃的 `wx.createCanvasContext`。
6. 文件大小：代码 + 模板 + 样式约 120KB，全量约 136KB，远小于 2MB 上限。
