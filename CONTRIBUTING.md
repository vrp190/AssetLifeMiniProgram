# 贡献指南

感谢你愿意改进「格物 AssetLife · 微信小程序版」。本仓库是小程序版，
iOS 版（`AssetLife`）与 macOS 版（`AssetLifeMac`）是另外两个独立仓库。

## 开始之前

- 较大改动（新页面、新功能、数据结构调整、成本口径变化）请先开 Issue 讨论。
- 本项目坚持 **零 npm 依赖、纯本地数据、无网络请求、不采集用户信息**。
  引入 `wx.request`、第三方 SDK 或统计埋点的 PR 不会被接受。
- 三端「日均成本」口径必须一致：购入价 ÷ 持有天数，购买当天按 1 天，未来日期同样按 1 天；
  资产总额含已卖出、不含心愿。

## 环境

- Node.js 18+（仅用于跑测试和工程自检，运行时不依赖 Node）
- 微信开发者工具稳定版（真机预览 / 上传）
- `project.config.json` 中的 `appid` 留空时，只能使用测试号调试

## 构建与测试

```bash
# 单元测试（111 个用例，纯 node，无需微信环境）
node tools/tests/run.js

# 提审前工程自检（页面/组件完整性、图标规格、appid、废弃 API、语法）
node tools/check_project.js
```

新增测试：在 `tools/tests/` 下新建 `test-xxx.js`，导出 `module.exports = function (ctx) {...}`，
并在 `tools/tests/run.js` 的 `suites` 数组里注册。

## 目录与代码约定

- `utils/` 全部是纯 CommonJS 模块，**不得直接调用 `wx.*`**；需要宿主能力时通过参数注入
  （参考 `repository.js` 的 storage 适配器、`privacy.js` 的 api 注入）。
- `pages/`、`components/` 只放界面与交互；可复用逻辑下沉到 `utils/`。
- 金额一律用「分」整数存储，展示时转「元」；日期统一用 `'yyyy-MM-dd'` 字符串。
- 不引入 `wx.getSystemInfoSync` 等废弃接口；工程自检会拦截。
- 新建源文件（`.js` / `.wxml` / `.wxss`）时在首行加 SPDX 头：

  ```js
  // SPDX-License-Identifier: AGPL-3.0-or-later
  // Copyright (C) 2026 AssetLife contributors
  ```

  WXML 用 `<!-- ... -->`，WXSS 用 `/* ... */`。

## 隐私与审核

- 剪贴板属于微信隐私接口：涉及导出 / 导入的改动必须在公众平台「用户隐私保护指引」
  中勾选**剪贴板**，并保留 `privacy.js` 的降级路径（手动粘贴、文件分享）。
- 不要在正式路径写入演示数据；演示数据仅供调试与截图，且必须带 `isDemoData` 标记。

## 提交与 PR

- 提交信息用中文：第一行说明「改了什么 / 为什么」，需要时补正文与验证方式。
- 一个 PR 只做一件事；描述里附 `node tools/tests/run.js` 与
  `node tools/check_project.js` 的输出摘要。
- 不要提交 `node_modules`、`project.private.config.json`、`.DS_Store` 或任何密钥。

## 许可证与贡献授权

本项目以 **AGPL-3.0-or-later** 发布，并提供商业授权（见 [LICENSING.md](LICENSING.md)）。
提交 PR 即表示你同意：

1. 你的贡献以 AGPL-3.0-or-later 授权；
2. 授予维护者一项非独占、永久、不可撤销、全球范围、免版税的许可，允许将你的贡献
   以其他许可证（包括商业许可证）再分发。

你保留自己贡献的版权，无需签署 CLA。若你的雇主对贡献主张版权，请先取得授权。

## 行为准则

请保持专业与尊重，围绕技术问题讨论；不接受人身攻击、歧视或骚扰。
