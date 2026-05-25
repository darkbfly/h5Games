import {
  Node,
  Label,
  EditBox,
  Button,
  ScrollView,
  UITransform,
  Layout,
  Size,
  Color,
  Sprite,
  Graphics,
  view,
} from "cc";
import { CreateRoomPanel } from "./CreateRoomPanel";
import { JoinRoomPanel } from "./JoinRoomPanel";
import { LobbyController, type LobbyUIRefs } from "./LobbyController";

export type BuiltLobbyUI = LobbyUIRefs;

interface LayoutSpec {
  designWidth: number;
  designHeight: number;
  titleY: number;
  statusY: number;
  createPanel: PanelSpec;
  joinPanel: PanelSpec;
  roomPanel: PanelSpec;
  inputWidth: number;
  roomListWidth: number;
  roomListHeight: number;
}

interface PanelSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildLobbyUI(canvas: Node): BuiltLobbyUI {
  const layout = getLayoutSpec();
  const root = new Node("LobbyRoot");
  root.parent = canvas;
  const rootTransform = root.addComponent(UITransform);
  rootTransform.setContentSize(new Size(layout.designWidth, layout.designHeight));
  const visibleSize = view.getVisibleSize();
  const scale = Math.min(visibleSize.width / layout.designWidth, visibleSize.height / layout.designHeight);
  root.setScale(scale, scale, 1);

  const title = createLabel(root, "游戏平台大厅", 32, new Color(30, 30, 30, 255));
  title.node.setPosition(0, layout.titleY, 0);

  const statusLabel = createLabel(root, "正在连接服务器...", 18, new Color(120, 120, 120, 255));
  statusLabel.node.setPosition(0, layout.statusY, 0);

  const leftPanel = createPanelNode(root, "CreatePanel", layout.createPanel);
  const createPanel = leftPanel.addComponent(CreateRoomPanel);
  createPanel.roomNameInput = createEditBox(leftPanel, "房间名", 0, layout.createPanel.height / 2 - 60, layout.inputWidth);
  createPanel.passwordInput = createEditBox(leftPanel, "密码(可选)", 0, layout.createPanel.height / 2 - 110, layout.inputWidth);
  createPanel.selectedGameLabel = createLabel(leftPanel, "选择游戏:", 18, new Color(60, 60, 60, 255));
  createPanel.selectedGameLabel.node.setPosition(0, layout.createPanel.height / 2 - 150, 0);
  const gameListRoot = new Node("GameList");
  gameListRoot.parent = leftPanel;
  gameListRoot.setPosition(0, 30, 0);
  gameListRoot.addComponent(UITransform).setContentSize(new Size(layout.inputWidth, 140));
  createPanel.gameListRoot = gameListRoot;

  const gameConfigRoot = new Node("GameConfig");
  gameConfigRoot.parent = leftPanel;
  gameConfigRoot.setPosition(0, -90, 0);
  gameConfigRoot.addComponent(UITransform).setContentSize(new Size(layout.inputWidth, 110));
  gameConfigRoot.active = false;
  createPanel.gameConfigRoot = gameConfigRoot;

  createPanel.createButton = createButton(leftPanel, "创建房间", 0, -layout.createPanel.height / 2 + 40);

  const centerPanel = createPanelNode(root, "JoinPanel", layout.joinPanel);
  const joinPanel = centerPanel.addComponent(JoinRoomPanel);
  joinPanel.searchInput = createEditBox(centerPanel, "搜索房间名", 0, layout.joinPanel.height / 2 - 60, layout.inputWidth);
  joinPanel.searchButton = createButton(centerPanel, "普通搜索", 0, layout.joinPanel.height / 2 - 110);
  joinPanel.roomIdInput = createEditBox(centerPanel, "房间ID(密码加入)", 0, 10, layout.inputWidth);
  joinPanel.passwordInput = createEditBox(centerPanel, "房间密码", 0, -40, layout.inputWidth);
  joinPanel.passwordJoinButton = createButton(centerPanel, "密码加入", 0, -90);
  joinPanel.statusLabel = createLabel(centerPanel, "", 16, new Color(180, 60, 60, 255));
  joinPanel.statusLabel.node.setPosition(0, -layout.joinPanel.height / 2 + 30, 0);

  const rightPanel = createPanelNode(root, "RoomListPanel", layout.roomPanel);
  createLabel(rightPanel, "房间列表", 22, new Color(40, 40, 40, 255)).node.setPosition(0, layout.roomPanel.height / 2 - 35, 0);
  const refreshButton = createButton(rightPanel, "刷新列表", 0, layout.roomPanel.height / 2 - 80);

