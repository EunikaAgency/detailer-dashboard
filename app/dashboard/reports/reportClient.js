"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function areReportFiltersEqual(left = {}, right = {}) {
  return (
    (left?.year || "") === (right?.year || "") &&
    (left?.month || "") === (right?.month || "") &&
    (left?.division || "") === (right?.division || "") &&
    (left?.team || "") === (right?.team || "") &&
    (left?.psr || "") === (right?.psr || "") &&
    (left?.brand || "") === (right?.brand || "")
  );
}

export function buildReportSearchParams(filters = {}, section = "") {
  const searchParams = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  if (section) searchParams.set("section", section);
  return searchParams;
}

export function useReportSection({ endpoint, filters, section, fallbackData, enabled = true }) {
  const [data, setData] = useState(fallbackData);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const fallbackDataRef = useRef(fallbackData);

  useEffect(() => {
    fallbackDataRef.current = fallbackData;
  }, [fallbackData]);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        endpoint,
        section,
        enabled,
        year: filters?.year || "",
        month: filters?.month || "",
        division: filters?.division || "",
        team: filters?.team || "",
        psr: filters?.psr || "",
        brand: filters?.brand || "",
      }),
    [endpoint, enabled, filters?.brand, filters?.division, filters?.month, filters?.psr, filters?.team, filters?.year, section]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError("");
      setData(fallbackDataRef.current);
      return;
    }

    const controller = new AbortController();

    const loadSection = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`${endpoint}?${buildReportSearchParams(filters, section).toString()}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load dashboard reports.");
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error(`Failed to load dashboard reports section "${section}":`, loadError);
        setData(fallbackDataRef.current);
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard reports.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadSection();
    return () => controller.abort();
  }, [endpoint, requestKey, section, enabled]);

  return {
    data,
    isLoading,
    error,
  };
}
