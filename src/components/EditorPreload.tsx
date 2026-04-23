"use client";

import { useEffect } from "react";

export function EditorPreload() {
  useEffect(() => {
    void import("./Editor");
  }, []);
  return null;
}
