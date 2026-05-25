import { _decorator, Component, Canvas, director } from "cc";
import { buildLobbyUI } from "./LobbyUIBuilder";

const { ccclass } = _decorator;

/**
 * Attach to Canvas in Lobby scene (or any entry scene).
 * Builds lobby UI at runtime so the scene only needs Canvas + Camera.
 */
@ccclass("LobbyBootstrap")
export class LobbyBootstrap extends Component {
  onLoad() {
    const canvas = this.getComponent(Canvas) ?? director.getScene()?.getChildByName("Canvas");
    if (!canvas) {
      console.error("[LobbyBootstrap] Canvas not found");
      return;
    }
    buildLobbyUI(canvas.node);
  }
}
