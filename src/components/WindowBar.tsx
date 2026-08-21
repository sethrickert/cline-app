import { Minus, Square, X } from "lucide-react";
import { BrandMark } from "./BrandMark";

async function withWindow(action: "minimize" | "toggleMaximize" | "close") {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()[action]();
}

export function WindowBar() {
  return (
    <div className="window-bar" data-tauri-drag-region>
      <div className="window-brand" data-tauri-drag-region>
        <BrandMark size={17} />
        <span data-tauri-drag-region>Cline Chat</span>
      </div>
      <div className="window-controls">
        <button aria-label="Minimize" onClick={() => void withWindow("minimize")}><Minus size={15} /></button>
        <button aria-label="Maximize" onClick={() => void withWindow("toggleMaximize")}><Square size={12} /></button>
        <button className="window-close" aria-label="Close" onClick={() => void withWindow("close")}><X size={15} /></button>
      </div>
    </div>
  );
}

