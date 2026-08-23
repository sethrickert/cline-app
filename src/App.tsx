import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarCropDialog } from "./components/AvatarCropDialog";
import { AppContextMenu } from "./components/AppContextMenu";
import { ChatHeader } from "./components/ChatHeader";
import { ChatMessages } from "./components/ChatMessages";
import { Composer } from "./components/Composer";
import { DeleteDialog, RenameDialog } from "./components/ConversationDialogs";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { WindowBar } from "./components/WindowBar";
import { DEMO_ACCOUNT, DEMO_CONVERSATIONS, MODELS } from "./data/demo";
import { desktopClient } from "./lib/desktop-client";
import { loadPreferences, savePreferences } from "./lib/preferences";
import { applyTheme, loadTheme, saveTheme, type ThemePreference } from "./lib/theme";
import { checkForAppUpdate, getAppVersion, installAppUpdate } from "./lib/updater";
import type { Account, AgentMode, AppPreferences, Attachment, AvatarCrop, Conversation, DesktopEvent, Message, ModelOption, SettingsSection, UpdateState } from "./types";

const EMPTY_USAGE = { contextPercent: 0, usedTokens: 0, maxTokens: 200_000, inputTokens: 0, outputTokens: 0, totalCost: 0 };
const SIGNED_OUT_ACCOUNT: Account = { signedIn: false, name: "", email: "", avatar: "?" };
const DESKTOP_MODE = desktopClient.available;

function createConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", updatedAt: new Date().toISOString(), messages: [], usage: { ...EMPTY_USAGE } };
}

function updateConversation(items: Conversation[], id: string, updater: (item: Conversation) => Conversation) {
  return items.map((item) => item.id === id ? updater(item) : item);
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("unauthorized")) return "Your Cline session is no longer authorized. Sign out, then connect your account again.";
  return message || "Cline could not complete that request.";
}

