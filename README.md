# H5 Games Platform

Eva.js 多人游戏平台客户端 + Colyseus 房间服务端。

## 功能

- 大厅：游戏列表、房间列表、搜索、创建房间
- 房间：密码校验、加入、离开、断线重连（10s）
- 游戏：锤子剪刀布双人实时对战（可配置选择时间与获胜分数）
- 协议：共享消息常量与类型（`shared/protocol/`）
- 监控：`GET /health` 返回在线指标

## 目录

```
eva-client/      # Eva.js + Vite 客户端（推荐）
server/          # Colyseus 服务端
shared/          # 共享游戏目录与协议定义
client/          # Cocos Creator 3.x 客户端（遗留）
docs/            # MVP 范围与上线检查清单
```

## 快速开始

### 1. 安装依赖

```bash
yarn install:all
```

### 2. 启动服务端

```bash
# 在项目根目录（推荐）
yarn server

# 或进入子目录
yarn --cwd server dev
```

服务默认监听 `ws://localhost:2567`。

### 3. 启动 Eva.js 客户端

```bash
# 在项目根目录（推荐）
yarn eva:dev

# 或进入子目录
yarn --cwd eva-client dev
```

浏览器打开 `http://localhost:5173`。

### 4. 双客户端验证

- 打开两个浏览器窗口
- 窗口 A：创建锤子剪刀布房间
- 窗口 B：从列表加入或 ID 加入
- 双方选择出拳，验证比分与结算

## 测试

```bash
yarn test          # 集成测试（建房、密码、RPS 对局）
yarn test:load     # 压测（并发连接、限流、健康检查）
```

## 游戏列表

| ID | 名称 | 人数 | MVP |
|----|------|------|-----|
| rock-paper-scissors | 锤子剪刀布 | 2 | 是 |
| guess-number | 猜数字 | 2-4 | 否 |
| quick-card | 快速卡牌 | 2-6 | 否 |
| party-dice | 派对骰子 | 2-8 | 否 |

## 架构

```
EvaClient ──ws──> LobbyRoom ──> GameRoom ──> GameController(RPS)
    │                                      │
    └──────── shared/protocol ─────────────┘
```
