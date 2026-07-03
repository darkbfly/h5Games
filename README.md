# H5 Games Platform

Eva.js 多人游戏平台客户端 + Colyseus 房间服务端。

## 功能

- 认证：注册、登录、Token 鉴权（内存存储，重启后需重新注册）
- 大厅：游戏列表、房间列表、搜索、创建房间、退出登录
- 房间：加入、准备、房主踢人（仅等待阶段）、返回大厅
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

### 4. 完整流程验证

1. **注册 / 登录**（用户名 ≥3 字符，密码 ≥6 字符）
2. 进入**大厅**，创建或加入房间
3. 进入**房间等待界面**，点击**准备**
4. 两名玩家均准备后自动进入游戏
5. 房主可在等待阶段**踢出**其他玩家

双开测试：打开两个浏览器窗口（或无痕模式），分别注册两个账号。

## 测试

```bash
yarn test          # 集成测试（认证、建房、密码、准备、踢人、RPS 对局）
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
Auth → Loading → Lobby → Room（准备/踢人）→ Game（RPS）
         │                    │
         └──── shared/protocol ┘
```

```
EvaClient ──ws──> LobbyRoom ──> GameRoom ──> GameController(RPS)
    │                                      │
    └──────── shared/protocol ─────────────┘
```