export default function App() {
  const initialDesktopConversation = useRef<Conversation | null>(null);
  if (!initialDesktopConversation.current) initialDesktopConversation.current = createConversation();
  const [theme, setTheme] = useState<ThemePreference>(() => loadTheme());
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [conversations, setConversations] = useState<Conversation[]>(() => DESKTOP_MODE ? [initialDesktopConversation.current!] : DEMO_CONVERSATIONS);
  const [activeId, setActiveId] = useState(() => DESKTOP_MODE ? initialDesktopConversation.current!.id : DEMO_CONVERSATIONS[0].id);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<AgentMode>("act");
  const [modelId, setModelId] = useState(() => DESKTOP_MODE ? "" : MODELS[0].id);
  const [models, setModels] = useState<ModelOption[]>(() => DESKTOP_MODE ? [] : MODELS);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("appearance");
  const [pendingProfilePhoto, setPendingProfilePhoto] = useState<string>();
  const [pendingProfileCrop, setPendingProfileCrop] = useState<AvatarCrop>();
  const [account, setAccount] = useState<Account>(() => DESKTOP_MODE ? SIGNED_OUT_ACCOUNT : DEMO_ACCOUNT);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [deviceCode, setDeviceCode] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionConversationId, setActionConversationId] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [updateState, setUpdateState] = useState<UpdateState>({ currentVersion: "1.2.0", checking: false, installing: false, available: false });
  const streamTimer = useRef<number | undefined>(undefined);

  const active = useMemo(() => conversations.find((item) => item.id === activeId) ?? conversations[0], [activeId, conversations]);
  const actionConversation = useMemo(() => conversations.find((item) => item.id === actionConversationId) ?? active, [actionConversationId, active, conversations]);
  const displayAccount = useMemo(() => ({ ...account, photoUrl: preferences.profilePhoto || account.photoUrl, photoCrop: preferences.profilePhoto ? preferences.profilePhotoCrop : undefined }), [account, preferences.profilePhoto, preferences.profilePhotoCrop]);

  const openAccountSettings = useCallback(() => { setSettingsSection("account"); setSettingsOpen(true); }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? undefined : current), 2200);
  }, []);

  const loadAccountModels = useCallback(async () => {
    const result = await desktopClient.invoke<{ models: ModelOption[] }>("models.list");
    setModels(result.models ?? []);
    setModelId((current) => result.models.some((model) => model.id === current) ? current : result.models.find((model) => model.recommended)?.id ?? result.models[0]?.id ?? "");
  }, []);

  useEffect(() => { applyTheme(theme); saveTheme(theme); }, [theme]);
  useEffect(() => { savePreferences(preferences); }, [preferences]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === ",") { event.preventDefault(); setSettingsSection("appearance"); setSettingsOpen(true); }
      if (event.key === "Escape") { setSettingsOpen(false); setPendingProfilePhoto(undefined); setRenameOpen(false); setDeleteOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleDesktopEvent = useCallback((event: DesktopEvent) => {
    if (event.name === "auth.event") {
      const payload = event.payload as { state?: string; account?: Account; message?: string };
      if (payload.state === "complete" && payload.account) {
        setAccount(payload.account);
        setAuthBusy(false);
        setDeviceCode(undefined);
        setAuthError(undefined);
        void loadAccountModels().catch((error) => setAuthError(friendlyError(error)));
      }
      if (payload.state === "error") { setAuthBusy(false); setAuthError(payload.message || "Sign-in did not complete."); }
      return;
    }
    if (event.name === "chat.error") {
      const payload = event.payload as { sessionId?: string; message?: string };
      if (!payload.sessionId) return;
      setConversations((items) => items.map((conversation) => {
        if (conversation.sessionId !== payload.sessionId) return conversation;
        const messages = [...conversation.messages];
        const last = messages.at(-1);
        if (last?.role === "assistant") messages[messages.length - 1] = { ...last, content: payload.message || "Cline could not complete that request.", streaming: false, error: true };
        return { ...conversation, messages };
      }));
      setStreaming(false);
      return;
    }
    if (event.name === "chat.event") {
      const payload = event.payload as { sessionId?: string; text?: string; phase?: Message["phase"]; done?: boolean; usage?: Conversation["usage"]; completedInMs?: number };
      if (!payload.sessionId) return;
      setConversations((items) => items.map((conversation) => {
        if (conversation.sessionId !== payload.sessionId) return conversation;
        const messages = [...conversation.messages];
        const last = messages.at(-1);
        if (last?.role === "assistant") messages[messages.length - 1] = { ...last, content: last.content + (payload.text ?? ""), phase: payload.phase ?? last.phase, streaming: !payload.done, completedInMs: payload.done ? payload.completedInMs : last.completedInMs };
        return { ...conversation, messages, usage: payload.usage ?? conversation.usage };
      }));
      if (payload.done) setStreaming(false);
    }
  }, [loadAccountModels]);

  useEffect(() => {
    const unsubscribe = desktopClient.subscribe(handleDesktopEvent);
    void (async () => {
      if (!(await desktopClient.connect())) return;
      const [historyResult, accountResult] = await Promise.allSettled([
          desktopClient.invoke<{ conversations: Conversation[] }>("history.list"),
          desktopClient.invoke<{ account: Account }>("account.get"),
        ]);
      if (historyResult.status === "fulfilled" && historyResult.value.conversations?.length) {
        setConversations(historyResult.value.conversations);
        setActiveId(historyResult.value.conversations[0].id);
      }
      if (accountResult.status === "fulfilled") {
        setAccount(accountResult.value.account);
        if (accountResult.value.account.signedIn) await loadAccountModels().catch((error) => setAuthError(friendlyError(error)));
        else { setModels([]); setModelId(""); }
      } else {
        setAccount(SIGNED_OUT_ACCOUNT);
        setModels([]);
        setModelId("");
        setAuthError(friendlyError(accountResult.reason));
      }
    })();
    return unsubscribe;
  }, [handleDesktopEvent, loadAccountModels]);

  const checkUpdates = useCallback(async (silent = false) => {
    setUpdateState((state) => ({ ...state, checking: true, error: undefined }));
    try {
      const result = await checkForAppUpdate();
      setUpdateState({ ...result, checking: false, installing: false, lastChecked: new Date().toISOString() });
      if (!silent && !result.available) showToast(result.statusMessage ?? "Cline Chat is up to date");
    } catch (error) {
      setUpdateState((state) => ({ ...state, checking: false, error: friendlyError(error), lastChecked: new Date().toISOString() }));
    }
  }, [showToast]);

  useEffect(() => {
    void getAppVersion().then((currentVersion) => setUpdateState((state) => ({ ...state, currentVersion })));
    if (DESKTOP_MODE && preferences.autoCheckUpdates) {
      const timer = window.setTimeout(() => void checkUpdates(true), 1800);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setUpdateState((state) => ({ ...state, installing: true, progress: 0, error: undefined }));
    try { await installAppUpdate((progress) => setUpdateState((state) => ({ ...state, progress }))); }
    catch (error) { setUpdateState((state) => ({ ...state, installing: false, error: friendlyError(error) })); }
  }, []);

  const newConversation = useCallback(() => {
    const next = createConversation();
    startTransition(() => { setConversations((items) => [next, ...items]); setActiveId(next.id); setAttachments([]); });
  }, []);

  const selectConversation = useCallback((id: string) => {
    startTransition(() => { setActiveId(id); setAttachments([]); });
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation?.sessionId || conversation.messages.length) return;
    void desktopClient.invoke<{ messages: Message[] }>("history.read", { sessionId: conversation.sessionId }).then((result) => setConversations((items) => updateConversation(items, id, (item) => ({ ...item, messages: result.messages })))).catch(() => undefined);
  }, [conversations]);

  const stop = useCallback(() => {
    if (streamTimer.current) window.clearInterval(streamTimer.current);
    streamTimer.current = undefined;
    setStreaming(false);
    setConversations((items) => updateConversation(items, activeId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.streaming ? { ...message, streaming: false } : message) })));
    if (active?.sessionId) void desktopClient.invoke("chat.abort", { sessionId: active.sessionId }).catch(() => undefined);
  }, [active?.sessionId, activeId]);

  useEffect(() => () => { if (streamTimer.current) window.clearInterval(streamTimer.current); }, []);

  const streamDemo = useCallback((conversationId: string) => {
    const response = "I’ve got it. I’ll use the attached context and work through this in a clear sequence.\n\n## First pass\n\nI’ll inspect the relevant files, identify the smallest safe change, and keep the implementation aligned with the existing architecture.";
    let index = 0;
    const started = Date.now();
    streamTimer.current = window.setInterval(() => {
      const chunk = response.slice(index, index + 4); index += 4;
      setConversations((items) => updateConversation(items, conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message, messageIndex) => messageIndex === conversation.messages.length - 1 ? { ...message, content: message.content + chunk, phase: "responding" } : message) })));
      if (index >= response.length) {
        if (streamTimer.current) window.clearInterval(streamTimer.current);
        streamTimer.current = undefined; setStreaming(false);
        setConversations((items) => updateConversation(items, conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.streaming ? { ...message, streaming: false, completedInMs: Date.now() - started } : message) })));
      }
    }, 25);
  }, []);

  const markChatError = useCallback((conversationId: string, error: unknown) => {
    setStreaming(false);
    setConversations((items) => updateConversation(items, conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message, index) => index === conversation.messages.length - 1 && message.role === "assistant" ? { ...message, content: friendlyError(error), streaming: false, error: true } : message) })));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!active) return;
    if (!account.signedIn) { openAccountSettings(); return; }
    if (!modelId) { setSettingsSection("account"); setSettingsOpen(true); return; }
    const selectedModel = models.find((model) => model.id === modelId);
    if (attachments.some((attachment) => attachment.kind === "image") && !selectedModel?.supportsVision) {
      showToast("This model cannot view images. Choose a model marked Vision and try again.");
      return;
    }
    const currentId = active.id;
    const sessionId = active.sessionId ?? crypto.randomUUID();
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), attachments };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), model: models.find((model) => model.id === modelId)?.label, streaming: true, phase: "thinking" };
    setConversations((items) => updateConversation(items, currentId, (conversation) => ({ ...conversation, sessionId, title: conversation.messages.length ? conversation.title : text.slice(0, 46), updatedAt: new Date().toISOString(), messages: [...conversation.messages, userMessage, assistantMessage] })));
    setAttachments([]); setStreaming(true);
    if (!DESKTOP_MODE) { streamDemo(currentId); return; }
    try {
      if (!(await desktopClient.connect())) throw new Error("The Cline background service is unavailable. Restart Cline Chat and try again.");
      await desktopClient.invoke(active.sessionId ? "chat.send" : "chat.start", { sessionId, prompt: text, modelId, mode, attachments });
    } catch (error) { markChatError(currentId, error); }
  }, [account.signedIn, active, attachments, markChatError, mode, modelId, models, openAccountSettings, showToast, streamDemo]);

  const changeModel = useCallback((nextModelId: string) => {
    setModelId(nextModelId);
    if (active?.sessionId) void desktopClient.invoke("chat.model", { sessionId: active.sessionId, modelId: nextModelId }).catch((error) => showToast(friendlyError(error)));
  }, [active?.sessionId, showToast]);

  const toggleFavoriteModel = useCallback((id: string) => setPreferences((current) => ({ ...current, favoriteModelIds: current.favoriteModelIds.includes(id) ? current.favoriteModelIds.filter((item) => item !== id) : [...current.favoriteModelIds, id] })), []);

  const togglePinnedConversation = useCallback((id: string) => setPreferences((current) => ({ ...current, pinnedConversationIds: current.pinnedConversationIds.includes(id) ? current.pinnedConversationIds.filter((item) => item !== id) : [id, ...current.pinnedConversationIds] })), []);

  const addAttachments = useCallback((items: Attachment[]) => {
    setAttachments((current) => {
      const keys = new Set(current.map((item) => (item.path ? `path:${item.path.toLowerCase()}` : item.dataUrl ? `data:${item.dataUrl}` : `name:${item.name}:${item.detail}`)));
      const unique = items.filter((item) => {
        const key = item.path ? `path:${item.path.toLowerCase()}` : item.dataUrl ? `data:${item.dataUrl}` : `name:${item.name}:${item.detail}`;
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      });
      return [...current, ...unique];
    });
  }, []);

  const signIn = useCallback(async () => {
    setAuthBusy(true); setAuthError(undefined); setDeviceCode(undefined);
    try {
      if (DESKTOP_MODE) {
        const result = await desktopClient.invoke<{ userCode: string }>("auth.begin");
        setDeviceCode(result.userCode); return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 650)); setAccount(DEMO_ACCOUNT); setAuthBusy(false);
    } catch (error) { setAuthBusy(false); setAuthError(friendlyError(error)); }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(undefined); setDeviceCode(undefined);
    try { if (DESKTOP_MODE) await desktopClient.invoke("auth.logout"); setAccount(SIGNED_OUT_ACCOUNT); setModels([]); setModelId(""); }
    catch (error) { setAuthError(friendlyError(error)); }
  }, []);

  const changeProfilePhoto = useCallback(async () => {
    try {
      if (DESKTOP_MODE) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const path = await open({ multiple: false, directory: false, title: "Choose profile picture", filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] });
        if (!path || Array.isArray(path)) return;
        const { invoke } = await import("@tauri-apps/api/core");
        const profilePhoto = await invoke<string>("read_profile_image", { path });
        setPendingProfilePhoto(profilePhoto); setPendingProfileCrop(undefined); return;
      }
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
      input.onchange = () => { const file = input.files?.[0]; if (!file || file.size > 2_000_000) return; const reader = new FileReader(); reader.onload = () => { setPendingProfilePhoto(String(reader.result)); setPendingProfileCrop(undefined); }; reader.readAsDataURL(file); };
      input.click();
    } catch (error) { showToast(friendlyError(error)); }
  }, [showToast]);

  const setProfilePhotoUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("Profile image URLs must use HTTPS.");
      setPendingProfilePhoto(parsed.toString());
      setPendingProfileCrop(undefined);
    } catch (error) { showToast(friendlyError(error)); }
  }, [showToast]);

  const editProfilePhoto = useCallback(() => {
    if (!displayAccount.photoUrl) return;
    setPendingProfilePhoto(displayAccount.photoUrl);
    setPendingProfileCrop(displayAccount.photoCrop);
  }, [displayAccount.photoCrop, displayAccount.photoUrl]);

  const saveProfileCrop = useCallback((profilePhotoCrop: AvatarCrop) => {
    if (!pendingProfilePhoto) return;
    setPreferences((current) => ({ ...current, profilePhoto: pendingProfilePhoto, profilePhotoCrop }));
    setPendingProfilePhoto(undefined);
  }, [pendingProfilePhoto]);

  const openExternal = useCallback(async (url: string) => {
    try { if (DESKTOP_MODE) await desktopClient.invoke("app.openExternal", { url }); else window.open(url, "_blank", "noopener,noreferrer"); }
    catch (error) { showToast(friendlyError(error)); }
  }, [showToast]);

  const shareConversation = useCallback(async (id = active?.id) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    const text = `${conversation.title}\n\n${conversation.messages.map((message) => `${message.role === "assistant" ? "Cline" : "You"}:\n${message.content}`).join("\n\n")}`;
    if (!navigator.share) { showToast("Windows sharing is unavailable on this device."); return; }
    try { await navigator.share({ title: conversation.title, text }); }
    catch (error) { if ((error as DOMException)?.name !== "AbortError") showToast("Windows could not open the share panel."); }
  }, [active?.id, conversations, showToast]);

  const shareMessage = useCallback(async (message: Message) => {
    if (!navigator.share) { showToast("Windows sharing is unavailable on this device."); return; }
    try { await navigator.share({ title: "Cline response", text: message.content }); }
    catch (error) { if ((error as DOMException)?.name !== "AbortError") showToast("Windows could not open the share panel."); }
  }, [showToast]);

  const saveRename = useCallback((title: string) => {
    if (!actionConversation) return;
    setConversations((items) => updateConversation(items, actionConversation.id, (conversation) => ({ ...conversation, title })));
    setRenameOpen(false);
    setActionConversationId(undefined);
    if (actionConversation.sessionId) void desktopClient.invoke("history.rename", { sessionId: actionConversation.sessionId, title }).catch((error) => showToast(friendlyError(error)));
  }, [actionConversation, showToast]);

  const deleteActive = useCallback(() => {
    if (!actionConversation) return;
    const id = actionConversation.id; const sessionId = actionConversation.sessionId;
    setConversations((items) => { const remaining = items.filter((item) => item.id !== id); const next = remaining.length ? remaining : [createConversation()]; setActiveId(next[0].id); return next; });
    setPreferences((current) => ({ ...current, pinnedConversationIds: current.pinnedConversationIds.filter((item) => item !== id) }));
    setDeleteOpen(false);
    setActionConversationId(undefined);
    if (sessionId) void desktopClient.invoke("history.delete", { sessionId }).catch((error) => showToast(friendlyError(error)));
  }, [actionConversation, showToast]);

  if (!active) return null;
  return <div className="app-frame">
    <WindowBar />
    <div className="app-workspace">
      <Sidebar conversations={conversations} activeId={active.id} search={search} account={displayAccount} pinnedConversationIds={preferences.pinnedConversationIds} onSearch={setSearch} onSelect={selectConversation} onNew={newConversation} onPin={togglePinnedConversation} onRename={(id) => { setActionConversationId(id); setRenameOpen(true); }} onDelete={(id) => { setActionConversationId(id); setDeleteOpen(true); }} onShare={(id) => void shareConversation(id)} onSettings={() => { setSettingsSection("appearance"); setSettingsOpen(true); }} onAccount={openAccountSettings} />
      <section className="chat-panel">
        <ChatHeader title={active.title} models={models} modelId={modelId} usage={active.usage} signedIn={account.signedIn} accountPlan={account.plan} favoriteModelIds={preferences.favoriteModelIds} onToggleFavorite={toggleFavoriteModel} onModelChange={changeModel} onSignIn={openAccountSettings} onShare={() => void shareConversation()} onRename={() => { setActionConversationId(active.id); setRenameOpen(true); }} onDelete={() => { setActionConversationId(active.id); setDeleteOpen(true); }} onManageModels={openAccountSettings} />
        {active.messages.length ? <ChatMessages messages={active.messages} account={displayAccount} showTimestamps={preferences.showTimestamps} onShare={shareMessage} /> : <div className="empty-chat"><span>{account.signedIn ? "Start a new conversation" : "Connect Cline to begin"}</span><p>{account.signedIn ? "Ask a question, attach context, or describe a task for Cline." : "Your account models and usage will appear after sign-in."}</p>{!account.signedIn ? <button className="primary-inline" onClick={openAccountSettings}>Sign in to Cline</button> : null}</div>}
        <Composer mode={mode} usage={active.usage} streaming={streaming} signedIn={account.signedIn} hasModel={Boolean(modelId)} sendWithEnter={preferences.sendWithEnter} attachments={attachments} onModeChange={setMode} onSend={sendMessage} onStop={stop} onSignIn={openAccountSettings} onAddAttachments={addAttachments} onRemoveAttachment={(id) => setAttachments((items) => items.filter((item) => item.id !== id))} />
      </section>
    </div>
    <SettingsDialog open={settingsOpen} section={settingsSection} theme={theme} account={displayAccount} preferences={preferences} updateState={updateState} authBusy={authBusy} authError={authError} deviceCode={deviceCode} onSectionChange={setSettingsSection} onThemeChange={setTheme} onPreferencesChange={setPreferences} onSignIn={signIn} onSignOut={signOut} onChangePhoto={changeProfilePhoto} onEditPhoto={editProfilePhoto} onSetPhotoUrl={setProfilePhotoUrl} onRemovePhoto={() => setPreferences((current) => ({ ...current, profilePhoto: undefined, profilePhotoCrop: undefined }))} onCheckUpdates={() => void checkUpdates()} onInstallUpdate={() => void installUpdate()} onOpenExternal={(url) => void openExternal(url)} onClose={() => setSettingsOpen(false)} />
    <AvatarCropDialog source={pendingProfilePhoto} initialCrop={pendingProfileCrop} onSave={saveProfileCrop} onClose={() => setPendingProfilePhoto(undefined)} />
    <RenameDialog open={renameOpen} initialValue={actionConversation?.title ?? active.title} onSave={saveRename} onClose={() => { setRenameOpen(false); setActionConversationId(undefined); }} />
    <DeleteDialog open={deleteOpen} title={actionConversation?.title ?? active.title} onConfirm={deleteActive} onClose={() => { setDeleteOpen(false); setActionConversationId(undefined); }} />
    <AppContextMenu onShare={() => void shareConversation()} />
    {toast ? <div className="toast" role="status">{toast}</div> : null}
  </div>;
}
