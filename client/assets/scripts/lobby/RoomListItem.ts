import { _decorator, Component, Label, Button, Node, UITransform, Size, Color, Graphics } from "cc";
import type { RoomListItem as RoomInfo } from "../network/PlatformClient";

const { ccclass } = _decorator;

@ccclass("RoomListItem")
export class RoomListItem extends Component {
  private roomInfo: RoomInfo | null = null;

  setup(room: RoomInfo, onJoin: (room: RoomInfo) => void) {
    this.roomInfo = room;
    this.node.removeAllChildren();

    const parentWidth = this.node.parent?.getComponent(UITransform)?.contentSize.width ?? 380;
    const width = Math.max(320, parentWidth);
    const halfWidth = width / 2;

    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(new Size(width, 72));

    const bg = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
    bg.fillColor = new Color(255, 255, 255, 255);
    bg.clear();
    bg.rect(-halfWidth, -36, width, 72);
    bg.fill();

    const titleNode = new Node("title");
    titleNode.parent = this.node;
    titleNode.setPosition(-halfWidth + 110, 10, 0);
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = room.roomName;
    titleLabel.fontSize = 20;
    titleLabel.color = new Color(30, 30, 30, 255);

    const detailNode = new Node("detail");
    detailNode.parent = this.node;
    detailNode.setPosition(-halfWidth + 110, -15, 0);
    const detailLabel = detailNode.addComponent(Label);
    const lock = room.hasPassword ? " [需密码]" : "";
    detailLabel.string = `${room.gameName} ${room.clients}/${room.maxClients}人 最少${room.minPlayers}人${lock}`;
    detailLabel.fontSize = 14;
    detailLabel.color = new Color(100, 100, 100, 255);

    const btnNode = new Node("joinBtn");
    btnNode.parent = this.node;
    btnNode.setPosition(halfWidth - 60, 0, 0);
    btnNode.addComponent(UITransform).setContentSize(new Size(100, 36));
    const btnGraphics = btnNode.addComponent(Graphics);
    btnGraphics.fillColor = new Color(52, 120, 246, 255);
    btnGraphics.rect(-50, -18, 100, 36);
    btnGraphics.fill();
    const btnLabelNode = new Node("label");
    btnLabelNode.parent = btnNode;
    const btnLabel = btnLabelNode.addComponent(Label);
    btnLabel.string = "加入";
    btnLabel.fontSize = 16;
    btnLabel.color = new Color(255, 255, 255, 255);
    const button = btnNode.addComponent(Button);
    button.node.on(Button.EventType.CLICK, () => onJoin(room), this);
  }

  getRoomInfo(): RoomInfo | null {
    return this.roomInfo;
  }
}
