import type { NetworkService } from "../network/NetworkService.js";
import type { StateStore } from "../state/StateStore.js";
import { escapeHtml } from "../utils/escapeHtml.js";

export class AuthScene {
  constructor(
    private readonly store: StateStore,
    private readonly network: NetworkService,
    private readonly overlay: HTMLElement,
    private readonly onAuthenticated: () => void
  ) {}

  start(): void {
    this.render("login");
  }

  dispose(): void {
    this.overlay.innerHTML = "";
  }

  private render(mode: "login" | "register"): void {
    const isLogin = mode === "login";
    this.overlay.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <p class="eyebrow">H5 Games</p>
          <h1>${isLogin ? "登录" : "注册"}</h1>
          <div class="status-bar" id="auth-status">${escapeHtml(this.store.get().statusMessage)}</div>
          <div class="form-row">
            <label>用户名</label>
            <input id="auth-username" placeholder="至少3个字符" autocomplete="username" />
          </div>
          <div class="form-row">
            <label>密码</label>
            <input id="auth-password" type="password" placeholder="至少6个字符" autocomplete="${isLogin ? "current-password" : "new-password"}" />
          </div>
          <button id="auth-submit" class="full-width">${isLogin ? "登录" : "注册并进入"}</button>
          <button id="auth-switch" class="secondary full-width">${isLogin ? "没有账号？去注册" : "已有账号？去登录"}</button>
        </div>
      </div>
    `;

    this.overlay.querySelector("#auth-switch")?.addEventListener("click", () => {
      this.render(isLogin ? "register" : "login");
    });

    this.overlay.querySelector("#auth-submit")?.addEventListener("click", () => {
      void this.handleSubmit(isLogin ? "login" : "register");
    });
  }

  private async handleSubmit(action: "login" | "register"): Promise<void> {
    const username = (this.overlay.querySelector("#auth-username") as HTMLInputElement).value.trim();
    const password = (this.overlay.querySelector("#auth-password") as HTMLInputElement).value;

    if (!username || !password) {
      this.setStatus("请输入用户名和密码");
      return;
    }

    this.setStatus(action === "login" ? "正在登录..." : "正在注册...");

    try {
      if (action === "login") {
        await this.network.login(username, password);
      } else {
        await this.network.register(username, password);
      }
      this.onAuthenticated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      this.setStatus(message);
    }
  }

  private setStatus(message: string): void {
    this.store.patch({ statusMessage: message });
    const el = this.overlay.querySelector("#auth-status");
    if (el) el.textContent = message;
  }
}
