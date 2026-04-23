import type { Metadata } from "next";
import { ReactNode } from "react";
import fs from "node:fs";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceProvider } from "@/components/WorkspaceContext";
import { CommandPalette } from "@/components/CommandPalette";
import { EditorPreload } from "@/components/EditorPreload";
import { getConfig, themeToCssVars } from "@/lib/config";
import { ConfigProvider } from "@/components/ConfigContext";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return {
    title: cfg.branding.name,
    description: `${cfg.branding.name} wiki`,
  };
}

function readExtraCss(paths: string[]): string {
  let out = "";
  for (const p of paths) {
    try {
      out += "\n" + fs.readFileSync(p, "utf8");
    } catch {
      /* ignore missing files */
    }
  }
  return out;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const cfg = getConfig();
  const vars = themeToCssVars(cfg.theme);
  const extraCss = readExtraCss(cfg.css);
  const showSidebar = cfg.features.sidebar;
  const showPalette = cfg.features.commandPalette;

  const clientConfig = {
    branding: cfg.branding,
    features: cfg.features,
    strings: cfg.strings,
    editor: cfg.editor,
    uploads: {
      urlPrefix: cfg.uploads.urlPrefix,
      maxBytes: cfg.uploads.maxBytes,
    },
  };

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root {\n${vars}\n}\n${extraCss}`,
          }}
        />
      </head>
      <body>
        <ConfigProvider value={clientConfig}>
          <WorkspaceProvider>
            <div className="flex h-screen w-screen overflow-hidden">
              {showSidebar && <Sidebar />}
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
            {showPalette && <CommandPalette />}
            <EditorPreload />
          </WorkspaceProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
