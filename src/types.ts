export type AccentId = "pacific" | "coral" | "violet" | "azure" | "mint" | "amber" | "custom";
export type AgentMode = "plan" | "act";
export type SettingsSection = "appearance" | "general" | "account" | "updates" | "about";

export type Attachment = {
  id: string;
  name: string;
  kind: "file" | "folder" | "image";
  detail: string;
  path?: string;
  dataUrl?: string;
  mimeType?: string;
};

export type Usage = {
  contextPercent: number;
  usedTokens: number;
  maxTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  attachments?: Attachment[];
  model?: string;
  streaming?: boolean;
  phase?: "thinking" | "responding";
  completedInMs?: number;
  error?: boolean;
};

export type Conversation = {
  id: string;
  sessionId?: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  usage: Usage;
};

export type Account = {
  signedIn: boolean;
  name: string;
  email: string;
  avatar: string;
  plan?: string;
  credits?: number;
  photoUrl?: string;
  photoCrop?: AvatarCrop;
  createdAt?: string;
  organizations?: number;
};

export type ModelOption = {
  id: string;
  label: string;
  provider: string;
  contextWindow: number;
  recommended?: boolean;
  free?: boolean;
  tier?: "recommended" | "free" | "subscribed";
  supportsVision?: boolean;
};

export type AvatarCrop = {
  x: number;
  y: number;
  zoom: number;
};

export type AppPreferences = {
  sendWithEnter: boolean;
  showTimestamps: boolean;
  autoCheckUpdates: boolean;
  profilePhoto?: string;
  profilePhotoCrop?: AvatarCrop;
  favoriteModelIds: string[];
  pinnedConversationIds: string[];
};

export type UpdateState = {
  currentVersion: string;
  checking: boolean;
  installing: boolean;
  available: boolean;
  version?: string;
  notes?: string;
  progress?: number;
  error?: string;
  lastChecked?: string;
  statusMessage?: string;
};

export type DesktopEvent = {
  name: string;
  payload: Record<string, unknown>;
};
