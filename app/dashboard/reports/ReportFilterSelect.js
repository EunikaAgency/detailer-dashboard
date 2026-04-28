"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

export default function ReportFilterSelect({
  label,
  value,
  options = [],
  onChange,
  disabled = false,
  buttonClassName = "",
  panelClassName = "",
  searchInputClassName = "",
  optionClassName = "",
  selectedOptionClassName = "",
  emptyStateClassName = "",
  searchPlaceholder = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState(null);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxId = useId();
  const normalizedQuery = normalizeSearchValue(query);

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeSearchValue(option).includes(normalizedQuery));
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedTrigger = containerRef.current?.contains(event.target);
      const clickedPanel = panelRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedPanel) {
        setQuery("");
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setQuery("");
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!disabled) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      setQuery("");
      setIsOpen(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const syncPanelPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 12;
      const maxWidth = Math.min(520, window.innerWidth - viewportPadding * 2);
      const preferredWidth = Math.max(rect.width, 340);
      const width = Math.min(preferredWidth, maxWidth);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
      );

      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width,
      });
    };

    syncPanelPosition();
    window.addEventListener("resize", syncPanelPosition);
    window.addEventListener("scroll", syncPanelPosition, true);

    return () => {
      window.removeEventListener("resize", syncPanelPosition);
      window.removeEventListener("scroll", syncPanelPosition, true);
    };
  }, [isOpen]);

  const handleSelect = (option) => {
    if (disabled) return;
    onChange(option);
    setQuery("");
    setIsOpen(false);
  };

  const closeMenu = () => {
    setQuery("");
    setIsOpen(false);
  };

  const toggleMenu = () => {
    if (disabled) return;

    if (isOpen) {
      closeMenu();
      return;
    }

    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative mt-2 md:mt-3">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-disabled={disabled}
        onClick={toggleMenu}
        className={`flex w-full items-center justify-between gap-3 rounded-md border bg-white/95 px-3 py-1.5 text-left text-sm font-medium text-slate-800 outline-none ring-0 transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-70 md:py-2 ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{value || label}</span>
        {disabled ? (
          <span className="inline-flex h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden="true" />
        ) : null}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""} ${disabled ? "hidden" : ""}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && panelStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className={`z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${panelClassName}`}
              style={panelStyle}
            >
              <div className="border-b border-slate-200 p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  disabled={disabled}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder || `Search ${String(label || "options").toLowerCase()}`}
                  className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 ${searchInputClassName}`}
                />
              </div>

              <div id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1">
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const isSelected = option === value;

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={disabled}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-sky-50 ${
                          isSelected ? "bg-sky-100 text-sky-950" : "text-slate-700"
                        } disabled:cursor-not-allowed disabled:opacity-70 ${optionClassName} ${isSelected ? selectedOptionClassName : ""}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{option}</span>
                        {isSelected ? <span className="shrink-0 text-xs font-semibold text-sky-700">Selected</span> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className={`px-3 py-3 text-sm text-slate-500 ${emptyStateClassName}`}>No matches found.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
