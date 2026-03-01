"use client";

import { useCallback, useState } from "react";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useStore } from "@/lib/context/useStore";
import { exportLibraryToJSON, downloadLibraryJSON } from "@/lib/library/libraryExport";

export function ExportButton() {
  const lib = useLibraryContext();
  const store = useStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportLibraryToJSON(lib.libraryId, store);
      downloadLibraryJSON(data);
    } catch (err) {
      console.error("Library export failed", err);
      alert("Export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  }, [exporting, lib.libraryId, store]);

  return (
    <button
      className="library-dashboard-search-btn"
      onClick={() => void handleExport()}
      disabled={exporting}
      title="Download this library as a JSON backup file"
    >
      {exporting ? "Exporting…" : "Export JSON"}
    </button>
  );
}
