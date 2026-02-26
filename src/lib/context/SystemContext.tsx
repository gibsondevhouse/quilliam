"use client";

import { createContext, useContext } from "react";
import type { StartupStatus } from "@/components/SystemStatus";

interface SystemContextValue {
  status: StartupStatus;
}

export const SystemContext = createContext<SystemContextValue | null>(null);

export function useSystemContext(): SystemContextValue {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error("useSystemContext must be used within a ClientShell");
  return ctx;
}
