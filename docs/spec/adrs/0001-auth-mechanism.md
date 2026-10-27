# ADR 0001: 认证机制

- Status: **Accepted**
- Date: 2026-10-27

## Context

展馆 SaaS 需支持：租户成员登录管理端、平台超管代建租户、访客公开只读（无需登录）。入口同源 **`:18700`**（nginx）。须避免 Token 进 `localStorage` 导致 XSS 窃取；一期不引入 Redis。

## Options

1. **HttpOnly Cookie + 服务端 Session（Postgres 表）**  
2. Access JWT 存 localStorage + Bearer  
3. JWT 放 Cookie 但仍无服务端会话吊销表  

## Decision

选定 **选项 1**，细节钉死如下：

| 项 | 决定 |
| --- | --- |
| 会话 | 服务端 Session，存 **PostgreSQL** 表（如 `sessions`） |
| Cookie | 名 **`dtv_session`**；**HttpOnly**；`Path=/`；`SameSite=Lax`；一期局域网 HTTP **可不设 Secure**；若日后 HTTPS 必须 Secure |
| 密码 | **argon2id** 哈希存储 |
| 有效期 | **7 天**；滑动续期（活跃请求刷新 `expires_at`）；`POST /auth/logout` **删除**会话行 |
| CSRF | 同源 `:18700` + SameSite=Lax；对管理端写操作校验 **Origin/Referer** 白名单（仅本 host:18700） |
| 租户成员登录 | `POST /auth/login` |
| 平台超管登录 | **`POST /auth/platform/login`**（与成员分离，查 `PlatformAdmin`） |
| Viewer 公开页 | **不要求**登录 |
| JWT | 一期 **不做**；服务间调用另开 ADR |
| 防爆破 | **登录限流**；不做长期账户锁死 |

## Consequences

- 优点：登出即失效；无前端持久 Token；与单端口同源模型契合。  
- 代价：多实例 api 时须共享 DB session（可接受）；日后移动原生客户端需新 ADR。  
- 实现须在 M1 完成；未 Accepted 前不得勾完 M1。  

## 修订

- 2026-10-27：全部按推荐 Accepted。
