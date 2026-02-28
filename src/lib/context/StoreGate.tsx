"use client";

import { useWorkspaceContext } from "./WorkspaceContext";

interface StoreGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only after the IDB store is initialised.
 * Use this to wrap any subtree that calls useStore().
 */
export function StoreGate({ children, fallback = null }: StoreGateProps) {
  const { store } = useWorkspaceContext();
  if (!store) return <>{fallback}</>;
  return <>{children}</>;
}
