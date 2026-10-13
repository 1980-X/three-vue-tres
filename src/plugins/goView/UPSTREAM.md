# GoView 预览移植同步记录

核对日期：2026-10-13。此插件保留 JSON 加载、组件渲染、数据请求和联动预览，不引入上游编辑器、项目管理或服务端。

## 上游基线

- 仓库：[dromara/go-view](https://gitee.com/dromara/go-view)。
- 本次核对 master 提交：[abd6d47ceee4efcff781896e1675d4a7a043c426](https://gitee.com/dromara/go-view/commit/abd6d47ceee4efcff781896e1675d4a7a043c426)，提交日期 2026-10-09，上游 package.json 版本 1.3.2。
- 本地插件版本 0.0.2，与上游应用版本分别记录。

| 上游变更 | 本次处理 |
| --- | --- |
| [06e0cde：Axios 拦截器错误回调缺少 return](https://gitee.com/dromara/go-view/commit/06e0cde472a4639ddc85ef2a93aff5e8d4efee5a) | 同步，失败请求会拒绝 Promise，调用方能捕获错误。 |
| [34b808a：胶囊图空数据未清空旧柱条](https://gitee.com/dromara/go-view/commit/34b808aebd391360c4616e5e6c2c74de0a57f99d) | 同步，并清理旧数值和刻度。 |
| 折线多系列 cloneDeep、导入饼图保留 radius、VChart 标签与动画更新等修复 | 当前移植代码已包含相应处理，保留。 |
| VChart 依赖升级到 2.1.4 | 对齐并锁定到 2.1.4，更新 yarn.lock。 |
| 编辑器拖拽、标尺、AI 配置、项目管理等 | 不属于预览移植范围，未同步。 |

上游也仍存在部分轮询和事件问题，因此本次没有直接覆盖整个上游目录。

## 移植版修复

- `goViewCom` 每个实例在宿主 Pinia 内使用独立 ID 的预览 store；图表事件中的 `components` 注册表和数据池也按实例隔离。避免独立 Pinia 容器的 getter 切换宿主活动上下文，卸载时同时删除独立状态。
- `viewChart` 保留为兼容入口，转发原有 props/attrs 到 `goViewCom`，共用同一实现。
- `dataJson` 替换或外部深层修改后重新加载配置；补全旧配置默认值，复制输入数据，保留组件 ID 和嵌套分组。无效配置展示错误，之后可载入有效配置恢复。
- `showAllCom=false` 真正隐藏并卸载图表；显示延时可取消。重新显示时重新挂载。
- AJAX 和数据池轮询在重绑、隐藏、配置替换和卸载时清理；失效订阅忽略迟到响应；间隔 0 表示不轮询。
- 数据池复用同一请求；Params/Header/Body 联动变更触发刷新；缺失数据池安全跳过。
- 联动递归查找分组内目标，替代移植时丢失的 `fetchTargetIndex`。输入控件在 setup 捕获所属 store，避免用户事件取错实例。
- 修复分页页码/每页条数事件绑定和选项卡初始联动字段；已删除目标或无效选项安全跳过。
- VChart 通过图表实例转发语义事件；配置对象替换有效；按实例指定主题；释放实例后不继续更新。
- 缩放监听随画布尺寸与模式变化重绑；卸载删除 wheel/resize 监听并取消待执行的节流回调；饼图轮播卸载时停止。
- HTTP 参数求值使用副本，保留 `javascript:` 动态表达式；合并全局查询参数，支持绝对 URL，正确使用 URLSearchParams 编码表单。
- 删除工具模块顶层的 `useRouter()`，消除 setup 以外注入警告；补回请求/画布类型声明。
- 示例导入通过更新 `dataJson` 加载，取消强制卸载整个预览的绕过方式；页面卸载清理文件输入和 Tweakpane。

## 依赖和使用

| 依赖 | 处理原因 |
| --- | --- |
| `@visactor/vchart: 2.1.4` | 对齐本次上游基线。 |
| `vue-echarts: 8.0.1` | 支持宿主现有 ECharts 6，替代 peer 要求 ECharts 5 的 7.x；ECharts 主版本不变。 |
| `highlight.js: 11.11.1` | 代码主题直接引用，改为显式依赖，版本与原先锁文件中的间接依赖一致。 |
| `sass: 1.49.11` | 保留已有 dependencies 版本；删除 devDependencies 中不同版本的重复声明，锁文件中的 Sass 版本不变。 |

`config.require` 补充 `floor`、`UIdemo`，用于插件自带的演示页面。这两项不表示 `goViewCom` 渲染本身依赖其组件；插件打包也不会自动把依赖插件源码装进当前 ZIP。

继续使用原有接口：

```vue
<script setup>
import { goViewCom } from 'PLS/goView'
import dataJson from './dashboard.json'
</script>

<template>
  <goViewCom :dataJson="dataJson" :maskWidth="0" :maskRightWidth="0" :maskHeight="0" />
</template>
```

宿主需要安装 Pinia；TvT.js 已提供。外部更新预览使用 `dataJson`，组件内部 store 不再与其他预览实例共享。

## 验证结果与边界

独立回归命令（不会启动服务或运行 package.json scripts）：

```powershell
node --test src/plugins/goView/tests/preview-runtime.test.cjs
```

本次 16 项通过，覆盖：仓库内 17 份旧配置及其分组、默认值/ID 保留、不修改输入、实例隔离、宿主 Pinia 上下文、嵌套联动、AJAX/数据池轮询清理、迟到响应、禁用轮询、HTTP 编码、两项上游修复、VChart 事件/释放、两个预览入口、配置替换/错误恢复/显隐、数据池替换、事件注册表、下拉框与分页事件。

测试使用真实 Vue/Pinia 生命周期及 Axios 拦截器，网络和轮询时钟可控；VChart 绘图引擎、Naive UI 输入控件以及组件自动注册在相关测试中使用替身。测试不能代替真实图表和 UI 渲染验证。

按本次用户验证要求，复用已经运行的 localhost:8000 服务，在独立浏览器标签页实际检查：

- `goView/common/vChart.json`：9 个 VChart 图表，包含柱图、条形图、折线、饼图、漏斗、堆积图、面积图、词云、散点。
- `goView/common/test.json`：旧版 ECharts、表格、热力图、装饰与时间组件。
- `smartPark/common/006.json`：水球图、雷达图及滚动表格。
- `zoneSmartWarehouse/common/goview.json`：分组内 VChart、图片、数字和胶囊图。
- 从现有 WordCloud 配置类生成临时配置：ECharts 词云实际绘制成功，补测 ECharts 6 与该扩展的基本兼容性。

上述配置可连续导入，无需强制重建外层预览；未发现浏览器运行错误。另完成修改文件的 Vue/TypeScript 语法检查和 git diff 空白检查。

已知边界：旧配置存在 `hoverAnimation`、label 层级弃用提示，以及雷达刻度可读性提示；水球/词云扩展包仍声明 ECharts 5 的 peer 范围，基本渲染已在 ECharts 6 下实际检查，不能代替其所有能力的回归。根项目 `echarts-gl` 的 peer 提示也仍存在，GoView 当前没有直接导入该包。外部接口可用性、所有组件组合、跨浏览器、长时间运行和全量生产构建没有由本次检查覆盖，不能据此承诺绝对无 bug。

遵守项目规则，未执行全量 build；本次没有启动新的 dev/debug/preview 服务。后续更新应固定上游提交，先筛选影响预览的修复，再运行回归检查与针对变更的实际预览验证。

后续补充的[消费案例验证记录](./CONSUMER_VALIDATION.md)覆盖当前仓库 12 个其他插件、14 处实际引用入口。它修正了上一轮 Pinia 容器隔离的兼容问题，并区分页面通过、部分通过及未通过项；不能仅凭示例页导入配置推断所有业务案例有效。
