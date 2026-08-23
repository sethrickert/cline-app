import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import type { ServerWebSocket } from "bun";
import {
  ClineAccountService,
  ClineCore,
  completeClineDeviceAuth,
  getLocalProviderModels,
  ProviderSettingsManager,
  resolveLocalClineAuthToken,
  saveLocalProviderOAuthCredentials,
  startClineDeviceAuth,
} from "@cline/sdk";
import type { CoreSessionEvent } from "@cline/sdk";
import { prepareAttachments } from "./attachments";

type Json = Record<string, unknown>;
type ClientData = { authenticated: boolean };
type Socket = ServerWebSocket<ClientData>;

const manager = new ProviderSettingsManager();
const sockets = new Set<Socket>();
const sessionModels = new Map<string, string>();
const modelContexts = new Map<string, number>();
const sessionStartedAt = new Map<string, number>();
const sessionUsage = new Map<string, ReturnType<typeof createUsage>>();
const transportToken = process.env.CLINE_CHAT_TOKEN ?? crypto.randomUUID();
let authAttempt = 0;
let core: ClineCore;

function createUsage(maxTokens = 200_000) {
  return { contextPercent: 0, usedTokens: 0, maxTokens, inputTokens: 0, outputTokens: 0, totalCost: 0 };
}

function openExternal(url: string) {
  const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function send(socket: Socket, value: unknown) {
  socket.send(JSON.stringify(value));
}

function validTransportToken(candidate: string | null) {
  if (!candidate) return false;
  const expected = Buffer.from(transportToken);
  const supplied = Buffer.from(candidate);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function broadcast(name: string, payload: Json) {
  const envelope = JSON.stringify({ type: "event", event: { name, payload } });
  sockets.forEach((socket) => socket.send(envelope));
}

function usagePayload(sessionId: string, event: Extract<CoreSessionEvent, { type: "agent_event" }>["payload"]["event"]) {
  if (event.type !== "usage") return undefined;
  const maxTokens = modelContexts.get(sessionModels.get(sessionId) ?? "") ?? 200_000;
  const usedTokens = event.totalInputTokens + event.totalOutputTokens;
  const usage = {
    contextPercent: Math.min(100, Math.round((usedTokens / maxTokens) * 100)),
    usedTokens,
    maxTokens,
    inputTokens: event.totalInputTokens,
    outputTokens: event.totalOutputTokens,
    totalCost: event.totalCost ?? 0,
  };
  sessionUsage.set(sessionId, usage);
  return usage;
}

function displayText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (!block || typeof block !== "object") return "";
    const item = block as Json;
    if (item.type === "text") return String(item.text ?? "");
    if (item.type === "file") return `[Attached file: ${String(item.path ?? "file")}]`;
    if (item.type === "tool_use") return `Used ${String(item.name ?? "a tool")}`;
    if (item.type === "tool_result") return displayText(item.content);
    return "";
  }).filter(Boolean).join("\n\n");
}

function forwardCoreEvent(event: CoreSessionEvent) {
  // The raw `agent` chunk stream is newline-delimited JSON. The structured
  // agent_event branch below is the presentation-safe source for chat UIs.
  if (event.type === "chunk") return;
  if (event.type === "agent_event") {
    const sessionId = event.payload.sessionId;
    const agentEvent = event.payload.event;
    if (agentEvent.type === "iteration_start") broadcast("chat.event", { sessionId, phase: "thinking" });
    if (agentEvent.type === "content_start" && agentEvent.contentType === "reasoning") broadcast("chat.event", { sessionId, phase: "thinking" });
    if (agentEvent.type === "content_start" && agentEvent.contentType === "text" && agentEvent.text) {
      broadcast("chat.event", { sessionId, phase: "responding", text: agentEvent.text });
    }
    const usage = usagePayload(sessionId, agentEvent);
    if (usage) broadcast("chat.event", { sessionId, usage });
    if (agentEvent.type === "error") {
      const raw = agentEvent.error instanceof Error ? agentEvent.error.message : String(agentEvent.error);
      const message = raw.toLowerCase().includes("unauthorized")
        ? "Your Cline session is no longer authorized. Sign out, then connect your account again."
        : raw;
      broadcast("chat.error", { sessionId, message });
    }
    if (agentEvent.type === "done") {
      const completedInMs = Math.max(0, Date.now() - (sessionStartedAt.get(sessionId) ?? Date.now()));
      broadcast("chat.event", { sessionId, done: true, usage: sessionUsage.get(sessionId), completedInMs });
      sessionStartedAt.delete(sessionId);
    }
    return;
  }
  if (event.type === "ended") {
    const sessionId = event.payload.sessionId;
    if (!sessionStartedAt.has(sessionId)) return;
    const completedInMs = Math.max(0, Date.now() - (sessionStartedAt.get(sessionId) ?? Date.now()));
    broadcast("chat.event", { sessionId, done: true, usage: sessionUsage.get(sessionId), completedInMs });
    sessionStartedAt.delete(sessionId);
  }
}