  const scrollNode = new Node("RoomScroll");
  scrollNode.parent = rightPanel;
  scrollNode.setPosition(0, -45, 0);
  const scrollTransform = scrollNode.addComponent(UITransform);
  scrollTransform.setContentSize(new Size(layout.roomListWidth, layout.roomListHeight));
  const scrollView = scrollNode.addComponent(ScrollView);
  scrollView.horizontal = false;
  scrollView.vertical = true;

  const content = new Node("Content");
  content.parent = scrollNode;
  const contentTransform = content.addComponent(UITransform);
  contentTransform.setContentSize(new Size(layout.roomListWidth, layout.roomListHeight));
  const contentLayout = content.addComponent(Layout);
  contentLayout.type = Layout.Type.VERTICAL;
  contentLayout.resizeMode = Layout.ResizeMode.CONTAINER;
  scrollView.content = content;

  const controller = root.addComponent(LobbyController);
  controller.initBuiltUI({
    createPanel,
    joinPanel,
    roomListContent: content,
    statusLabel,
    refreshButton,
  });

  return {
    createPanel,
    joinPanel,
    roomListContent: content,
    statusLabel,
    refreshButton,
  };
}

function getLayoutSpec(): LayoutSpec {
  const visibleSize = view.getVisibleSize();
  const portrait = visibleSize.height >= visibleSize.width;
  const phoneLandscape = !portrait && visibleSize.height < 600;

  if (portrait) {
    return {
      designWidth: 430,
      designHeight: 940,
      titleY: 430,
      statusY: 395,
      createPanel: { x: 0, y: 230, width: 390, height: 340 },
      joinPanel: { x: 0, y: -75, width: 390, height: 280 },
      roomPanel: { x: 0, y: -350, width: 390, height: 250 },
      inputWidth: 340,
      roomListWidth: 360,
      roomListHeight: 145,
    };
  }

  if (phoneLandscape) {
    return {
      designWidth: 900,
      designHeight: 430,
      titleY: 195,
      statusY: 165,
      createPanel: { x: -300, y: -20, width: 280, height: 330 },
      joinPanel: { x: 0, y: -20, width: 280, height: 330 },
      roomPanel: { x: 300, y: -20, width: 280, height: 330 },
      inputWidth: 240,
      roomListWidth: 260,
      roomListHeight: 210,
    };
  }

  return {
    designWidth: 1280,
    designHeight: 720,
    titleY: 320,
    statusY: 285,
    createPanel: { x: -420, y: 0, width: 380, height: 520 },
    joinPanel: { x: 0, y: 0, width: 380, height: 520 },
    roomPanel: { x: 420, y: 0, width: 380, height: 520 },
    inputWidth: 340,
    roomListWidth: 350,
    roomListHeight: 400,
  };
}

function createPanelNode(parent: Node, name: string, panelSpec: PanelSpec): Node {
  const panel = new Node(name);
  panel.parent = parent;
  panel.setPosition(panelSpec.x, panelSpec.y, 0);
  const transform = panel.addComponent(UITransform);
  transform.setContentSize(new Size(panelSpec.width, panelSpec.height));

  const bg = panel.addComponent(Graphics);
  bg.fillColor = new Color(245, 245, 245, 255);
  bg.rect(-panelSpec.width / 2, -panelSpec.height / 2, panelSpec.width, panelSpec.height);
  bg.fill();

  return panel;
}

function createLabel(parent: Node, text: string, fontSize: number, color: Color): Label {
  const node = new Node("Label");
  node.parent = parent;
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.color = color;
  return label;
}

function createEditBox(parent: Node, placeholder: string, x: number, y: number, width: number): EditBox {
  const node = new Node(`Edit_${placeholder}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(new Size(width, 40));

  const bg = node.addComponent(Sprite);
  void bg;

  const editBox = node.addComponent(EditBox);
  editBox.placeholder = placeholder;
  editBox.string = "";
  editBox.maxLength = 64;
  return editBox;
}

function createButton(parent: Node, text: string, x: number, y: number): Button {
  const node = new Node(`Btn_${text}`);
  node.parent = parent;
  node.setPosition(x, y, 0);
  node.addComponent(UITransform).setContentSize(new Size(200, 44));

  const labelNode = new Node("Label");
  labelNode.parent = node;
  const label = labelNode.addComponent(Label);
  label.string = text;
  label.fontSize = 20;
  label.color = new Color(255, 255, 255, 255);

  const button = node.addComponent(Button);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = new Color(52, 120, 246, 255);
  graphics.rect(-100, -22, 200, 44);
  graphics.fill();

  return button;
}
