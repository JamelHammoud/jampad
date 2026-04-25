import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_NAMES,
  findConfigFile,
  loadConfigFile,
} from "@/server/lib/load-config";

const loader = { CONFIG_NAMES, findConfigFile, loadConfigFile };

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "jampad-load-config-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("findConfigFile", () => {
  it("returns null when no config file exists", () => {
    expect(loader.findConfigFile(workDir)).toBeNull();
  });

  it("finds jampad.config.json", () => {
    const path = join(workDir, "jampad.config.json");
    writeFileSync(path, "{}");
    expect(loader.findConfigFile(workDir)).toBe(path);
  });

  it("prefers .ts over .json when both exist", () => {
    writeFileSync(join(workDir, "jampad.config.json"), "{}");
    writeFileSync(join(workDir, "jampad.config.ts"), "export default {};");
    expect(loader.findConfigFile(workDir)).toBe(
      join(workDir, "jampad.config.ts"),
    );
  });

  it("lists JSON last in CONFIG_NAMES so TS variants take priority", () => {
    expect(loader.CONFIG_NAMES[loader.CONFIG_NAMES.length - 1]).toBe(
      "jampad.config.json",
    );
  });
});

describe("loadConfigFile (JSON path)", () => {
  it("parses JSON without invoking jiti", () => {
    const path = join(workDir, "jampad.config.json");
    writeFileSync(
      path,
      JSON.stringify({
        branding: { name: "Test Wiki", logo: "🧪" },
        features: { chat: true },
      }),
    );
    const result = loader.loadConfigFile(path, "/unused") as {
      branding: { name: string; logo: string };
      features: { chat: boolean };
    };
    expect(result.branding.name).toBe("Test Wiki");
    expect(result.branding.logo).toBe("🧪");
    expect(result.features.chat).toBe(true);
  });

  it("throws on malformed JSON", () => {
    const path = join(workDir, "jampad.config.json");
    writeFileSync(path, "{ not valid json");
    expect(() => loader.loadConfigFile(path, "/unused")).toThrow();
  });
});
