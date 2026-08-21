export function ProfileAvatar({ photoUrl, fallback, size = "normal", online = false }: { photoUrl?: string; fallback: string; size?: "normal" | "large"; online?: boolean }) {
  return (
    <span className={`avatar ${size === "large" ? "large" : ""} ${online ? "online" : ""}`}>
      {photoUrl ? <img src={photoUrl} alt="Profile" /> : fallback}
    </span>
  );
}
