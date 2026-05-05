"use client";

import { useEffect, useState } from "react";

const PRIMARY_CSV_EXPORT_USERNAME = "info@eunika.agency";

const normalizeComparableText = (value) => String(value || "").trim().toLowerCase();

const canAccessCsvExport = (user) =>
  [user?.username, user?.email].some(
    (value) => normalizeComparableText(value) === PRIMARY_CSV_EXPORT_USERNAME
  );

export default function useCsvExportAccess() {
  const [canExportCsv, setCanExportCsv] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;

        setCanExportCsv(canAccessCsvExport(data?.user));
      } catch {
        if (!active) return;
        setCanExportCsv(false);
      }
    };

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  return canExportCsv;
}
