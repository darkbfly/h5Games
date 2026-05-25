import { _decorator, Component, EditBox, Button, Label } from "cc";

const { ccclass, property } = _decorator;

@ccclass("JoinRoomPanel")
export class JoinRoomPanel extends Component {
  @property(EditBox)
  searchInput: EditBox | null = null;

  @property(EditBox)
  roomIdInput: EditBox | null = null;

  @property(EditBox)
  passwordInput: EditBox | null = null;

  @property(Button)
  searchButton: Button | null = null;

  @property(Button)
  passwordJoinButton: Button | null = null;

  @property(Label)
  statusLabel: Label | null = null;

  private onSearch: ((keyword: string) => void) | null = null;
  private onPasswordJoin: ((roomId: string, password: string) => void) | null = null;

  onLoad() {
    this.searchButton?.node.on(Button.EventType.CLICK, this.handleSearch, this);
    this.passwordJoinButton?.node.on(Button.EventType.CLICK, this.handlePasswordJoin, this);
  }

  setOnSearch(handler: (keyword: string) => void) {
    this.onSearch = handler;
  }

  setOnPasswordJoin(handler: (roomId: string, password: string) => void) {
    this.onPasswordJoin = handler;
  }

  setStatus(message: string) {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }

  private handleSearch() {
    const keyword = this.searchInput?.string?.trim() ?? "";
    this.onSearch?.(keyword);
  }

  private handlePasswordJoin() {
    const roomId = this.roomIdInput?.string?.trim() ?? "";
    const password = this.passwordInput?.string?.trim() ?? "";
    if (!roomId) {
      this.setStatus("请输入房间 ID");
      return;
    }
    if (!password) {
      this.setStatus("请输入房间密码");
      return;
    }
    this.onPasswordJoin?.(roomId, password);
  }
}
