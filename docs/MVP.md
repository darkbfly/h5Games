# 一期 MVP 范围与验收指标

## 用户流程

进入大厅 → 查看/搜索房间 → 创建或加入 → 游戏内对战（锤子剪刀布）→ 结算返回大厅

## 功能范围

| 模块 | 包含 | 不包含 |
|------|------|--------|
| 大厅 | 游戏列表、房间列表、搜索、创建房间 | 账号登录、好友系统 |
| 房间 | 密码校验、加入、离开、断线重连（10s） | 观战、踢人 |
| 游戏 | 锤子剪刀布双人实时对战 | 猜数字/卡牌/骰子 |
| 客户端 | eva.js 渲染 + NetworkService/StateStore | Cocos 新功能开发 |
| 服务端 | 复用 Colyseus LobbyRoom + GameRoom | 换后端框架 |

## 验收指标

- 房间创建与加入成功率 > 99%（集成测试覆盖）
- 同地域常规操作 RTT < 150ms（健康检查含 avgRttMs 采样）
- 断线 10 秒内可重连回房（GameRoom allowReconnection）
- `npm test` 全量通过（含 RPS 对局与超时用例）

## 技术栈

- 客户端：`eva-client/`（Vite + @eva/eva.js + colyseus.js）
- 服务端：`server/`（Colyseus + Express）
- 共享协议：`shared/protocol/`
