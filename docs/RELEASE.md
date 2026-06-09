# 灰度上线检查清单

## 部署前

- [ ] `npm test` 全量通过（platform + load）
- [ ] `npm run eva:build` 构建成功
- [ ] `/health` 返回 `ok: true` 且含 metrics
- [ ] 双浏览器窗口完成 RPS 对局验证

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | 2567 | 服务端端口 |
| `NODE_ENV` | development | production 关闭 Colyseus monitor |
| `VITE_SERVER_URL` | ws://localhost:2567 | eva-client WebSocket 地址 |

## 灰度步骤

1. 部署服务端到单节点，确认 `/health` 正常
2. 部署 eva-client 静态资源，配置 `VITE_SERVER_URL` 指向生产 WS
3. 小流量（5-10 用户）验证建房/入房/RPS 对局
4. 观察 metrics：`errorsTotal`、`avgRttMs`、`gameRooms`
5. 无异常后全量放开

## 回滚

- 服务端：回滚到上一版本镜像，房间会断开（预期）
- 客户端：静态资源 CDN 回滚即可
