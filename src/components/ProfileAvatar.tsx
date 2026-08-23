import type { AvatarCrop } from "../types";

export function ProfileAvatar({ photoUrl, fallback, crop, size = "normal" }: { photoUrl?: string; fallback: string; crop?: AvatarCrop; size?: "normal" | "large" }) {
  const initials = fallback.trim().slice(0, 2).toUpperCase() || "?";
  return (
    <span className={`avatar ${size === "large" ? "large" : ""} ${photoUrl ? "has-photo" : ""}`}>
      {photoUrl ? <img src={photoUrl} alt="Profile" style={{ objectPosition: `${50 + (crop?.x ?? 0)}% ${50 + (crop?.y ?? 0)}%`, transform: `scale(${crop?.zoom ?? 1})` }} /> : initials}
    </span>
  );
}
