import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigProvider, type ClientConfig } from "./components/ConfigContext";
import { WorkspaceProvider } from "./components/WorkspaceContext";
import { CommandPalette } from "./components/CommandPalette";
import { EditorPreload } from "./components/EditorPreload";
import { Sidebar } from "./components/Sidebar";
import { HomeRoute } from "./routes/Home";
import { PageRoute } from "./routes/Page";
import { ChatLandingRoute } from "./routes/ChatLanding";
import { ChatRoute } from "./routes/Chat";

export function App({ config }: { config: ClientConfig }) {
  const showSidebar = config.features.sidebar;
  const showPalette = config.features.commandPalette;

  return (
    <ConfigProvider value={config}>
      <BrowserRouter>
        <WorkspaceProvider>
          <div className="flex h-screen w-screen overflow-hidden">
            {showSidebar && <Sidebar />}
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<HomeRoute />} />
                {config.features.chat && (
                  <>
                    <Route path="/chat" element={<ChatLandingRoute />} />
                    <Route path="/chat/:id" element={<ChatRoute />} />
                  </>
                )}
                <Route path="/*" element={<PageRoute />} />
              </Routes>
            </main>
          </div>
          {showPalette && <CommandPalette />}
          <EditorPreload />
        </WorkspaceProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
