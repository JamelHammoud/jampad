import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ConfigProvider, type ClientConfig } from "./components/ConfigContext";
import { WorkspaceProvider } from "./components/WorkspaceContext";
import { CommandPalette } from "./components/CommandPalette";
import { EditorPreload } from "./components/EditorPreload";
import { Sidebar } from "./components/Sidebar";
import { MobileTopBar } from "./components/MobileTopBar";
import { HomeRoute } from "./routes/Home";
import { PageRoute } from "./routes/Page";
import { ChatLandingRoute } from "./routes/ChatLanding";
import { ChatRoute } from "./routes/Chat";
import { DrawLandingRoute } from "./routes/DrawLanding";
import { DrawRoute } from "./routes/Draw";

export function App({ config }: { config: ClientConfig }) {
  const showSidebar = config.features.sidebar;
  const showPalette = config.features.commandPalette;

  return (
    <ConfigProvider value={config}>
      <BrowserRouter>
        <WorkspaceProvider>
          <Shell showSidebar={showSidebar}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              {config.features.chat && (
                <>
                  <Route path="/chat" element={<ChatLandingRoute />} />
                  <Route path="/chat/:id" element={<ChatRoute />} />
                </>
              )}
              {config.features.draw && (
                <>
                  <Route path="/draw" element={<DrawLandingRoute />} />
                  <Route path="/draw/:id" element={<DrawRoute />} />
                </>
              )}
              <Route path="/*" element={<PageRoute />} />
            </Routes>
          </Shell>
          {showPalette && <CommandPalette />}
          <EditorPreload />
        </WorkspaceProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

function Shell({
  showSidebar,
  children,
}: {
  showSidebar: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="flex h-dvh w-screen overflow-hidden">
      {showSidebar && (
        <Sidebar
          drawerOpen={drawerOpen}
          onNavigate={() => setDrawerOpen(false)}
        />
      )}
      <main className="flex-1 flex flex-col overflow-hidden">
        {showSidebar && (
          <MobileTopBar onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
      {showSidebar && (
        <div
          className="mobile-drawer-backdrop"
          data-open={drawerOpen || undefined}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
