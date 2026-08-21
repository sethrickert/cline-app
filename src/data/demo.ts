import type { Account, Conversation, ModelOption } from "../types";

export const MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "Cline", contextWindow: 200_000, recommended: true },
  { id: "openai/gpt-5.5", label: "GPT-5.5", provider: "Cline", contextWindow: 400_000 },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "Cline", contextWindow: 1_000_000 },
  { id: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7", provider: "Cline", contextWindow: 200_000 },
];

const assistantResponse = `I’ll review the authentication implementation and propose a refactor that improves security, readability, and testability. Here’s my recommended approach.

## Overview

The current implementation works, but it mixes token validation, persistence, and user lookup. Moving those responsibilities behind narrow interfaces makes the flow easier to audit and test.

### Key improvements

- Separate token parsing, session rotation, and user lookup
- Keep refresh tokens in secure, HTTP-only storage
- Make expiry and clock behavior injectable for deterministic tests
- Return typed authentication failures instead of generic errors

\`\`\`ts
export class AuthService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async refresh(refreshToken: string) {
    const session = await this.sessions.requireValid(refreshToken)
    return this.tokens.rotate(session)
  }
}
\`\`\`

This keeps the public surface small and makes each security-sensitive operation independently testable.`;

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "auth-refactor",
    title: "Refactor authentication flow",
    updatedAt: new Date().toISOString(),
    usage: { contextPercent: 42, usedTokens: 84_000, maxTokens: 200_000, inputTokens: 8_214, outputTokens: 2_407, totalCost: 0.18 },
    messages: [
      {
        id: "m1",
        role: "user",
        createdAt: "10:42 AM",
        content: "Please review the current authentication implementation and propose a refactor to improve security, readability, and testability.",
        attachments: [
          { id: "a1", name: "auth.service.ts", kind: "file", detail: "3.2 KB" },
          { id: "a2", name: "/src/auth", kind: "folder", detail: "12 files" },
        ],
      },
      { id: "m2", role: "assistant", createdAt: "10:43 AM", content: assistantResponse, model: "Claude Sonnet 4.6" },
    ],
  },
  {
    id: "database",
    title: "Optimize database queries",
    updatedAt: new Date(Date.now() - 56 * 60_000).toISOString(),
    usage: { contextPercent: 18, usedTokens: 36_000, maxTokens: 200_000, inputTokens: 4_120, outputTokens: 1_860, totalCost: 0.09 },
    messages: [{ id: "db1", role: "assistant", createdAt: "9:15 AM", content: "I found three query paths that can be combined and indexed. Add the relevant schema or select a workspace to continue.", model: "Claude Sonnet 4.6" }],
  },
  {
    id: "rate-limit",
    title: "Design API rate limiting",
    updatedAt: new Date(Date.now() - 2.6 * 60 * 60_000).toISOString(),
    usage: { contextPercent: 11, usedTokens: 22_000, maxTokens: 200_000, inputTokens: 2_740, outputTokens: 1_220, totalCost: 0.06 },
    messages: [{ id: "rl1", role: "assistant", createdAt: "8:02 AM", content: "A token-bucket limiter with per-tenant partitions gives you predictable bursts without starving smaller customers.", model: "Claude Sonnet 4.6" }],
  },
  ...["Fix edge case in billing", "Implement caching layer", "Add unit tests for payments", "Improve error handling", "Update documentation", "Investigate memory leak", "Set up CI/CD pipeline"].map((title, index) => ({
    id: `history-${index}`,
    title,
    updatedAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
    usage: { contextPercent: 8 + index, usedTokens: 12_000, maxTokens: 200_000, inputTokens: 1_200, outputTokens: 640, totalCost: 0.04 },
    messages: [{ id: `h-${index}`, role: "assistant" as const, createdAt: `${index + 1}d ago`, content: "This conversation is ready to resume from your local Cline history.", model: "Claude Sonnet 4.6" }],
  })),
];

export const DEMO_ACCOUNT: Account = {
  signedIn: true,
  name: "Seth",
  email: "seth@cline.chat",
  avatar: "S",
  plan: "Cline account",
  credits: 18.42,
};