async function initialize() {
  core = await ClineCore.create({
    clientName: "cline-chat-windows",
    backendMode: "local",
  });
  core.subscribe(forwardCoreEvent);
}

function toAccount(user: Json, balance?: Json, plan?: Json) {
  const displayName = String(user.displayName ?? user.name ?? user.email ?? "Cline user");
  const planLabel = findAccountLabel(plan) ?? findAccountLabel(user.subscription as Json | undefined) ?? findAccountLabel(user.plan as Json | undefined) ?? "Cline account";
  const rawBalance = Number(balance?.balance ?? balance?.credits ?? balance?.amount ?? 0);
  return {
    signedIn: true,
    name: displayName,
    email: String(user.email ?? ""),
    avatar: displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    photoUrl: typeof user.photoUrl === "string" ? user.photoUrl : undefined,
    plan: planLabel,
    credits: Number.isFinite(rawBalance) ? rawBalance / 1_000_000_000 : undefined,
    createdAt: typeof user.createdAt === "string" ? user.createdAt : undefined,
    organizations: Array.isArray(user.organizations) ? user.organizations.length : 0,
  };
}

function findAccountLabel(value: Json | undefined, depth = 0): string | undefined {
  if (!value || depth > 3) return undefined;
  for (const key of ["displayName", "planName", "subscriptionName", "tierName", "name", "tier", "type"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim() && !["active", "enabled", "subscription"].includes(candidate.toLowerCase())) return candidate.trim();
  }
  for (const key of ["plan", "subscription", "currentPlan", "product", "price"]) {
    const nested = value[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const label = findAccountLabel(nested as Json, depth + 1);
      if (label) return label;
    }
  }
  return undefined;
}

async function getAccount() {
  const settings = manager.getProviderSettings("cline");
  const token = resolveLocalClineAuthToken(settings);
  if (!token) return { signedIn: false, name: "", email: "", avatar: "?" };
  const service = new ClineAccountService({
    apiBaseUrl: "https://api.cline.bot",
    getAuthToken: async () => token,
  });
  const user = await service.fetchMe() as unknown as Json;
  let balance: Json | undefined;
  let plan: Json | undefined;
  try { balance = await service.fetchBalance(String(user.id ?? "")) as unknown as Json; } catch { /* A profile is still useful without billing scope. */ }
  try { plan = await service.fetchCurrentUserPlan() as unknown as Json; } catch { /* Plans are not available for every account type. */ }
  return toAccount(user, balance, plan);
}

function hasClineAccount() {
  return Boolean(resolveLocalClineAuthToken(manager.getProviderSettings("cline")));
}

function requireClineAccount() {
  if (!hasClineAccount()) throw new Error("Connect your Cline account before sending a message.");
}

