import {
  _decorator,
  Component,
  Node,
  Label,
  EditBox,
  Button,
  Toggle,
  Layout,
  UITransform,
  Color,
  Size,
} from "cc";
import { GAME_CATALOG, type GameDefinition } from "../config/GameCatalog";

const { ccclass, property } = _decorator;

export interface CreateRoomFormData {
  roomName: string;
  password: string;
  gameId: string;
}

@ccclass("CreateRoomPanel")
export class CreateRoomPanel extends Component {
  @property(EditBox)
  roomNameInput: EditBox | null = null;

  @property(EditBox)
  passwordInput: EditBox | null = null;

  @property(Node)
  gameListRoot: Node | null = null;

  @property(Button)
  createButton: Button | null = null;

  @property(Label)
  selectedGameLabel: Label | null = null;

  private selectedGameId = GAME_CATALOG[0]?.id ?? "";
  private onCreate: ((data: CreateRoomFormData) => void) | null = null;
  private gameToggles: Toggle[] = [];

  onLoad() {
    this.createButton?.node.on(Button.EventType.CLICK, this.handleCreate, this);
  }

  start() {
    if (this.gameListRoot) {
      this.buildGameList();
      this.selectGame(this.selectedGameId);
    }
  }

  setOnCreate(handler: (data: CreateRoomFormData) => void) {
    this.onCreate = handler;
  }

  getFormData(): CreateRoomFormData {
    return {
      roomName: this.roomNameInput?.string?.trim() ?? "",
      password: this.passwordInput?.string?.trim() ?? "",
      gameId: this.selectedGameId,
    };
  }

  private buildGameList() {
    const root = this.gameListRoot;
    if (!root) {
      return;
    }

    root.removeAllChildren();
    const layout = root.getComponent(Layout) ?? root.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;

    const listWidth = root.getComponent(UITransform)?.contentSize.width ?? 360;
    this.gameToggles = [];

    for (const game of GAME_CATALOG) {
      const row = new Node(`game_${game.id}`);
      row.parent = root;
      const transform = row.addComponent(UITransform);
      transform.setContentSize(new Size(listWidth, 36));

      const toggle = row.addComponent(Toggle);
      toggle.isChecked = game.id === this.selectedGameId;

      const labelNode = new Node("label");
      labelNode.parent = row;
      const label = labelNode.addComponent(Label);
      label.string = `${game.name} (${game.minPlayers}-${game.maxPlayers}人)`;
      label.fontSize = listWidth < 300 ? 16 : 20;
      label.color = new Color(50, 50, 50, 255);
      labelNode.setPosition(20, 0, 0);

      toggle.node.on(Toggle.EventType.TOGGLE, () => {
        if (toggle.isChecked) {
          this.selectGame(game.id);
        }
      });

      this.gameToggles.push(toggle);
    }
  }

  private selectGame(gameId: string) {
    this.selectedGameId = gameId;
    const game = GAME_CATALOG.find((g) => g.id === gameId);
    if (this.selectedGameLabel && game) {
      this.selectedGameLabel.string = `已选: ${game.name} (${game.minPlayers}-${game.maxPlayers}人)`;
    }
    for (const toggle of this.gameToggles) {
      const id = toggle.node.name.replace("game_", "");
      toggle.isChecked = id === gameId;
    }
  }

  private handleCreate() {
    this.onCreate?.(this.getFormData());
  }
}
