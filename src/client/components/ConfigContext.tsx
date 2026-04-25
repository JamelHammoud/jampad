import { createContext, useContext, type ReactNode } from "react";
import type {
  BrandingConfig,
  FeaturesConfig,
  StringsConfig,
} from "@/server/lib/config";

export type ClientConfig = {
  branding: Required<BrandingConfig>;
  features: Required<FeaturesConfig>;
  strings: Required<StringsConfig>;
  editor: { debounceMs: number; placeholder: string };
  uploads: { urlPrefix: string; maxBytes: number };
};

const Ctx = createContext<ClientConfig | null>(null);

export function ConfigProvider({
  value,
  children,
}: {
  value: ClientConfig;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientConfig(): ClientConfig {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClientConfig outside ConfigProvider");
  return v;
}
