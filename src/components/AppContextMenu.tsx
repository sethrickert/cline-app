import { Copy, Share2, TextSelect } from "lucide-react";
import { useEffect, useState } from "react";

type MenuState = { x: number; y: number; target: HTMLElement };

export function AppContextMenu({ onShare }: { onShare: () => void }) {
  const [menu, setMenu] = useState<MenuState>();
  useEffect(() => {
    const open = (event: MouseEvent) => { event.preventDefault(); setMenu({ x: Math.min(event.clientX, window.innerWidth - 170), y: Math.min(event.clientY, window.innerHeight - 130), target: event.target as HTMLElement }); };
    const close = () => setMenu(undefined);
    window.addEventListener("contextmenu", open);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => { window.removeEventListener("contextmenu", open); window.removeEventListener("pointerdown", close); window.removeEventListener("blur", close); };
  }, []);
  if (!menu) return null;
  const selectedText = () => {
    const field = menu.target.closest("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
    if (field) return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
    return window.getSelection()?.toString() ?? "";
  };
  const selectAll = () => {
    const field = menu.target.closest("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
    if (field) { field.focus(); field.select(); return; }
    const range = document.createRange(); range.selectNodeContents(document.querySelector(".chat-panel") ?? document.body); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  };
  return <div className="app-context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
    <button disabled={!selectedText()} onClick={() => { void navigator.clipboard.writeText(selectedText()); setMenu(undefined); }}><Copy size={15} />Copy</button>
    <button onClick={() => { selectAll(); setMenu(undefined); }}><TextSelect size={15} />Select all</button>
    <button onClick={() => { onShare(); setMenu(undefined); }}><Share2 size={15} />Share</button>
  </div>;
}
