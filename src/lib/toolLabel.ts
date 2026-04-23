export function summarizeTool(
  name: string,
  input: Record<string, unknown>,
): string {
  const s = (k: string) =>
    typeof input[k] === "string" ? (input[k] as string) : "";
  const first = (v: string) => v.split("\n")[0];
  const trim = (v: string, n = 80) =>
    v.length > n ? v.slice(0, n - 1) + "…" : v;

  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return trim(s("file_path") || "file");
    case "Glob":
      return trim(s("pattern") || "pattern");
    case "Grep": {
      const p = s("pattern");
      const path = s("path");
      return trim(path ? `${p}  in  ${path}` : p || "search");
    }
    case "Bash":
      return trim(first(s("command") || ""));
    case "WebFetch":
      return trim(s("url") || "");
    case "WebSearch":
      return trim(s("query") || "");
    case "TodoWrite":
      return "update todos";
    case "ExitPlanMode":
      return "done planning";
    default: {
      const guess = s("file_path") || s("path") || s("pattern") || s("query");
      return trim(guess || name.toLowerCase());
    }
  }
}