async function handle(command: string, args: Json = {}): Promise<unknown> {
  if (command === "health") return { ok: true, sdk: "@cline/sdk", platform: process.platform };
  if (command === "models.list") {
    if (!hasClineAccount()) return { models: [] };
    const result = await getLocalProviderModels("cline", manager.getProviderConfig("cline", { includeKnownModels: true }));
    const chatModels = result.models.filter((model) => {
      const operation = (model as unknown as Json).operation;
      return !operation || operation === "language";
    });
    chatModels.forEach((model) => modelContexts.set(model.id, model.contextWindow ?? 200_000));
    return {
      models: chatModels.map((model) => {
        const metadata = model as unknown as Json;
        const featured = metadata.featured as Json | undefined;
        const inputModalities = metadata.inputModalities as unknown[] | undefined;
        const rawLabel = model.name || model.id.split("/").at(-1) || model.id;
        const pricingValues = metadata.pricing && typeof metadata.pricing === "object" ? Object.values(metadata.pricing as Json).filter((value): value is number => typeof value === "number") : [];
        const free = featured?.tier === "free" || /\(free\)/i.test(rawLabel) || pricingValues.length > 0 && pricingValues.every((value) => value === 0);
        const recommended = featured?.tier === "recommended" || featured?.recommended === true || metadata.recommended === true;
        return ({
        id: model.id,
        label: rawLabel.replace(/\s*\(free\)\s*/gi, "").trim(),
        provider: "Cline",
        contextWindow: model.contextWindow ?? 200_000,
        recommended,
        free,
        tier: free ? "free" : recommended ? "recommended" : featured?.tier,
        supportsVision: model.supportsVision ?? inputModalities?.includes("image") ?? false,
      }); }),
    };
  }
  if (command === "account.get") return { account: await getAccount() };
  if (command === "auth.begin") {
    const attempt = ++authAttempt;
    const authorization = await startClineDeviceAuth();
    const url = authorization.verificationUriComplete ?? authorization.verificationUri;
    openExternal(url);
    void completeClineDeviceAuth({
      deviceCode: authorization.deviceCode,
      expiresInSeconds: authorization.expiresInSeconds,
      pollIntervalSeconds: authorization.pollIntervalSeconds,
      apiBaseUrl: "https://api.cline.bot",
      provider: "cline",
    }).then(async (credentials) => {
      if (attempt !== authAttempt) return;
      saveLocalProviderOAuthCredentials(manager, "cline", manager.getProviderSettings("cline"), credentials, { setLastUsed: true });
      broadcast("auth.event", { state: "complete", account: await getAccount() });
    }).catch((error: unknown) => {
      if (attempt !== authAttempt) return;
      broadcast("auth.event", { state: "error", message: error instanceof Error ? error.message : String(error) });
    });
    return { userCode: authorization.userCode, url, expiresInSeconds: authorization.expiresInSeconds };
  }
  if (command === "auth.logout") {
    authAttempt += 1;
    const state = manager.read();
    delete state.providers.cline;
    if (state.lastUsedProvider === "cline") state.lastUsedProvider = undefined;
    manager.write(state);
    return { account: { signedIn: false, name: "", email: "", avatar: "?" } };
  }
  if (command === "history.list") {
    const history = await core.list(200);
    return {
      conversations: history.map((record) => {
        const row = record as unknown as Json;
        return {
          id: String(row.sessionId ?? row.id),
          sessionId: String(row.sessionId ?? row.id),
          title: String(row.title ?? (row.metadata as Json | undefined)?.title ?? "Cline conversation"),
          updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
          messages: [],
          usage: { contextPercent: 0, usedTokens: 0, maxTokens: 200_000, inputTokens: 0, outputTokens: 0, totalCost: 0 },
        };
      }),
    };
  }
  if (command === "history.read") {
    const sessionId = String(args.sessionId ?? "");
    const transcript = await core.readDisplayMessages(sessionId);
    return {
      messages: transcript.map(({ message }, index) => ({
        id: message.id ?? `${sessionId}-${index}`,
        role: message.role,
        content: displayText(message.content),
        createdAt: message.ts ? new Date(message.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "",
        model: message.modelInfo?.id,
        streaming: false,
      })).filter((message) => message.content),
    };
  }
  if (command === "history.rename") {
    const sessionId = String(args.sessionId ?? "");
    const title = String(args.title ?? "").trim().slice(0, 120);
    if (!sessionId || !title) throw new Error("A conversation and title are required");
    await core.update(sessionId, { title });
    return { sessionId, title };
  }
  if (command === "history.delete") {
    const sessionId = String(args.sessionId ?? "");
    return { deleted: sessionId ? await core.delete(sessionId) : false };
  }
  if (command === "chat.start") {
    requireClineAccount();
    const sessionId = String(args.sessionId ?? crypto.randomUUID());
    const modelId = String(args.modelId ?? "");
    if (!modelId) throw new Error("Choose a model before sending a message.");
    sessionModels.set(sessionId, modelId);
    sessionStartedAt.set(sessionId, Date.now());
    sessionUsage.set(sessionId, createUsage(modelContexts.get(modelId) ?? 200_000));
    const prepared = await prepareAttachments(String(args.prompt ?? ""), args.attachments);
    void core.start({
      prompt: prepared.prompt,
      interactive: true,
      userImages: prepared.userImages,
      userFiles: prepared.userFiles,
      config: {
        sessionId,
        providerId: "cline",
        modelId,
        systemPrompt: "You are Cline in a Windows desktop chat. Be clear, useful, and concise. Use attached context when provided.",
        cwd: homedir(),
        enableTools: false,
        enableSpawnAgent: false,
        enableAgentTeams: false,
      },
    }).catch((error: unknown) => broadcast("chat.error", { sessionId, message: error instanceof Error ? error.message : String(error) }));
    return { sessionId };
  }
  if (command === "chat.send") {
    requireClineAccount();
    const sessionId = String(args.sessionId ?? "");
    sessionStartedAt.set(sessionId, Date.now());
    const prepared = await prepareAttachments(String(args.prompt ?? ""), args.attachments);
    void core.send({ sessionId, prompt: prepared.prompt, mode: args.mode === "plan" ? "plan" : "act", userImages: prepared.userImages, userFiles: prepared.userFiles })
      .catch((error: unknown) => broadcast("chat.error", { sessionId, message: error instanceof Error ? error.message : String(error) }));
    return { sessionId };
  }
  if (command === "chat.abort") {
    await core.abort(String(args.sessionId ?? ""), "Stopped from Cline Chat");
    return { stopped: true };
  }
  if (command === "chat.model") {
    const sessionId = String(args.sessionId ?? "");
    const modelId = String(args.modelId ?? "");
    await core.updateSessionModel(sessionId, modelId);
    sessionModels.set(sessionId, modelId);
    return { sessionId, modelId };
  }
  if (command === "app.openExternal") {
    const url = new URL(String(args.url ?? ""));
    const allowed = url.protocol === "https:" && ["github.com", "cline.bot", "www.cline.bot", "app.cline.bot"].includes(url.hostname);
    if (!allowed) throw new Error("That link is not allowed");
    openExternal(url.toString());
    return { opened: true };
  }
  throw new Error(`Unsupported command: ${command}`);
}

await initialize();

const server = Bun.serve<ClientData>({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/transport" && validTransportToken(url.searchParams.get("token")) && server.upgrade(request, { data: { authenticated: true } })) return undefined;
    if (url.pathname === "/health") return Response.json({ ok: true });
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(socket) { sockets.add(socket); },
    async message(socket, raw) {
      let id = "unknown";
      try {
        const request = JSON.parse(String(raw)) as { id: string; command: string; args?: Json };
        id = request.id;
        const result = await handle(request.command, request.args);
        send(socket, { type: "response", id, ok: true, result });
      } catch (error) {
        send(socket, { type: "response", id, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    },
    close(socket) { sockets.delete(socket); },
  },
});

console.log(JSON.stringify({ type: "ready", wsEndpoint: `ws://127.0.0.1:${server.port}/transport`, pid: process.pid }));

async function shutdown() {
  server.stop(true);
  await core.dispose("Cline Chat closed");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
