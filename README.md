# Cline Chat for Windows

A polished, dark-only Windows desktop chat client for Cline models.

> [!NOTE]
> This is an independent, unofficial client and is not affiliated with or endorsed by Cline Bot Inc.

![Cline Chat main interface](docs/screenshots/cline-chat-main.png)

## Highlights

- Sign in with a Cline account through the system browser
- Show the Cline device code in-app while browser authorization completes
- Browse, search, pin, rename, share, delete, reopen, and continue conversation history
- Stream clean, structured responses with an animated Thinking state and completion timing
- Load the signed-in account's available Cline models, including favorites, tier, and vision details
- Attach or paste images, add source files, and extract context from PDF and Word documents
- See context, token, and cost usage for the current conversation
- Render messages in copyable cards with Markdown, tables, lists, links, and code blocks
- Choose Plan or Act mode
- Use a focused dark interface with native Windows window controls
- Pick an accent preset or any custom accent color; the choice is saved locally
- Upload a local profile picture and configure chat behavior
- Check for, download, verify, and install updates from GitHub Releases

![GitHub update settings](docs/screenshots/cline-chat-settings.png)

## Why the Cline SDK instead of bundling the CLI?

The Cline CLI is a capable automation surface and provides JSON output, authentication, model flags, history, resume, and Windows binaries. For a long-lived graphical client, however, the official [`@cline/sdk`](https://github.com/cline/cline/tree/main/sdk) is the stronger integration boundary. It exposes structured session events, model discovery, provider settings, OAuth helpers, persisted transcripts, and usage data without parsing terminal output.

Cline's own [desktop application example](https://github.com/cline/cline/tree/main/apps/examples/desktop-app) uses the same overall architecture: a Tauri shell, React interface, and Bun-based local service built on `ClineCore`. Cline Chat follows that supported pattern while keeping the product focused on chat.

## Architecture

```text
React interface in Tauri WebView2
              │
       authenticated localhost WebSocket
              │
Bun sidecar using @cline/sdk / ClineCore
              │
 Cline OAuth, models, sessions, and providers
```

- **Desktop shell:** Tauri 2, configured only for Windows installers.
- **Interface:** React 19, TypeScript, and a custom dark design system.
- **Cline service:** A compiled Bun sidecar using `@cline/sdk` in local mode.
- **Local security:** The sidecar binds only to `127.0.0.1`; each launch gets a random transport token shared directly with the WebView.
- **Credentials and history:** Managed by Cline's SDK/provider storage rather than duplicated in browser storage. Appearance, chat preferences, and an optional profile image are stored only in the local WebView profile.
- **Safety:** This chat-focused release disables autonomous tool execution. Attached files are supplied as model context.
- **Background process:** Tauri launches the bundled Cline service without a visible console window and terminates it with the app; it does not install a machine-wide Windows service or require administrator access.

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

### Requirements

- Windows 10 or 11, x64
- Node.js 22+
- pnpm 11+
- Rust stable with the MSVC toolchain
- Microsoft Edge WebView2 Runtime

### Run the interface

```powershell
pnpm install
pnpm dev
```

The browser preview includes representative conversations so the complete interface can be reviewed without signing in.

### Run the Windows application

```powershell
pnpm dev:desktop
```

### Test and package

```powershell
pnpm check
pnpm build:sidecar
pnpm exec tauri build
```

The final command creates NSIS and MSI installer files under `src-tauri/target/release/bundle`. Authenticode signing is intentionally left to the release owner.

## Signed updates and releases

The app checks `https://github.com/sethrickert/cline-app/releases/latest/download/latest.json`. Update archives are verified with the public key embedded in the application before Tauri starts the passive Windows installer.

The included GitHub Actions workflow builds a release whenever a `v*` tag is pushed. Before publishing the first release:

1. Add the updater private key as the repository secret `TAURI_SIGNING_PRIVATE_KEY`.
2. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only if that private key has a password.
3. Keep the private key outside the repository and back it up securely. Losing it prevents existing installations from accepting future updates.
4. Bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, then push a matching tag such as `v1.2.0`.

The workflow publishes the installers, signed updater artifacts, and `latest.json` to the public GitHub Release. The first installation is still manual; automatic updates work after a release newer than the installed version exists.

## Keyboard shortcuts

- `Ctrl+K` — search conversations
- `Ctrl+,` — open Settings
- `Enter` — send a message
- `Shift+Enter` — insert a new line

## Project status

Before a production release, configure Windows Authenticode signing, add the updater signing secret, publish a privacy policy, and run release QA for the Cline OAuth flow with a real account.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
