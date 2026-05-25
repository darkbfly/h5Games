# H5 Games Platform

Cocos Creator 3.x 游戏平台客户端 + Colyseus 多人房间服务端。

## 功能

- 创建房间：房间名、可选密码、选择游戏
- 加入房间：大厅列表普通搜索、按房间 ID + 密码加入
- 游戏配置：每个游戏有最少/最多游玩人数
- 服务端不对外暴露房间明文密码

## 目录

```
client/          # Cocos Creator 3.x 项目
server/          # Colyseus 服务端
shared/          # 共享游戏配置（参考）
```

## 快速开始

### 1. 启动服务端

```bash
cd server
npm install
npm run dev
```

服务默认监听 `ws://localhost:2567`。

### 2. 打开 Cocos 客户端

1. 用 **Cocos Creator 3.8+** 打开 `client/` 目录
2. 在 `client/` 下执行 `npm install`（安装 `colyseus.js`）
3. 新建场景 `Lobby`，添加 **Canvas**、**Camera**
4. 在 **Canvas** 上添加组件 `LobbyBootstrap`
5. 将 `Lobby` 设为启动场景，点击运行

大厅 UI 由 `LobbyBootstrap` 在运行时自动生成。

### 3. 双客户端验证

- 运行两个预览实例（或一台浏览器 + 编辑器预览）
- 实例 A：创建带密码的房间
- 实例 B：普通搜索找到无密码房间并加入；对密码房间使用「房间ID + 密码」加入

## 测试

```bash
cd server
npm install
npm test
```

## 游戏列表

| ID | 名称 | 人数 |
|----|------|------|
| guess-number | 猜数字 | 2-4 |
| quick-card | 快速卡牌 | 2-6 |
| party-dice | 派对骰子 | 2-8 |
