# Lobby 场景搭建说明

在 Cocos Creator 3.8+ 中：

1. 新建 2D 场景 `Lobby`
2. 保留默认 `Canvas` 与 `Camera`
3. 选中 `Canvas`，添加组件 `LobbyBootstrap`（路径：`assets/scripts/lobby/LobbyBootstrap.ts`）
4. 菜单 **项目 → 项目设置 → 项目数据**，将启动场景设为 `Lobby`
5. 在 `client` 目录执行 `npm install` 后重新打开项目

运行后 `LobbyBootstrap` 会自动构建创建房间、搜索加入、房间列表 UI。
