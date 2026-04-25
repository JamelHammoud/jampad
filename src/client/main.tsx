import "./globals.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { ClientConfig } from "./components/ConfigContext";

type BootConfig = ClientConfig & { themeCss: string };

async function fetchConfig(): Promise<BootConfig> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
  return (await res.json()) as BootConfig;
}

function applyTheme(css: string) {
  const el = document.getElementById("jampad-theme");
  if (el) el.textContent = `:root {\n${css}\n}`;
}

async function boot() {
  const cfg = await fetchConfig();
  applyTheme(cfg.themeCss);

  const { themeCss: _theme, ...clientCfg } = cfg;
  document.title = clientCfg.branding.name;

  const root = createRoot(document.getElementById("root")!);
  root.render(<App config={clientCfg} />);
}

boot().catch((err) => {
  document.getElementById("root")!.innerHTML = `
    <div style="padding:2rem;font-family:system-ui">
      <h1>Could not start jampad</h1>
      <pre>${String(err && err.message ? err.message : err)}</pre>
    </div>`;
});
