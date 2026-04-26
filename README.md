# Jampad

I built Jampad after I noticed that I kept pasting the same context (from Google Docs, Apple Notes, etc.) into Claude over and over. Having my docs live outside my repo wasn't working, so I made a local markdown editor that doubles as a knowledge base for whatever agent I'm running. Now my agents.md (or claude.md, or whatever.md) just says "before you start, check the wiki for context".

## Quick start

```bash
cd your-project
npx @jamelhammoud/jampad@latest
```

Everything in `./jam` becomes a page. Folders are sections in the sidebar. The filename (without `.md`) is the URL slug.

## How it works

Jampad ships as a single npm package containing a prebuilt React SPA (built with Vite) and a tiny Hono server. The CLI launches the server in your current directory. Markdown pages and uploaded images live on disk as `.md` files alongside attachments. Optional AI chat shells out to [Claude Code](https://github.com/anthropics/claude-code) and streams responses back.

## Customizing

To customize Jampad, simply drop a config file at the root of your project. Jampad looks for (in order): `jampad.config.mjs`, `.js`, `.json`. It's all optional.

```json
{
  "branding": { "name": "My Wiki", "logo": "📓" },
  "theme": { "accent": "#1f8a4c", "maxWidth": "720px" },
  "features": { "chat": true },
  "chats": { "enabled": true }
}
```

For a richer config (a custom system prompt, a live `ChatBackend`, computed values), use `.mjs` with a JSDoc type reference for editor autocomplete:

```js
/** @type {import("@jamelhammoud/jampad/config").JampadConfig} */
export default {
  branding: { name: "My Wiki", logo: "📓" },
  features: { chat: true },
  chats: {
    enabled: true,
    claude: {
      systemPrompt: "You are the assistant for this wiki.",
      addDirs: ["./jam"],
    },
  },
};
```

See [`jampad.config.example.json`](jampad.config.example.json) for a full reference, and [`src/server/lib/config.ts`](src/server/lib/config.ts) for the complete `JampadConfig` type.

## Commands

```bash
jampad
jampad mcp          # MCP server on stdio
jampad -p 8080      # Custom port
jampad -H 0.0.0.0   # Custom host
```

## Pages

```markdown
---
title: Getting Started
icon: 👋
cover: /attachments/cover.jpg
---

Write whatever you want.
```

## Styling

Every UI color and size is a CSS variable. Override them through `theme` in config, or drop a file in `css: [...]` and use raw CSS:

```css
.jampad-title {
  font-family: "Playfair Display", serif;
}
.sidebar-row[data-active="true"] {
  background: var(--accent-soft);
}
```

Variables you can override: `--fg`, `--bg`, `--bg-sidebar`, `--bg-hover`, `--bg-hover-strong`, `--bg-active`, `--accent`, `--divider`, `--font-sans`, `--font-mono`, `--jampad-max-width`, `--jampad-title-size`, `--jampad-icon-size`, `--jampad-radius`.

## Chat

Off by default. Enable with `features.chat: true` and `chats.enabled: true`. Install the [`claude`](https://github.com/anthropics/claude-code) CLI, log in, and you're set.

You can pass a custom system prompt via `chats.claude.systemPrompt`.

To plug in a different LLM backend, provide a `chats.backend` that matches the `ChatBackend` interface in [`src/server/lib/config.ts`](src/server/lib/config.ts).

## MCP (use Jampad from any AI tool)

Jampad can run as an [MCP](https://modelcontextprotocol.io) server, becoming a tool surface any MCP client (Claude Code, Cursor, Zed, custom agents) can call. Tools exposed: `search_pages`, `list_pages`, `read_page`, `create_page`, `update_page`, `rename_page`, `delete_page`.

### Local

Add one entry to `~/.claude.json` (or any MCP client's config):

```json
{
  "mcpServers": {
    "my-wiki": {
      "command": "jampad",
      "args": ["mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

The client spawns `jampad mcp` as a subprocess when it needs your wiki.

### Remote

If you want another machine (or a teammate) to reach your wiki, run the HTTP transport:

```bash
export JAMPAD_MCP_TOKEN=$(openssl rand -hex 32)
jampad mcp --http --port 4100 --token "$JAMPAD_MCP_TOKEN"
```

Every request must carry `Authorization: Bearer <token>`. You can tunnel it through `ngrok` or `cloudflared`, or, if the remote machine has git access to the wiki, `git clone` it and run `jampad mcp` locally there instead.

## Notes from your phone

Jampad doesn't have a mobile app, and it doesn't need one. Point `content.dir` at a synced folder (iCloud Drive, Dropbox, Syncthing) and write markdown with any mobile editor ([Obsidian](https://obsidian.md), [1Writer](https://1writerapp.com), [iA Writer](https://ia.net/writer), [Drafts](https://getdrafts.com).

## License

MIT. See [LICENSE](LICENSE).

The in-browser block editor is [BlockNote](https://www.blocknotejs.org/), used unmodified via npm under its [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/) license.
