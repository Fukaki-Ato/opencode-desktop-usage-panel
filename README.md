# OpenCode Desktop Usage Panel

OpenCode Desktop 窗口内的 Token 与缓存用量面板。页头常驻显示缓存读取占比和累计
Token，点击即可在原生侧栏查看缓存读写、输出、推理、会话费用与最近调用。

**适用范围：Windows、OpenCode Desktop 2.0.29、Node.js 22+。**
这是可恢复的本地前端补丁，不是 CLI/TUI 插件，也不是官方已开放的第三方 GUI 插件。

## 安装

下载或克隆本仓库后，在目录中打开 PowerShell，无需安装 npm 依赖：

```powershell
npm test
node patch.cjs stage
```

完全退出 OpenCode Desktop，再执行：

```powershell
node patch.cjs install
```

重新打开 Desktop，在任意会话右上角点击 `缓存 ... · ... Token` 查看明细。
也可以运行 `powershell -NoProfile -File .\restart.ps1` 请求正常退出、安装并重启。
脚本不会强制结束未退出的进程，也不会停止 OpenCode 后台服务。

默认安装目录为 `%LOCALAPPDATA%\Programs\@opencode-aidesktop`。
原包备份保存在 `%LOCALAPPDATA%\opencode-ui-patches\2.0.29`。
Desktop 升级后可能覆盖补丁；其他版本需要重新适配。

## 恢复

完全退出 Desktop，在相同源码版本的仓库目录中执行：

```powershell
node patch.cjs restore
```

恢复操作会核对当前包是否仍为此补丁生成的版本，避免覆盖后续升级或其他修改。
请保留原包备份和安装时的源码版本。

## 统计口径

- 累计量和费用来自当前会话的原生元数据，包含插件安装前的已有用量。
- 不包含子代理会话；最近调用仅展示已加载消息中的最后 12 条。
- 缓存读取占比为 `cache.read / (input + cache.read)`，不含缓存写入。
- V2 输出和推理分别累加，不重复计算。
- 费用是 OpenCode 记录值，可能为零，不代表服务商实际账单。
- 不调用模型、不额外轮询数据库、不保存聊天内容或凭据。

## Development and implementation

Local renderer extension for OpenCode Desktop 2.0.29. It adds a session-header
cache/token button and an expandable native side-panel tab. No model requests,
polling, external server, credentials, or conversation logging are required.

The public server-plugin API is not the Desktop renderer API. Desktop 2.0.29
contains the GUI extension SDK but only loads built-in renderer definitions.
Discovering its archive installer does not establish third-party GUI support.
This patch registers one additional built-in definition in the shipped renderer;
it does not enable arbitrary renderer extension loading.

Run from this directory:

```powershell
node --test panel.test.cjs
node patch.cjs stage
```

Exit all OpenCode Desktop windows before installation or restoration:

```powershell
node patch.cjs install
node patch.cjs restore
```

Backups are stored under `%LOCALAPPDATA%\opencode-ui-patches\2.0.29`.
The installer refuses other versions, an incompatible renderer, a conflicting
backup, or a running Desktop. Restore refuses archives changed after installation.
Desktop upgrades can replace the patched renderer and require a new adaptation.

Totals come from the current session's native `Session.Info.tokens` and `cost`.
Output and reasoning are separate V2 counters. Child sessions are excluded.
The recent-call list is limited to already loaded messages. Missing cumulative
metadata falls back to loaded messages with an explicit incomplete-data label.
The cache ratio is `read / (input + read)` and excludes cache writes.

Verification before installation: four metric tests; sandboxed Electron fixture
with summary click, reactive update and panel-width assertions; all 8,289 packed
files compared between original and staged archives with exactly one renderer
entry changed; staged renderer syntax checked.

Installed on 2026-10-15 and verified in the real Desktop 2.0.29 window: the
session-header counter updated during ongoing work, clicking it opened the
native Token Usage side tab, and the cumulative metrics, cache bar and recent
calls rendered correctly. Screen capture required DPI awareness on this 125%
Windows display. Normal Windows mouse input needed a press/release interval.
The backend service was not stopped and conversation data was not changed.

`renderer.cjs` contains the metrics and UI; `patch.cjs` implements version checks,
ASAR repacking, backup and restore. `smoke.cjs` runs a sandboxed Electron fixture;
launch it with an existing Electron executable to test DOM interaction and layout.
Temporary fixture data is written under `%LOCALAPPDATA%\Temp\opencode`.

The repository contains only original patch source and tests. It does not
redistribute OpenCode application archives, local configuration or conversation data.

## License

MIT. This is an independent community project, not an official OpenCode release.
