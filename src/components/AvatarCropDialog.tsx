import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AvatarCrop } from "../types";
import { ProfileAvatar } from "./ProfileAvatar";

const DEFAULT_CROP: AvatarCrop = { x: 0, y: 0, zoom: 1 };

export function AvatarCropDialog({ source, initialCrop, onSave, onClose }: { source?: string; initialCrop?: AvatarCrop; onSave: (crop: AvatarCrop) => void; onClose: () => void }) {
  const [crop, setCrop] = useState<AvatarCrop>(initialCrop ?? DEFAULT_CROP);
  useEffect(() => setCrop(initialCrop ?? DEFAULT_CROP), [initialCrop, source]);
  if (!source) return null;
  const slider = (key: keyof AvatarCrop, min: number, max: number, step: number) => (
    <input type="range" min={min} max={max} step={step} value={crop[key]} onChange={(event) => setCrop((current) => ({ ...current, [key]: Number(event.target.value) }))} />
  );
  return <div className="dialog-backdrop" role="presentation">
    <section className="small-dialog avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <button className="dialog-close" aria-label="Close image crop" onClick={onClose}><X size={18} /></button>
      <h2 id="crop-title">Crop profile picture</h2>
      <p>Position and zoom the image inside the circular profile frame. Transparent pixels remain transparent.</p>
      <div className="crop-preview"><ProfileAvatar photoUrl={source} fallback="" crop={crop} size="large" /></div>
      <label><span>Horizontal</span>{slider("x", -40, 40, 1)}</label>
      <label><span>Vertical</span>{slider("y", -40, 40, 1)}</label>
      <label><span>Zoom</span>{slider("zoom", 1, 2.5, .05)}</label>
      <div className="dialog-actions"><button className="secondary-inline" onClick={onClose}>Cancel</button><button className="primary-inline" onClick={() => onSave(crop)}>Use picture</button></div>
    </section>
  </div>;
}
