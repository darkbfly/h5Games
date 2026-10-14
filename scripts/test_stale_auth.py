"""TARGET_URL: http://localhost:5173/

用 Playwright 测试：localStorage 里有过期 token 时，页面应自动清缓存并显示登录表单。
"""

from __future__ import annotations

import json
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

TARGET_URL = "http://localhost:5173/"
STALE_AUTH = {
    "token": "deadbeef" * 8,
    "user": {"id": "stale-user-id", "username": "stale_user"},
}


def servers_up() -> bool:
    try:
        with urlopen("http://localhost:2567/health", timeout=3) as r:
            return json.loads(r.read()).get("ok") is True
    except URLError:
        return False


def main() -> int:
    if not servers_up():
        print("FAIL: server not running on :2567")
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("FAIL: pip install playwright && playwright install chromium")
        return 1

    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-http-cache"])
        context = browser.new_context()
        # 在页面脚本执行前注入过期 token，模拟用户刷新后带着旧缓存打开
        context.add_init_script(
            f"localStorage.setItem('h5games_auth', {json.dumps(json.dumps(STALE_AUTH))});"
        )
        page = context.new_page()
        page.on("console", lambda msg: print(f"  [console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"  [pageerror] {err}"))

        verify_hits: list[int] = []
        server_reqs: list[str] = []

        def on_response(resp):
            if "/auth/verify" in resp.url:
                verify_hits.append(resp.status)
                print(f"  [network] verify -> {resp.status} {resp.url}")
            if ":2567" in resp.url or "/auth/" in resp.url:
                server_reqs.append(f"{resp.request.method} {resp.url} -> {resp.status}")

        page.on("response", on_response)

        page.goto(f"{TARGET_URL}?_={int(time.time())}", wait_until="networkidle")
        page.wait_for_timeout(3000)

        src_has_peek = page.evaluate(
            "() => fetch('/src/app/App.ts').then(r => r.text()).then(t => t.includes('peekStoredAuth'))"
        )
        ls_raw = page.evaluate("() => localStorage.getItem('h5games_auth')")
        print(f"  source has peekStoredAuth:  {src_has_peek}")
        print(f"  localStorage raw:           {str(ls_raw)[:60]!r}")

        html = page.content()
        has_auth_form = page.locator("#auth-username").count() > 0
        has_loading_panel = page.locator("div.panel h1").count() > 0 and page.locator("#auth-username").count() == 0
        stored = page.evaluate("() => localStorage.getItem('h5games_auth')")

        print("--- stale token on first load ---")
        print(f"  verify requests:            {verify_hits}")
        print(f"  server :2567 requests:      {server_reqs}")
        print(f"  auth form (#auth-username): {has_auth_form}")
        print(f"  stuck loading panel only:   {has_loading_panel}")
        print(f"  localStorage cleared:       {stored is None}")
        print(f"  overlay text snippet:       {page.locator('#ui-overlay').inner_text()[:80]!r}")

        if not has_auth_form:
            failures.append("stale token: login form not shown")
        if stored is not None:
            failures.append("stale token: localStorage not cleared")
        if has_loading_panel:
            failures.append("stale token: stuck on loading panel")

        # --- case 2: register fresh user ---
        if has_auth_form:
            username = f"py_{int(time.time())}"
            page.fill("#auth-username", username)
            page.fill("#auth-password", "password123")
            page.click("#auth-switch")  # switch to register
            page.wait_for_timeout(300)
            page.fill("#auth-username", username)
            page.fill("#auth-password", "password123")
            page.click("#auth-submit")
            page.wait_for_timeout(3000)

            in_lobby = (
                page.locator("text=创建房间").count() > 0
                or page.locator("text=退出登录").count() > 0
                or page.locator("text=已连接").count() > 0
            )
            print("--- register flow ---")
            print(f"  entered lobby: {in_lobby}")
            print(f"  overlay text:  {page.locator('#ui-overlay').inner_text()[:120]!r}")
            if not in_lobby:
                failures.append("register: did not reach lobby")

        browser.close()

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
