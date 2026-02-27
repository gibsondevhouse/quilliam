import { Suspense } from "react";
import { CanonicalDocDashboard } from "@/components/CanonicalDocDashboard";

export default function ScenesPage() {
  return (
    <Suspense>
      <CanonicalDocDashboard type="scene" title="Scenes" />
    </Suspense>
  );
}
