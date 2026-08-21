import { FilePlus2, FolderPlus, Paperclip, Send, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentMode, Attachment, Usage } from "../types";

export function Composer({
  mode,
  usage,
  streaming,
  signedIn,
  hasModel,
  sendWithEnter,
  attachments,
  onModeChange,
  onSend,
  onStop,
  onSignIn,
  onAddAttachments,
  onRemoveAttachment,
}: {
  mode: AgentMode;
  usage: Usage;
  streaming: boolean;
  signedIn: boolean;
  hasModel: boolean;
  sendWithEnter: boolean;
  attachments: Attachment[];
  onModeChange: (mode: AgentMode) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onSignIn: () => void;
  onAddAttachments: (items: Attachment[]) => void;
  onRemoveAttachment: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(150, Math.max(48, element.scrollHeight))}px`;
  }, [text]);

  const submit = () => {
    if (!text.trim() || streaming || !signedIn || !hasModel) return;
    onSend(text.trim());
    setText("");
  };

  const acceptFiles = useCallback((files: FileList | null, kind: Attachment["kind"]) => {
    if (!files?.length) return;
    onAddAttachments(Array.from(files).map((file) => ({ id: crypto.randomUUID(), name: file.name, kind: file.type.startsWith("image/") ? "image" : kind, detail: kind === "folder" ? "Folder" : `${Math.max(1, Math.round(file.size / 1024))} KB`, path: (file as File & { path?: string }).path, mimeType: file.type || undefined })));
    setContextOpen(false);
  }, [onAddAttachments]);

  const addPaths = useCallback((paths: string[], kind: Attachment["kind"]) => {
    if (!paths.length) return;
    onAddAttachments(paths.map((path) => ({
      id: crypto.randomUUID(),
      name: path.split(/[\\/]/).at(-1) || path,
      kind: /\.(png|jpe?g|gif|webp|bmp)$/i.test(path) ? "image" : kind,
      detail: kind === "folder" ? "Folder" : "File",
      path,
    })));
    setContextOpen(false);
  }, [onAddAttachments]);

  const pasteImages = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    for (const file of images) {
      const reader = new FileReader();
      reader.onload = () => onAddAttachments([{ id: crypto.randomUUID(), name: file.name || `Pasted image.${file.type.split("/")[1] || "png"}`, kind: "image", detail: `${Math.max(1, Math.round(file.size / 1024))} KB`, dataUrl: String(reader.result), mimeType: file.type }]);
      reader.readAsDataURL(file);
    }
  }, [onAddAttachments]);

  const openContextPicker = async (kind: "file" | "folder") => {
    if ("__TAURI_INTERNALS__" in window) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selection = await open({ multiple: true, directory: kind === "folder", title: kind === "folder" ? "Add context folder" : "Add context files" });
        const paths = Array.isArray(selection) ? selection : selection ? [selection] : [];
        addPaths(paths, kind);
        return;
      } catch {
        // Fall through to the browser picker if the native dialog is unavailable.
      }
    }
    (kind === "folder" ? folderRef : fileRef).current?.click();
  };

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let removeListener: (() => void) | undefined;
    void import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) =>
      getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (event.payload.type === "drop") addPaths(event.payload.paths, "file");
      }),
    ).then((unlisten) => { removeListener = unlisten; });
    return () => { removeListener?.(); };
  }, [addPaths]);

  return (
    <footer className="composer-region">
      {!signedIn ? <div className="connection-banner"><span>Connect your Cline account to load models and start chatting.</span><button onClick={onSignIn}>Sign in</button></div> : null}
      <div className="composer-shell">
        {attachments.length ? <div className="composer-attachments">{attachments.map((item) => <span key={item.id}>{item.name}<button aria-label={`Remove ${item.name}`} onClick={() => onRemoveAttachment(item.id)}><X size={12} /></button></span>)}</div> : null}
        <div className="composer-row">
          <textarea ref={textareaRef} value={text} disabled={!signedIn || !hasModel} onPaste={pasteImages} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (sendWithEnter && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={!signedIn ? "Sign in to Cline to start chatting" : !hasModel ? "No chat models are available for this account" : "Ask anything, or describe a task…"} aria-label="Message Cline" />
          <div className="composer-actions">
            <div className="context-control">
              <button className="add-context-button icon-only" aria-label="Add context" title="Add context" disabled={!signedIn} onClick={() => setContextOpen((value) => !value)}><Paperclip size={17} /></button>
              {contextOpen ? <div className="context-menu">
                <button onClick={() => void openContextPicker("file")}><FilePlus2 size={17} /><span><strong>Add files</strong><small>Include images, documents, or source files</small></span></button>
                <button onClick={() => void openContextPicker("folder")}><FolderPlus size={17} /><span><strong>Add folder</strong><small>Include a workspace or directory</small></span></button>
              </div> : null}
            </div>
            <div className="mode-switch" role="group" aria-label="Agent mode">
              <button className={mode === "plan" ? "active" : ""} onClick={() => onModeChange("plan")}>Plan</button>
              <button className={mode === "act" ? "active" : ""} onClick={() => onModeChange("act")}>Act</button>
            </div>
            {streaming ? <button className="send-button stop" aria-label="Stop response" onClick={onStop}><Square size={15} fill="currentColor" /></button> : <button className="send-button" aria-label="Send message" disabled={!text.trim() || !signedIn || !hasModel} onClick={submit}><Send size={17} /></button>}
          </div>
        </div>
      </div>
      <div className="composer-footer">
        <div className="context-meter"><span>Context window</span><strong>{usage.contextPercent}%</strong><i><b style={{ width: `${usage.contextPercent}%` }} /></i><span>{Math.round(usage.usedTokens / 1000)}K / {Math.round(usage.maxTokens / 1000)}K tokens</span></div>
      </div>
      <input ref={fileRef} type="file" multiple hidden onChange={(event) => { acceptFiles(event.target.files, "file"); event.currentTarget.value = ""; }} />
      <input ref={folderRef} type="file" multiple hidden {...({ webkitdirectory: "" } as object)} onChange={(event) => { acceptFiles(event.target.files, "folder"); event.currentTarget.value = ""; }} />
    </footer>
  );
}
