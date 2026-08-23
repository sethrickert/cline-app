import { APP_VERSION } from "./version";

export type AppUpdate = {
  available: boolean;
  currentVersion: string;
  version?: string;
  notes?: string;
  statusMessage?: string;
};

let pendingUpdate: Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater")["check"]>> | null = null;

export async function getAppVersion() {
  if (!("__TAURI_INTERNALS__" in window)) return APP_VERSION;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function checkForAppUpdate(): Promise<AppUpdate> {
  const currentVersion = await getAppVersion();
  if (!("__TAURI_INTERNALS__" in window)) return { available: false, currentVersion };
  const { check } = await import("@tauri-apps/plugin-updater");
  try {
    pendingUpdate = await check({ timeout: 15_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("valid release json")) throw error;
    const response = await fetch("https://api.github.com/repos/sethrickert/cline-app/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (response.status === 404) return { available: false, currentVersion, statusMessage: "No published Cline Chat release is available yet." };
    if (!response.ok) throw error;
    return { available: false, currentVersion, statusMessage: "The latest GitHub release is missing its signed Windows update manifest." };
  }
  return pendingUpdate
    ? { available: true, currentVersion, version: pendingUpdate.version, notes: pendingUpdate.body ?? undefined }
    : { available: false, currentVersion };
}

export async function installAppUpdate(onProgress: (percent: number) => void) {
  if (!pendingUpdate) throw new Error("Check for updates before installing.");
  let downloaded = 0;
  let total = 0;
  await pendingUpdate.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    if (event.event === "Progress") downloaded += event.data.chunkLength;
    if (event.event === "Finished") onProgress(100);
    else if (total > 0) onProgress(Math.min(99, Math.round((downloaded / total) * 100)));
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
