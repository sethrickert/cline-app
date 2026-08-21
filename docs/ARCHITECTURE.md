# Architecture and integration notes

## Verified Cline capabilities

Research was performed against the public Cline repository and the installed `@cline/sdk` package rather than assumptions about the extension API.

| Requirement | Cline surface used by this app |
| --- | --- |
| Account login | SDK OAuth helper and Cline account service |
| Model selection | Provider model discovery and session model updates |
| Streaming chat | Typed `ClineCore` agent events (raw JSONL chunks are never rendered) |
| File context | SDK `userFiles` input |
| Conversation history | SDK SQLite-backed session list and display transcript projection |
| Usage | Structured usage events with input/output tokens and cost |
| Stop generation | SDK session abort |

## SDK versus CLI

The [Cline CLI](https://github.com/cline/cline/tree/main/apps/cli) is appropriate for terminals, scripts, and CI. It supports structured JSON output and ships native Windows binaries. A graphical client would still need to supervise the process, correlate streamed lines, manage cancellation, recover after crashes, and translate terminal-oriented approvals.

The [`@cline/sdk`](https://github.com/cline/cline/tree/main/sdk) exposes those concepts as APIs and events. Cline also publishes a [Tauri desktop example](https://github.com/cline/cline/tree/main/apps/examples/desktop-app), which makes the SDK the lower-risk and more maintainable choice for this product.

## Process model

Tauri owns the Windows window and starts one compiled Bun sidecar without a visible console. The sidecar owns `ClineCore` and listens on an ephemeral localhost port. Its WebSocket upgrade requires a cryptographically random per-launch token supplied by Tauri. The service is terminated when the application window closes, avoiding the administrator access and orphan-process risks of a machine-wide Windows service.

The React process sends commands with request IDs and receives typed response/event envelopes. It never receives the provider credential itself.

## Data boundaries

- Cline provider settings and sessions use SDK-managed local persistence.
- UI appearance, behavior preferences, and an optional locally selected profile image use browser-local storage inside the Tauri WebView.
- Attachments are passed to the SDK by local file path and are not copied into this repository.
- The browser-only preview deliberately falls back to seeded demonstration data.

## Release boundaries

The checked-in configuration targets Windows x64 and produces NSIS and MSI installers. WebView2 uses Tauri's download bootstrapper. Tagged GitHub Actions releases also emit Tauri updater artifacts and `latest.json`; the app verifies them with its embedded public key before passive installation. Production releases should add Authenticode signing and a release-specific Cline OAuth redirect configuration.
