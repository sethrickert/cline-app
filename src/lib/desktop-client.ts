import type { DesktopEvent } from "../types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type TransportResponse = { type: "response"; id: string; ok: boolean; result?: unknown; error?: string };
type TransportEvent = { type: "event"; event: DesktopEvent };

class DesktopClient {
  private socket?: WebSocket;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Set<(event: DesktopEvent) => void>();
  private connecting?: Promise<boolean>;

  get available() {
    return "__TAURI_INTERNALS__" in window || Boolean(import.meta.env.VITE_SIDECAR_WS_ENDPOINT);
  }

  async connect(): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) return true;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      try {
        let endpoint = import.meta.env.VITE_SIDECAR_WS_ENDPOINT as string | undefined;
        if (!endpoint && "__TAURI_INTERNALS__" in window) {
          const { invoke } = await import("@tauri-apps/api/core");
          endpoint = await invoke<string>("get_sidecar_endpoint");
        }
        if (!endpoint) return false;
        await new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(endpoint!);
          const timeout = window.setTimeout(() => reject(new Error("Cline service connection timed out")), 8_000);
          socket.onopen = () => {
            window.clearTimeout(timeout);
            this.socket = socket;
            this.bindSocket(socket);
            resolve();
          };
          socket.onerror = () => reject(new Error("Could not connect to the Cline service"));
        });
        return true;
      } catch {
        return false;
      } finally {
        this.connecting = undefined;
      }
    })();
    return this.connecting;
  }

  private bindSocket(socket: WebSocket) {
    socket.onmessage = (message) => {
      const envelope = JSON.parse(String(message.data)) as TransportResponse | TransportEvent;
      if (envelope.type === "event") {
        this.listeners.forEach((listener) => listener(envelope.event));
        return;
      }
      const request = this.pending.get(envelope.id);
      if (!request) return;
      this.pending.delete(envelope.id);
      envelope.ok ? request.resolve(envelope.result) : request.reject(new Error(envelope.error ?? "Cline service request failed"));
    };
    socket.onclose = () => {
      this.socket = undefined;
      this.pending.forEach(({ reject }) => reject(new Error("Cline service disconnected")));
      this.pending.clear();
    };
  }

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!(await this.connect()) || !this.socket) throw new Error("Cline desktop service is unavailable");
    const id = crypto.randomUUID();
    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    this.socket.send(JSON.stringify({ type: "command", id, command, args }));
    return response;
  }

  subscribe(listener: (event: DesktopEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const desktopClient = new DesktopClient();
