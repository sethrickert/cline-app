import { X } from "lucide-react";
import { useEffect, useState } from "react";

export function RenameDialog({ open, initialValue, onSave, onClose }: { open: boolean; initialValue: string; onSave: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);
  if (!open) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="small-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title"><button className="dialog-close" aria-label="Close" onClick={onClose}><X size={18} /></button><h2 id="rename-title">Rename conversation</h2><p>Choose a short title that will be easy to find later.</p><input autoFocus maxLength={120} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && value.trim()) onSave(value.trim()); }} /><div className="dialog-actions"><button className="secondary-inline" onClick={onClose}>Cancel</button><button className="primary-inline" disabled={!value.trim()} onClick={() => onSave(value.trim())}>Save</button></div></section></div>;
}

export function DeleteDialog({ open, title, onConfirm, onClose }: { open: boolean; title: string; onConfirm: () => void; onClose: () => void }) {
  if (!open) return null;
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="small-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><button className="dialog-close" aria-label="Close" onClick={onClose}><X size={18} /></button><h2 id="delete-title">Delete conversation?</h2><p>“{title}” will be permanently removed from local Cline history.</p><div className="dialog-actions"><button className="secondary-inline" onClick={onClose}>Cancel</button><button className="danger-inline" onClick={onConfirm}>Delete</button></div></section></div>;
}
