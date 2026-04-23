import path from "node:path";
import fs from "node:fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loader = require("./load-config.js") as {
  findConfigFile: (cwd: string) => string | null;
  loadConfigFile: (configPath: string, jampadRoot: string) => unknown;
};

export type ChatBackend = {
  send(
    payload: {
      messages: { role: string; content: string }[];
      sessionId?: string;
      cwd?: string;
    },
    signal?: AbortSignal,
  ): AsyncIterable<ChatEvent>;
};

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool"; name: string; input?: string; summary?: string }
  | { type: "session"; id: string }
  | { type: "done" }
  | { type: "error"; error: string };

export type ThemeConfig = {
  fg?: string;
  bg?: string;
  bgSidebar?: string;
  bgHover?: string;
  bgHoverStrong?: string;
  bgActive?: string;
  accent?: string;
  divider?: string;
  fontSans?: string;
  fontMono?: string;
  maxWidth?: string;
  titleSize?: string;
  iconSize?: string;
  radius?: string;
};

export type FeaturesConfig = {
  sidebar?: boolean;
  commandPalette?: boolean;
  icon?: boolean;
  cover?: boolean;
  chat?: boolean;
  search?: boolean;
  newPage?: boolean;
};

export type StringsConfig = {
  appName?: string;
  untitled?: string;
  untitledChat?: string;
  addIcon?: string;
  addCover?: string;
  removeIcon?: string;
  removeCover?: string;
  newPage?: string;
  newChat?: string;
  searchPlaceholder?: string;
  chatPlaceholder?: string;
  chatEmpty?: string;
  homeTagline?: string;
  emptyPages?: string;
};

export type BrandingConfig = {
  name?: string;
  logo?: string;
  logoImage?: string;
  showLogo?: boolean;
};

export type JampadConfig = {
  content?: {
    dir?: string;
    defaultIcon?: string;
    hiddenFiles?: string[];
  };
  uploads?: {
    dir?: string;
    urlPrefix?: string;
    maxBytes?: number;
    allowedTypes?: string[];
  };
  chats?: {
    enabled?: boolean;
    dir?: string;
    backend?: ChatBackend;
    claude?: {
      binary?: string;
      cwd?: string;
      model?: string;
      effort?: "low" | "medium" | "high";
      addDirs?: string[];
      systemPrompt?: string;
    };
  };
  theme?: ThemeConfig;
  css?: string[];
  branding?: BrandingConfig;
  features?: FeaturesConfig;
  strings?: StringsConfig;
  editor?: {
    debounceMs?: number;
    placeholder?: string;
  };
  server?: {
    port?: number;
    host?: string;
  };
  mcp?: {
    http?: {
      enabled?: boolean;
      port?: number;
      host?: string;
      token?: string;
    };
  };
  env?: Record<string, string>;
};

export type ResolvedJampadConfig = {
  cwd: string;
  configPath: string | null;
  content: Required<NonNullable<JampadConfig["content"]>>;
  uploads: Required<
    Omit<NonNullable<JampadConfig["uploads"]>, "dir" | "urlPrefix">
  > & {
    dir: string;
    urlPrefix: string;
  };
  chats: {
    enabled: boolean;
    dir: string;
    backend: ChatBackend | null;
    claude: {
      binary: string;
      cwd: string;
      model: string;
      effort: "low" | "medium" | "high";
      addDirs: string[] | null;
      systemPrompt: string;
    };
  };
  theme: Required<ThemeConfig>;
  css: string[];
  branding: Required<BrandingConfig>;
  features: Required<FeaturesConfig>;
  strings: Required<StringsConfig>;
  editor: Required<NonNullable<JampadConfig["editor"]>>;
  server: Required<NonNullable<JampadConfig["server"]>>;
  mcp: {
    http: {
      enabled: boolean;
      port: number;
      host: string;
      token: string;
    };
  };
};

export function defineJampadConfig(c: JampadConfig): JampadConfig {
  return c;
}

const DEFAULT_THEME: Required<ThemeConfig> = {
  fg: "rgb(55, 53, 47)",
  bg: "#ffffff",
  bgSidebar: "rgb(247, 246, 243)",
  bgHover: "rgba(55, 53, 47, 0.06)",
  bgHoverStrong: "rgba(55, 53, 47, 0.08)",
  bgActive: "rgba(55, 53, 47, 0.16)",
  accent: "rgb(35, 131, 226)",
  divider: "rgba(55, 53, 47, 0.15)",
  fontSans:
    'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
  fontMono:
    '"SFMono-Regular", Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace',
  maxWidth: "720px",
  titleSize: "40px",
  iconSize: "72px",
  radius: "6px",
};

const DEFAULT_FEATURES: Required<FeaturesConfig> = {
  sidebar: true,
  commandPalette: true,
  icon: true,
  cover: true,
  chat: false,
  search: true,
  newPage: true,
};

const DEFAULT_STRINGS: Required<StringsConfig> = {
  appName: "Jampad",
  untitled: "Untitled",
  untitledChat: "New chat",
  addIcon: "Add icon",
  addCover: "Add cover",
  removeIcon: "Remove icon",
  removeCover: "Remove cover",
  newPage: "New page",
  newChat: "New chat",
  searchPlaceholder: "Search pages…",
  chatPlaceholder: "Jam on anything…",
  chatEmpty: "How can I help?",
  homeTagline: "Your local-first wiki. Pages live as .md files on disk.",
  emptyPages: "No pages yet",
};

