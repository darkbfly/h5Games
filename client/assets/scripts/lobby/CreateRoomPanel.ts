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
import {
  GAME_CATALOG,
  buildGameConfigFromForm,
  getDefaultGameConfig,
  getGameById,
  type GameConfigValues,
  type GameDefinition,
} from "../config/GameCatalog";

const { ccclass, property } = _decorator;

export interface CreateRoomFormData {
  roomName: string;
  password: string;
  gameId: string;
  gameConfig?: GameConfigValues;
}

@ccclass("CreateRoomPanel")
export class CreateRoomPanel extends Component {
  @property(EditBox)
  roomNameInput: EditBox | null = null;

  @property(EditBox)
  passwordInput: EditBox | null = null;

  @property(Node)
  gameListRoot: Node | null = null;

  @property(Node)
  gameConfigRoot: Node | null = null;

  @property(Button)
  createButton: Button | null = null;

  @property(Label)
  selectedGameLabel: Label | null = null;

  private selectedGameId = GAME_CATALOG[0]?.id ?? "";
  private onCreate: ((data: CreateRoomFormData) => void) | null = null;
  private gameToggles: Toggle[] = [];
  private configInputs = new Map<string, EditBox>();

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
    const gameId = this.selectedGameId;
    const game = getGameById(gameId);
    let gameConfig: GameConfigValues | undefined;

    if (game?.configSchema?.length) {
      const raw: Record<string, string> = {};
      for (const field of game.configSchema) {
        raw[field.key] = this.configInputs.get(field.key)?.string ?? String(field.default);
      }
      gameConfig = buildGameConfigFromForm(gameId, raw);
    }

    return {
      roomName: this.roomNameInput?.string?.trim() ?? "",
      password: this.passwordInput?.string?.trim() ?? "",
      gameId,
      gameConfig,
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
    const game = getGameById(gameId);
    if (this.selectedGameLabel && game) {
      this.selectedGameLabel.string = `已选: ${game.name} (${game.minPlayers}-${game.maxPlayers}人)`;
    }
    for (const toggle of this.gameToggles) {
      const id = toggle.node.name.replace("game_", "");
      toggle.isChecked = id === gameId;
    }
    this.rebuildConfigInputs(game);
  }

  private rebuildConfigInputs(game?: GameDefinition) {
    const root = this.gameConfigRoot;
    if (!root) {
      return;
    }

    root.removeAllChildren();
    this.configInputs.clear();
    root.active = !!(game?.configSchema?.length);

    if (!game?.configSchema?.length) {
      return;
    }

    const defaults = getDefaultGameConfig(game.id) ?? {};
    const width = root.getComponent(UITransform)?.contentSize.width ?? 340;
    let y = 40;

    for (const field of game.configSchema) {
      const row = new Node(`cfg_${field.key}`);
      row.parent = root;
      row.setPosition(0, y, 0);
      y -= 50;

      const labelNode = new Node("label");
      labelNode.parent = row;
      labelNode.setPosition(-width / 2 + 80, 0, 0);
      const label = labelNode.addComponent(Label);
      label.string = field.label;
      label.fontSize = 16;
      label.color = new Color(60, 60, 60, 255);

      const inputNode = new Node("input");
      inputNode.parent = row;
      inputNode.setPosition(40, 0, 0);
      inputNode.addComponent(UITransform).setContentSize(new Size(120, 36));
      const editBox = inputNode.addComponent(EditBox);
      editBox.placeholder = `${field.min}-${field.max}`;
      editBox.string = String(defaults[field.key] ?? field.default);
      editBox.maxLength = 4;
      editBox.inputMode = EditBox.InputMode.NUMERIC;
      this.configInputs.set(field.key, editBox);
    }
  }

  private handleCreate() {
    try {
      this.onCreate?.(this.getFormData());
    } catch (err) {
      const message = err instanceof Error ? err.message : "配置无效";
      if (this.selectedGameLabel) {
        this.selectedGameLabel.string = message;
      }
    }
  }
}
