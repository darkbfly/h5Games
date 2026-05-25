import { _decorator, Component, Node, Label, Button } from "cc";
import type { Room } from "colyseus.js";
import { PlatformClient, type RoomListItem } from "../network/PlatformClient";
import { CreateRoomPanel, type CreateRoomFormData } from "./CreateRoomPanel";
import { JoinRoomPanel } from "./JoinRoomPanel";
import { RoomListItem as RoomListItemView } from "./RoomListItem";
import { RockPaperScissorsPanel } from "../games/rps/RockPaperScissorsPanel";

const { ccclass, property } = _decorator;

export interface LobbyUIRefs {
  createPanel: CreateRoomPanel;
  joinPanel: JoinRoomPanel;
  roomListContent: Node;
  statusLabel: Label;
  refreshButton: Button;
}

@ccclass("LobbyController")
export class LobbyController extends Component {
  @property(CreateRoomPanel)
  createPanel: CreateRoomPanel | null = null;

  @property(JoinRoomPanel)
  joinPanel: JoinRoomPanel | null = null;

  @property(Node)
  roomListContent: Node | null = null;

  @property(Label)
  statusLabel: Label | null = null;

  @property(Button)
  refreshButton: Button | null = null;

  @property
  serverUrl = "ws://localhost:2567";

  private platform = new PlatformClient();
  private uiRefs: LobbyUIRefs | null = null;
  private roomRows: Node[] = [];
  private rpsPanel: RockPaperScissorsPanel | null = null;

  initBuiltUI(refs: LobbyUIRefs) {
    this.uiRefs = refs;
    this.createPanel = refs.createPanel;
    this.joinPanel = refs.joinPanel;
    this.roomListContent = refs.roomListContent;
    this.statusLabel = refs.statusLabel;
    this.refreshButton = refs.refreshButton;
    this.platform = new PlatformClient(this.serverUrl);
    void this.bootstrap();
  }

  async start() {
    if (!this.uiRefs) {
      void this.bootstrap();
    }
  }

  private async bootstrap() {
    if (!this.createPanel || !this.joinPanel) {
      return;
    }

    this.setStatus("正在连接服务器...");
    this.refreshButton?.node.on(Button.EventType.CLICK, () => this.refreshRooms(), this);

    try {
      await this.platform.connectLobby();
      this.bindPlatformEvents();
      this.bindUIEvents();
      this.platform.requestGames();
      this.refreshRooms();
      this.setStatus("已连接，可以创建或加入房间");
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      this.setStatus(message);
    }
  }

  private bindPlatformEvents() {
    this.platform.onRoomsList((rooms) => this.renderRoomList(rooms));
    this.platform.onRoomListChanged(() => this.refreshRooms());
    this.platform.onRoomCreated((roomId, roomName) => {
      this.setStatus(`房间「${roomName}」创建成功，ID: ${roomId}`);
      this.refreshRooms();
    });
    this.platform.onError((message) => this.setStatus(message));
  }

  private bindUIEvents() {
    this.createPanel?.setOnCreate((data) => void this.handleCreateRoom(data));
    this.joinPanel?.setOnSearch((keyword) => {
      this.platform.searchRooms(keyword);
      this.setStatus(keyword ? `搜索: ${keyword}` : "显示全部房间");
    });
    this.joinPanel?.setOnPasswordJoin((roomId, password) => void this.handlePasswordJoin(roomId, password));
  }

  private refreshRooms() {
    this.platform.requestRoomList();
  }

  private async handleCreateRoom(data: CreateRoomFormData) {
    try {
      await this.platform.createRoom({
        roomName: data.roomName,
        password: data.password || undefined,
        gameId: data.gameId,
        gameConfig: data.gameConfig,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败";
      this.setStatus(message);
    }
  }

  private async handleJoinRoom(room: RoomListItem) {
    if (room.hasPassword) {
      this.joinPanel?.setStatus("该房间需要密码，请使用密码加入");
      if (this.joinPanel?.roomIdInput) {
        this.joinPanel.roomIdInput.string = room.roomId;
      }
      return;
    }

    try {
      const gameRoom = await this.platform.joinRoom(room.roomId);
      await this.enterGameRoom(room.gameId, gameRoom);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加入失败";
      this.setStatus(message);
    }
  }

  private async handlePasswordJoin(roomId: string, password: string) {
    try {
      const gameRoom = await this.platform.joinRoom(roomId, password);
      const rooms = await this.waitForRoomList();
      const room = rooms.find((r) => r.roomId === roomId);
      await this.enterGameRoom(room?.gameId ?? "rock-paper-scissors", gameRoom);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加入失败";
      this.joinPanel?.setStatus(message);
      this.setStatus(message);
    }
  }

  private waitForRoomList(): Promise<RoomListItem[]> {
    return new Promise((resolve) => {
      this.platform.onRoomsList((rooms) => resolve(rooms));
      this.platform.requestRoomList();
    });
  }

  private async enterGameRoom(gameId: string, gameRoom: Room) {
    if (gameId === "rock-paper-scissors") {
      this.showRockPaperScissors(gameRoom);
      return;
    }
    this.setStatus(`已加入房间: ${gameRoom.id}`);
    console.log("[Lobby] joined game room", gameRoom.id);
  }

  private showRockPaperScissors(gameRoom: Room) {
    const canvas = this.node.parent;
    if (!canvas) {
      return;
    }

    this.node.active = false;
    this.rpsPanel = RockPaperScissorsPanel.create(canvas, gameRoom, () => this.exitToLobby());
    this.setStatus("已进入锤子剪刀布房间");
  }

  private exitToLobby() {
    void this.platform.leaveGameRoom();
    this.rpsPanel?.node.destroy();
    this.rpsPanel = null;
    this.node.active = true;
    this.refreshRooms();
    this.setStatus("已返回大厅");
  }

  private renderRoomList(rooms: RoomListItem[]) {
    const content = this.roomListContent;
    if (!content) {
      return;
    }

    for (const row of this.roomRows) {
      row.destroy();
    }
    this.roomRows = [];

    if (rooms.length === 0) {
      this.setStatus("暂无房间，创建一个吧");
      return;
    }

    for (const room of rooms) {
      const row = new Node(`room_${room.roomId}`);
      row.parent = content;
      row.addComponent(RoomListItemView).setup(room, (r) => void this.handleJoinRoom(r));
      this.roomRows.push(row);
    }
  }

  private setStatus(message: string) {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }
}
