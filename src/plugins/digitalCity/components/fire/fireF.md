# 火 F

展示页：`/#/plugins/digitalCity/fireF`。组件通过 `import { fireF } from 'PLS/digitalCity'` 使用。

```vue
<TresGroup :position="[0, 1, 0]" :rotation="[0, 0, 0.2]">
    <fireF :scale="[2, 3, 2]" :hasPointLight="true" :lightDistance="20" />
</TresGroup>
```

火焰、余烬和点光源属于同一个根节点，支持父级变换。粒子在局部坐标中模拟，移动和缩放不会重建粒子或重复加载贴图；旋转会改变喷发方向，粒子贴片仍朝向相机。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `position` / `rotation` | `[0, 0, 0]` | 支持三元数组或 `{ x, y, z }`，旋转单位为弧度 |
| `scale` | `1` | 支持数值、三元数组或 `{ x, y, z }`，可分别调整三轴 |
| `renderOrder` | `2000` | 火焰整体的透明合成次序，应晚于需要遮挡它的透明楼体；内部三层顺序固定 |
| `hasPointLight` | `true` | 启用闪烁点光源 |
| `flickerLightIntensity` | `2` | 基础光强 |
| `flickerLightIntensityFlux` | `0.4` | 光强闪烁幅度 |
| `flickerLightColor` | `#f5d26b` | 光源颜色 |
| `lightDistance` | `0` | 光照距离，`0` 表示无限，单位为世界坐标单位 |
| `lightDecay` | `1` | 光照衰减系数 |
| `lightCastShadow` | `false` | 点光源阴影；替代旧实现的固定开启，需要时显式启用 |

`uuid`、`name`、`visible`、`renderOrder`、指针事件等属性转发至根节点。拾取使用粒子的包围盒，不逐像素检测透明贴图。隐藏任一父级会同时隐藏火焰和灯光，并暂停粒子更新。删除组件时释放粒子几何体、材质、贴图和灯光阴影资源。

火焰保持 `depthTest: true`、`depthWrite: false`。不透明物体及先绘制并写入深度的透明楼体能遮挡火焰；火焰不写深度，避免贴片之间互相裁切。旧场景保存的 `renderOrder` 会继续生效，若为 `0`，应在属性面板将火 F 的“渲染次序”调到楼体之后（城市示例使用 `2000`）。

编辑器、预览和导出源码均使用普通扩展组件路径，无需 `isEditor` 或外部渲染循环。组件暴露 `root`（Three.js Group）和兼容旧调用的 `curRender()`（仅更新粒子，场景统一绘制），正常使用无需手动调用。
