export type PageNode = {
  kind: "page";
  slug: string[];
  name: string;
  title: string;
  icon?: string;
};

export type FolderNode = {
  kind: "folder";
  slug: string[];
  name: string;
  title: string;
  children: TreeNode[];
};

export type TreeNode = PageNode | FolderNode;

export type PageData = {
  slug: string[];
  title: string;
  icon?: string;
  cover?: string;
  markdown: string;
  updatedAt: string;
};

export type SectionGroup = {
  key: string;
  label: string;
  slug: string[];
  tree: TreeNode[];
};

export type ChatMode = "plan" | "apply";

export type ChatMessage = {
  role: "user" | "assistant" | "tool" | "thinking";
  content: string;
  mode?: ChatMode;
  hasPlan?: boolean;
  toolName?: string;
  toolInput?: string;
  thinkingMs?: number;
  createdAt: string;
};

export type ChatMeta = {
  id: string;
  title: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatData = ChatMeta & {
  messages: ChatMessage[];
};

export type ClaudeStreamEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "thinking_done"; durationMs: number }
  | {
      kind: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { kind: "tool_result"; id: string; content: string; ok: boolean }
  | { kind: "done"; result?: string }
  | { kind: "error"; message: string };

export const PLAN_TOOLS: ReadonlySet<string> = new Set([
  "exitplanmode",
  "edit",
  "write",
  "multiedit",
  "notebookedit",
]);
