import { Hono } from "hono";
import { getConfig, themeToCssVars } from "@/server/lib/config";

export const configRoute = new Hono();

configRoute.get("/", (c) => {
  const cfg = getConfig();
  return c.json({
    branding: cfg.branding,
    features: cfg.features,
    strings: cfg.strings,
    editor: cfg.editor,
    uploads: {
      urlPrefix: cfg.uploads.urlPrefix,
      maxBytes: cfg.uploads.maxBytes,
    },
    themeCss: themeToCssVars(cfg.theme),
  });
});