const DEFAULT_BRANDING: Required<BrandingConfig> = {
  name: "Jampad",
  logo: "📝",
  logoImage: "",
  showLogo: true,
};

function abs(cwd: string, p: string | undefined, fallback: string): string {
  const value = p ?? fallback;
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function detectRepoName(cwd: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "package.json"), "utf8"),
    );
    if (typeof pkg?.name === "string" && pkg.name.trim()) {
      return pkg.name.trim().replace(/^@[^/]+\//, "");
    }
  } catch {
    /* ignore */
  }
  return path.basename(cwd) || DEFAULT_BRANDING.name;
}

function resolveConfig(
  raw: JampadConfig,
  cwd: string,
  configPath: string | null,
): ResolvedJampadConfig {
  const contentDir = abs(cwd, raw.content?.dir, "./jam");
  const uploadsDir = abs(
    cwd,
    raw.uploads?.dir,
    path.join(contentDir, "attachments"),
  );
  const chatsDir = abs(cwd, raw.chats?.dir, "./chats");

  let urlPrefix = raw.uploads?.urlPrefix ?? "/attachments/";
  if (!urlPrefix.startsWith("/")) urlPrefix = "/" + urlPrefix;
  if (!urlPrefix.endsWith("/")) urlPrefix = urlPrefix + "/";

  const branding: Required<BrandingConfig> = {
    ...DEFAULT_BRANDING,
    ...(raw.branding ?? {}),
  };
  if (!raw.branding?.name) branding.name = detectRepoName(cwd);

  return {
    cwd,
    configPath,
    content: {
      dir: contentDir,
      defaultIcon: raw.content?.defaultIcon ?? "📄",
      hiddenFiles: raw.content?.hiddenFiles ?? [],
    },
    uploads: {
      dir: uploadsDir,
      urlPrefix,
      maxBytes: raw.uploads?.maxBytes ?? 25 * 1024 * 1024,
      allowedTypes: raw.uploads?.allowedTypes ?? ["image/*"],
    },
    chats: {
      enabled: raw.chats?.enabled ?? false,
      dir: chatsDir,
      backend: raw.chats?.backend ?? null,
      claude: {
        binary: raw.chats?.claude?.binary ?? "claude",
        cwd: raw.chats?.claude?.cwd
          ? abs(cwd, raw.chats.claude.cwd, raw.chats.claude.cwd)
          : cwd,
        model: raw.chats?.claude?.model ?? "opus",
        effort: raw.chats?.claude?.effort ?? "high",
        addDirs: raw.chats?.claude?.addDirs
          ? raw.chats.claude.addDirs.map((d) => abs(cwd, d, d))
          : null,
        systemPrompt: raw.chats?.claude?.systemPrompt ?? "",
      },
    },
    theme: { ...DEFAULT_THEME, ...(raw.theme ?? {}) },
    css: (raw.css ?? []).map((p) => abs(cwd, p, p)),
    branding,
    features: { ...DEFAULT_FEATURES, ...(raw.features ?? {}) },
    strings: { ...DEFAULT_STRINGS, ...(raw.strings ?? {}) },
    editor: {
      debounceMs: raw.editor?.debounceMs ?? 500,
      placeholder: raw.editor?.placeholder ?? "",
    },
    server: {
      port: raw.server?.port ?? 3000,
      host: raw.server?.host ?? "127.0.0.1",
    },
    mcp: {
      http: {
        enabled: raw.mcp?.http?.enabled ?? false,
        port: raw.mcp?.http?.port ?? 4100,
        host: raw.mcp?.http?.host ?? "127.0.0.1",
        token: raw.mcp?.http?.token ?? "",
      },
    },
  };
}

let cached: ResolvedJampadConfig | null = null;

export function getConfig(): ResolvedJampadConfig {
  if (cached) return cached;
  const cwd = process.env.JAMPAD_CWD || process.cwd();
  const configPath = loader.findConfigFile(cwd);
  let raw: JampadConfig = {};
  if (configPath) {
    const jampadRoot =
      process.env.JAMPAD_ROOT ?? path.resolve(__dirname, "..", "..");
    raw = (loader.loadConfigFile(configPath, jampadRoot) as JampadConfig) ?? {};
  }
  if (raw.env) {
    for (const [k, v] of Object.entries(raw.env)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
  cached = resolveConfig(raw, cwd, configPath);
  return cached;
}

export function themeToCssVars(theme: Required<ThemeConfig>): string {
  const map: Record<string, string> = {
    "--fg": theme.fg,
    "--bg": theme.bg,
    "--bg-sidebar": theme.bgSidebar,
    "--bg-hover": theme.bgHover,
    "--bg-hover-strong": theme.bgHoverStrong,
    "--bg-active": theme.bgActive,
    "--accent": theme.accent,
    "--divider": theme.divider,
    "--font-sans": theme.fontSans,
    "--font-mono": theme.fontMono,
    "--jampad-max-width": theme.maxWidth,
    "--jampad-title-size": theme.titleSize,
    "--jampad-icon-size": theme.iconSize,
    "--jampad-radius": theme.radius,
  };
  return Object.entries(map)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}
