# Design: Digital Twin Venue SaaS（同仓演进）

- **Date:** 2026-10-27  
- **Status:** Approved in brainstorming (§1–§3)  
- **Detailed requirements:** [`docs/saas/`](../../saas/README.md)

## Decision summary

| 主题 | 决定 |
| --- | --- |
| 产品形态 | 多租户商业 SaaS（强隔离）；一期无计费 |
| 内容 | 全景 + TvT 3D 双轨；hybrid 允许主轨+副入口 |
| 客户端 | PC Web、手机 Web、WebXR；不做小程序 |
| 后台 | 内容闭环 + 组织/角色；运营代建租户 |
| 仓库 | 同仓 `apps/api`、`apps/admin`、`apps/viewer` + 既有 TvT 引擎 |
| 部署 | 一期仅 gpu001；腾讯云文档预留 |
| 路线图 | 城市/工厂孪生仅占位 |

## Architecture (logical)

```text
admin ──┐
        ├── api ── postgres / storage
viewer ─┘     └── public snapshot read
viewer loads panorama runtime OR TvT engine by VenueKind
```

## Approach chosen

方案 2：同仓 apps 分层（否决：全塞 Fes 插件壳；否决：过薄无组织权限的静态托管先行）。

## Next step

User reviews `docs/saas/` → then invoke **writing-plans** for implementation plan（不直接落码）。

## Spec self-review notes

- No TBD left for phase-1 boundary questions locked in session.  
- Auth stack brand (JWT vs session cookie) deferred to plan — requirement only mandates secure session pattern.  
- Host port numbers deferred to plan + ops-hub port-map registration.  
- Editor publish permission default = editor can publish; optional tighten to admin+ noted.  
