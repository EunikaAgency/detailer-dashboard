"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS } from "@/lib/reportDivision";
import { areReportFiltersEqual, useReportSection } from "./reportClient";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Tooltip, Legend);

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => <ChartLoading />,
});

const Pie = dynamic(() => import("react-chartjs-2").then((mod) => mod.Pie), {
  ssr: false,
  loading: () => <ChartLoading />,
});

const FILTERS = [
  { key: "year", label: "Year", hint: "" },
  { key: "month", label: "Month", hint: "(multiple selection)" },
  { key: "division", label: "Division", hint: "(All, Carry-All GMA, Carry-All Prov, CNS)" },
  { key: "team", label: "Team", hint: "" },
  { key: "psr", label: "Representative", hint: "" },
  { key: "brand", label: "Brand", hint: "" },
];

const FILTER_OPTIONS = {
  year: [],
  month: [],
  division: REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS,
  team: ["All"],
  psr: ["All"],
  brand: ["All"],
};

const PIE_COLORS = [
  "31, 98, 132",
  "240, 116, 48",
  "29, 120, 44",
  "40, 157, 200",
  "160, 46, 157",
  "78, 171, 44",
];

const SERIES_COLORS = [
  "31, 98, 132",
  "240, 116, 48",
  "33, 122, 57",
  "42, 157, 201",
  "166, 55, 165",
  "96, 165, 59",
  "71, 85, 105",
];

const MONTH_SERIES_COLORS = {
  JAN: "31, 98, 132",
  FEB: "240, 116, 48",
  MAR: "33, 122, 57",
  APR: "42, 157, 201",
  MAY: "166, 55, 165",
  JUN: "96, 165, 59",
};

const LOADING_PLACEHOLDER_TEXT = "Loading...";
const EMPTY_CHART_MESSAGE = "No data available for the selected filters.";
const EMPTY_TABLE_MESSAGE = "No rows available for the selected filters.";
const shouldHideBrandOption = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return false;
  if (key === "all" || key === "all brands") return false;
  if (key === "unknown brand") return true;
  return key.includes("test product") || key.includes("local test") || key.startsWith("demo product");
};

const EMPTY_REPORT = {
  filters: {
    yearOptions: [],
    monthOptions: [],
    divisionOptions: FILTER_OPTIONS.division,
    teamOptions: FILTER_OPTIONS.team,
    psrOptions: FILTER_OPTIONS.psr,
    brandOptions: FILTER_OPTIONS.brand,
    selected: {
      year: "",
      month: "",
      division: "All",
      team: "All",
      psr: "All",
      brand: "All",
    },
  },
  shareOfVoiceBrand: [],
  shareOfVoiceApp: [],
  teamRankings: [],
  repRankings: [],
  generalCountModules: [],
  generalTimeModules: [],
  brandTotalModules: [],
  movingMonthly: {
    monthKeys: [],
    rows: [],
  },
  allPerTeam: {
    labels: [],
    series: [],
  },
  divisionPerTeam: {
    labels: [],
    series: [],
  },
  specialtyCharts: [],
  slideRetentionSlides: [],
  unifiedExportRows: [],
  meta: {
    totalSessionsInYear: 0,
    totalInteractionsInMonth: 0,
    totalSlideViewsInMonth: 0,
    totalSlideMinutesInMonth: 0,
  },
};

const TEAM_TABLE_DATE_COLUMNS = [
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
];

const TEAM_TABLE_BASE_COLUMNS = [
  { key: "rank", label: "Rank", align: "right" },
  { key: "team", label: "Team" },
  { key: "brand", label: "Brand" },
  { key: "detailingCount", label: "Material Open Count", align: "right", format: (value) => value.toLocaleString() },
];

const REP_TABLE_DATE_COLUMNS = [
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
];

const REP_TABLE_BASE_COLUMNS = [
  { key: "rank", label: "Rank", align: "right" },
  { key: "team", label: "Team" },
  { key: "psr", label: "Representative" },
  { key: "brand", label: "Brand" },
  { key: "detailingCount", label: "Material Open Count", align: "right", format: (value) => value.toLocaleString() },
];

const getVisibleDateColumns = (filters = {}) => {
  const columns = [];
  if (filters?.year === "All") {
    columns.push("year");
  }
  if (filters?.month === "All") {
    columns.push("month");
  }
  return columns;
};

const getTeamTableColumns = (filters = {}) => [
  ...TEAM_TABLE_DATE_COLUMNS.filter((column) => getVisibleDateColumns(filters).includes(column.key)),
  ...TEAM_TABLE_BASE_COLUMNS,
];

const getRepTableColumns = (filters = {}) => [
  ...REP_TABLE_DATE_COLUMNS.filter((column) => getVisibleDateColumns(filters).includes(column.key)),
  ...REP_TABLE_BASE_COLUMNS,
];

const TEAM_RANKING_EXPORT_COLUMNS = [...TEAM_TABLE_DATE_COLUMNS, ...TEAM_TABLE_BASE_COLUMNS].map(({ key, label }) => ({
  key,
  label,
}));
const REP_RANKING_EXPORT_COLUMNS = [...REP_TABLE_DATE_COLUMNS, ...REP_TABLE_BASE_COLUMNS].map(({ key, label }) => ({
  key,
  label,
}));

const SHARE_EXPORT_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "percent", label: "Percent" },
];

const MODULE_EXPORT_COLUMNS = [
  { key: "module", label: "Module" },
  { key: "brand", label: "Brand" },
  { key: "value", label: "Value" },
];

const SLIDE_ACTIVITY_PRODUCT_EXPORT_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "product", label: "Product" },
  { key: "minutes", label: "Minutes Viewed" },
];

const SLIDE_ACTIVITY_ATTACHMENT_EXPORT_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "product", label: "Product" },
  { key: "attachment", label: "Attachment" },
  { key: "minutes", label: "Minutes Viewed" },
];

const SLIDE_ACTIVITY_SLIDE_EXPORT_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "product", label: "Product" },
  { key: "attachment", label: "Attachment" },
  { key: "slide", label: "Slide" },
  { key: "slideNumber", label: "Slide Number" },
  { key: "minutes", label: "Minutes Viewed" },
];

const UNIFIED_EXPORT_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "month", label: "Month" },
  { key: "team", label: "Team" },
  { key: "psr", label: "Representative" },
  { key: "brand", label: "Brand" },
  { key: "productName", label: "Product Name" },
  { key: "material", label: "Material" },
  { key: "slide", label: "Slide" },
  { key: "secondsViewed", label: "Seconds viewed" },
  { key: "timeOpened", label: "Time opened" },
  { key: "timeClosed", label: "Time closed" },
];

function rgba(color, alpha) {
  return `rgba(${color}, ${alpha})`;
}

function toMultilineLabel(value, maxLineLength = 16) {
  const words = String(value || "").split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const nextValue = current ? `${current} ${word}` : word;
    if (nextValue.length <= maxLineLength || !current) {
      current = nextValue;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length > 1 ? lines : String(value || "");
}

function formatPercent(value) {
  return `${value}%`;
}

function escapeCsvCell(value) {
  const text = normalizeExportCell(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeExportCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function toExportNumber(value, fractionDigits = 2) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Number(numericValue.toFixed(fractionDigits));
}

function toMaterialName({ attachment, slide, brand }) {
  const attachmentValue = String(attachment || "").trim();
  const slideValue = String(slide || "").trim();
  const brandValue = String(brand || "").trim();
  const source = attachmentValue || slideValue;
  if (!source) return "UNKNOWN MATERIAL";

  const withoutExtension = source.replace(/\.[a-z0-9]{2,5}$/i, "");
  const withoutSlideSuffix = withoutExtension.replace(/(?:^|[\s_-])(slide|page)[\s_-]*\d+$/i, "");
  const tokens = withoutSlideSuffix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const dedupedTokens = [];
  tokens.forEach((token) => {
    const previous = dedupedTokens[dedupedTokens.length - 1];
    if (previous && previous.toLowerCase() === token.toLowerCase()) return;
    dedupedTokens.push(token);
  });

  if (!dedupedTokens.length) return "UNKNOWN MATERIAL";

  if (brandValue && dedupedTokens.length >= 2) {
    const brandLower = brandValue.toLowerCase();
    if (dedupedTokens[0].toLowerCase() === brandLower && dedupedTokens[1].toLowerCase() === brandLower) {
      dedupedTokens.splice(1, 1);
    }
  }

  return dedupedTokens.join(" ").toUpperCase();
}

function toHumanReadableDate(value, fallbackMonth = "", fallbackYear = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    const month = String(fallbackMonth || "").trim();
    const year = String(fallbackYear || "").trim();
    return [month, year].filter(Boolean).join(" ").trim();
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return raw;
}

function toHumanReadableTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toElapsedTime(value) {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toFileSlug(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "all"
  );
}

function buildFilenameBase(filters, reportName = "dashboard-reports") {
  const parts = [
    reportName,
    filters?.year,
    filters?.month,
    filters?.division,
    filters?.team,
    filters?.psr,
    filters?.brand,
  ].map(toFileSlug);

  return parts.join("-");
}

function buildMatrixExport(chart, firstColumnLabel) {
  const labels = Array.isArray(chart?.labels) ? chart.labels : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  const seriesColumns = series.map((item, index) => ({
    key: `series_${index}`,
    label: item?.label || `Series ${index + 1}`,
  }));

  return {
    columns: [{ key: "label", label: firstColumnLabel }, ...seriesColumns],
    rows: labels.map((label, rowIndex) => {
      const row = { label };
      seriesColumns.forEach((column, seriesIndex) => {
        row[column.key] = Number(series?.[seriesIndex]?.values?.[rowIndex] || 0);
      });
      return row;
    }),
  };
}

function buildShareExportSection(title, rows) {
  return {
    title,
    columns: SHARE_EXPORT_COLUMNS,
    rows: (rows || []).map((row) => ({
      brand: row.label,
      percent: row.value,
    })),
  };
}

function buildModuleExportSection(title, rows) {
  return {
    title,
    columns: MODULE_EXPORT_COLUMNS,
    rows: (rows || []).map((row) => ({
      module: row.label,
      brand: row.brand || "",
      value: row.value,
    })),
  };
}

function buildMovingMonthlyExportSection(chart) {
  const monthKeys = Array.isArray(chart?.monthKeys) ? chart.monthKeys : [];
  const rows = Array.isArray(chart?.rows) ? chart.rows : [];

  return {
    title: "Moving Monthly per Module",
    columns: [
      { key: "module", label: "Module" },
      { key: "brand", label: "Brand" },
      ...monthKeys.map((monthKey) => ({ key: monthKey, label: monthKey })),
    ],
    rows: rows.map((row) => ({
      module: row.label,
      brand: row.brand || "",
      ...Object.fromEntries(monthKeys.map((monthKey) => [monthKey, Number(row?.values?.[monthKey] || 0)])),
    })),
  };
}

function buildTeamMatrixExportSection(title, chart) {
  const matrix = buildMatrixExport(chart, "Module");
  return {
    title,
    columns: matrix.columns,
    rows: matrix.rows,
  };
}

function buildSlideActivityExportSections({
  slideActivityBrand,
  slideActivityProduct,
  slideActivityAttachment,
  slideActivityBrandRows,
  slideActivityProductRows,
  slideActivityAttachmentRows,
  isAttachmentDrilldown,
}) {
  const slideSection = isAttachmentDrilldown
    ? {
        title: `Per-Slides Slide Activity - ${slideActivityAttachment}`,
        columns: SLIDE_ACTIVITY_SLIDE_EXPORT_COLUMNS,
        rows: (slideActivityAttachmentRows || []).map((row) => ({
          brand: row.brand || slideActivityBrand,
          product: row.product || slideActivityProduct,
          attachment: row.attachment || slideActivityAttachment,
          slide: row.exportName || row.slide || row.label,
          slideNumber: row.slideNumber,
          minutes: toExportNumber(row.value),
        })),
      }
    : {
        title: `Per-Slides Slide Activity - ${slideActivityProduct}`,
        columns: SLIDE_ACTIVITY_ATTACHMENT_EXPORT_COLUMNS,
        rows: (slideActivityProductRows || []).map((row) => ({
          brand: row.brand || slideActivityBrand,
          product: row.product || slideActivityProduct,
          attachment: row.label,
          minutes: toExportNumber(row.value),
        })),
      };

  return [
    {
      title: `Per-Brand Slide Activity - ${slideActivityBrand}`,
      columns: SLIDE_ACTIVITY_PRODUCT_EXPORT_COLUMNS,
      rows: (slideActivityBrandRows || []).map((row) => ({
        brand: row.brand || slideActivityBrand,
        product: row.label,
        minutes: toExportNumber(row.value),
      })),
    },
    slideSection,
  ];
}

function sectionsToCsv(sections) {
  const normalizedSections = Array.isArray(sections) ? sections : [];
  if (normalizedSections.length === 1) {
    const section = normalizedSections[0] || {};
    const columns = Array.isArray(section.columns) ? section.columns : [];
    const rows = Array.isArray(section.rows) ? section.rows : [];

    if (columns.length === 0) return "\ufeffNo data";

    const lines = [columns.map((column) => escapeCsvCell(column.label)).join(",")];
    if (rows.length === 0) {
      lines.push("No data");
      return `\ufeff${lines.join("\n")}`;
    }

    rows.forEach((row) => {
      lines.push(columns.map((column) => escapeCsvCell(row?.[column.key] ?? "")).join(","));
    });

    return `\ufeff${lines.join("\n")}`;
  }

  const lines = [];

  normalizedSections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) lines.push("");
    lines.push(escapeCsvCell(section.title));

    const columns = Array.isArray(section.columns) ? section.columns : [];
    const rows = Array.isArray(section.rows) ? section.rows : [];

    if (columns.length === 0 || rows.length === 0) {
      lines.push("No data");
      return;
    }

    lines.push(columns.map((column) => escapeCsvCell(column.label)).join(","));
    rows.forEach((row) => {
      lines.push(columns.map((column) => escapeCsvCell(row?.[column.key] ?? "")).join(","));
    });
  });

  return `\ufeff${lines.join("\n")}`;
}

function normalizeExcelSheetName(value, fallback) {
  const cleaned = String(value || fallback || "Sheet")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback || "Sheet").slice(0, 31);
}

function toExcelCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  return normalizeExportCell(value);
}

function sectionsToXlsxArray(sections) {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set();

  sections.forEach((section, sectionIndex) => {
    const columns = Array.isArray(section.columns) ? section.columns : [];
    const rows = Array.isArray(section.rows) ? section.rows : [];
    const baseSheetName = normalizeExcelSheetName(section.title, `Sheet ${sectionIndex + 1}`);
    let sheetName = baseSheetName;
    let duplicateIndex = 2;

    while (usedSheetNames.has(sheetName)) {
      const suffix = ` ${duplicateIndex}`;
      sheetName = `${baseSheetName.slice(0, 31 - suffix.length)}${suffix}`;
      duplicateIndex += 1;
    }
    usedSheetNames.add(sheetName);

    const tableRows =
      columns.length > 0 && rows.length > 0
        ? [
            columns.map((column) => column.label),
            ...rows.map((row) => columns.map((column) => toExcelCellValue(row?.[column.key]))),
          ]
        : [["No Data"], ["-"]];
    const worksheet = XLSX.utils.aoa_to_sheet(tableRows);
    worksheet["!cols"] = tableRows[0].map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

function ChartLoading() {
  return (
    <div className="flex w-full min-h-[240px] items-center justify-center text-sm text-gray-500">
      {LOADING_PLACEHOLDER_TEXT}
    </div>
  );
}

function ChartEmpty({ message = EMPTY_CHART_MESSAGE }) {
  return (
    <div className="flex w-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

function FilterTile({ filterKey, label, hint, value, options, onChange }) {
  return (
    <label className="flex min-h-[74px] flex-col justify-between rounded-none border border-white/25 bg-[#1f6889] px-3 py-2.5 text-white md:min-h-[82px] md:px-4 md:py-3">
      <div>
        <div className="text-[1.45rem] font-semibold leading-none md:text-[1.75rem] xl:text-[1.95rem]">{label}</div>
        {hint ? <div className="mt-1 text-[11px] italic text-white/85 md:text-xs">{hint}</div> : null}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(filterKey, event.target.value)}
        className="mt-2 w-full rounded-md border border-white/35 bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-800 outline-none ring-0 md:mt-3 md:py-2"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineSelect({ label, value, options, onChange }) {
  return (
    <label className="flex min-w-[220px] flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 outline-none transition focus:border-sky-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-[1.65rem] font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="relative py-4">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#0f4c5c]/25 to-transparent" />
      <div className="relative mx-auto w-fit rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c] shadow-sm">
        {label}
      </div>
    </div>
  );
}

function ReportCard({ title, subtitle, actions = null, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h3 className="text-[0.92rem] font-semibold text-slate-900 sm:text-[1.05rem]">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PieLegend({ items, selectedBrand }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {items.map((item, index) => {
        const isSelected = selectedBrand !== "All" && item.label === selectedBrand;
        return (
          <div
            key={item.label}
            className={`rounded-xl border px-3 py-2 ${isSelected ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: rgba(PIE_COLORS[index % PIE_COLORS.length], 0.92) }}
                />
                <span className="truncate text-sm font-medium text-slate-700">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">{formatPercent(item.value)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable({ title, subtitle, rows, columns, emptyMessage }) {
  return (
    <ReportCard title={title} subtitle={subtitle}>
      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-[760px] border border-slate-200 text-xs text-slate-700 sm:min-w-full sm:text-sm">
          <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`border border-slate-200 px-2 py-2 font-semibold sm:px-3 ${column.align === "right" ? "text-right" : "text-left"}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-slate-200 px-3 py-6 text-center text-xs text-slate-500 sm:text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.year}-${row.month}-${row.team}-${row.psr || ""}-${row.brand}-${row.rank}`} className="odd:bg-white even:bg-slate-50/70">
                  {columns.map((column) => {
                    const rawValue = row[column.key];
                    const value = column.format ? column.format(rawValue, row) : rawValue;
                    const cellTone =
                      column.key === "rank" || column.key === "brand" || column.key === "detailingCount"
                        ? "font-semibold text-sky-700"
                        : "text-slate-700";

                    return (
                      <td
                        key={column.key}
                        className={`border border-slate-200 px-2 py-2 sm:px-3 ${column.align === "right" ? "text-right" : "text-left"} ${cellTone}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function ExportButtons({ disabled, filenameBase, sections, csvSections }) {
  const handleExportCsv = () => {
    downloadFile(`${filenameBase}.csv`, sectionsToCsv(csvSections || sections), "text/csv;charset=utf-8;");
  };

  const handleExportExcel = () => {
    downloadFile(
      `${filenameBase}.xlsx`,
      sectionsToXlsxArray(sections),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={disabled}
        className="rounded-md border border-sky-700 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={disabled}
        className="rounded-md border border-sky-700 bg-sky-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
      >
        Export Excel
      </button>
    </div>
  );
}

function toCsvDate(value, fallbackMonth = "", fallbackYear = "") {
  const raw = String(value || "").trim();
  if (raw) return raw;

  const month = String(fallbackMonth || "").trim();
  const year = String(fallbackYear || "").trim();
  return [year, month].filter(Boolean).join("-");
}

function toCsvTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function buildPieData(items, selectedBrand) {
  return {
    labels: items.map((item) => item.label),
    datasets: [
      {
        data: items.map((item) => item.value),
        backgroundColor: items.map((_, index) => rgba(PIE_COLORS[index % PIE_COLORS.length], 0.95)),
        borderColor: "#ffffff",
        borderWidth: 2,
        offset: items.map((item) => (selectedBrand !== "All" && item.label === selectedBrand ? 18 : 0)),
      },
    ],
  };
}

function buildSingleBarData(items, options = {}) {
  return {
    labels: items.map((item) => toMultilineLabel(item.label)),
    datasets: [
      {
        label: options.datasetLabel || "Material Open Count",
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(options.color || SERIES_COLORS[0], 0.95),
        borderRadius: 4,
        maxBarThickness: options.maxBarThickness || 36,
      },
    ],
  };
}

function getSlideOrder(item) {
  const explicitValue = Number(item?.slideNumber || 0);
  if (Number.isFinite(explicitValue) && explicitValue > 0) return explicitValue;

  const label = String(item?.slide || item?.label || "").trim();
  const matched = label.match(/slide\s+(\d+)/i);
  return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER;
}

function buildSlideTrendData(items, options = {}) {
  const sortedItems = [...items].sort(
    (left, right) => getSlideOrder(left) - getSlideOrder(right) || String(left.label || "").localeCompare(String(right.label || ""))
  );

  return {
    labels: sortedItems.map((item) => `Slide ${getSlideOrder(item)}`),
    datasets: [
      {
        label: options.datasetLabel || "Minutes Viewed",
        data: sortedItems.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(options.color || SERIES_COLORS[0], 0.9),
        borderColor: rgba(options.color || SERIES_COLORS[0], 1),
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 28,
        fullLabels: sortedItems.map((item) => {
          const slide = String(item.slide || item.label || "").trim() || "Unknown Slide";
          return slide;
        }),
      },
    ],
  };
}

function buildMonthGroupedData(config) {
  const rows = Array.isArray(config?.rows) ? config.rows : [];
  const monthKeys = Array.isArray(config?.monthKeys) ? config.monthKeys : [];
  return {
    labels: rows.map((item) => toMultilineLabel(item.label)),
    datasets: monthKeys.map((monthKey) => ({
      label: monthKey,
      data: rows.map((item) => Number(item?.values?.[monthKey] || 0)),
      backgroundColor: rgba(MONTH_SERIES_COLORS[monthKey] || SERIES_COLORS[0], 0.9),
      borderRadius: 3,
      maxBarThickness: 18,
    })),
  };
}

function buildTeamGroupedData(chart) {
  const labels = Array.isArray(chart?.labels) ? chart.labels : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  return {
    labels: labels.map((label) => toMultilineLabel(label)),
    datasets: series.map((dataset, index) => {
      return {
        label: dataset.label,
        data: (Array.isArray(dataset.values) ? dataset.values : []).map((value) => Number(value || 0)),
        backgroundColor: rgba(SERIES_COLORS[index % SERIES_COLORS.length], 0.92),
        borderRadius: 3,
        maxBarThickness: 18,
      };
    }),
  };
}

function buildBarOptions({
  yTitle = "Material Open Count",
  legend = false,
  legendPosition = "bottom",
  stacked = false,
  minY = 0,
} = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: legend,
        position: legendPosition,
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: "#475569",
          font: { size: 11, weight: "600" },
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${Number(context.parsed.y || 0).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
      },
      y: {
        stacked,
        min: minY,
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
        title: {
          display: Boolean(yTitle),
          text: yTitle,
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
    },
  };
}

function buildHorizontalBarOptions({ xTitle = "Minutes Viewed" } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${Number(context.parsed.x || 0).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
        title: {
          display: Boolean(xTitle),
          text: xTitle,
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
      },
    },
  };
}

function buildSlideBarOptions({ yTitle = "Minutes Viewed" } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "x",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title(context) {
            const dataset = context?.[0]?.dataset;
            const dataIndex = context?.[0]?.dataIndex ?? 0;
            return dataset?.fullLabels?.[dataIndex] || context?.[0]?.label || "";
          },
          label(context) {
            return `Minutes Viewed: ${Number(context.parsed.y || 0).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 16,
          color: "#475569",
          font: { size: 11 },
        },
        title: {
          display: true,
          text: "Slide Sequence",
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
        title: {
          display: Boolean(yTitle),
          text: yTitle,
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
    },
  };
}

function buildPieOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.label}: ${context.raw}%`;
          },
        },
      },
    },
  };
}

export default function ReportsPage({ filters: controlledFilters, onFiltersChange } = {}) {
  const [localFilters, setLocalFilters] = useState(EMPTY_REPORT.filters.selected);
  const [slideActivityBrand, setSlideActivityBrand] = useState("All Brands");
  const [slideActivityProduct, setSlideActivityProduct] = useState("All Products");
  const [slideActivityAttachment, setSlideActivityAttachment] = useState("All Attachments");
  const filters = controlledFilters || localFilters;
  const setSelectedFilters = onFiltersChange || setLocalFilters;

  const filtersResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "filters",
    fallbackData: { filters: EMPTY_REPORT.filters },
  });
  const overviewResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "overview",
    fallbackData: {
      filters: EMPTY_REPORT.filters,
      shareOfVoiceBrand: EMPTY_REPORT.shareOfVoiceBrand,
      shareOfVoiceApp: EMPTY_REPORT.shareOfVoiceApp,
      teamRankings: EMPTY_REPORT.teamRankings,
      repRankings: EMPTY_REPORT.repRankings,
      meta: EMPTY_REPORT.meta,
    },
  });
  const modulesResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "modules",
    fallbackData: {
      filters: EMPTY_REPORT.filters,
      generalCountModules: EMPTY_REPORT.generalCountModules,
      generalTimeModules: EMPTY_REPORT.generalTimeModules,
      brandTotalModules: EMPTY_REPORT.brandTotalModules,
      movingMonthly: EMPTY_REPORT.movingMonthly,
    },
  });
  const teamSectionResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "team",
    fallbackData: {
      filters: EMPTY_REPORT.filters,
      allPerTeam: EMPTY_REPORT.allPerTeam,
      divisionPerTeam: EMPTY_REPORT.divisionPerTeam,
      specialtyCharts: EMPTY_REPORT.specialtyCharts,
    },
  });
  const slidesResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "slides",
    fallbackData: {
      filters: EMPTY_REPORT.filters,
      slideRetentionSlides: EMPTY_REPORT.slideRetentionSlides,
      unifiedExportRows: EMPTY_REPORT.unifiedExportRows,
    },
  });

  useEffect(() => {
    if (filtersResult.isLoading || filtersResult.error) return;

    const nextSelected = filtersResult.data?.filters?.selected;
    if (!nextSelected) return;

    setSelectedFilters((current) => (areReportFiltersEqual(current, nextSelected) ? current : nextSelected));
  }, [filtersResult.data, filtersResult.error, filtersResult.isLoading, setSelectedFilters]);

  const handleFilterChange = (key, value) => {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
  };

  const filterOptions = {
    year: filtersResult.data?.filters?.yearOptions?.length ? filtersResult.data.filters.yearOptions : FILTER_OPTIONS.year,
    month: filtersResult.data?.filters?.monthOptions?.length ? filtersResult.data.filters.monthOptions : FILTER_OPTIONS.month,
    division: filtersResult.data?.filters?.divisionOptions?.length
      ? filtersResult.data.filters.divisionOptions
      : FILTER_OPTIONS.division,
    team: filtersResult.data?.filters?.teamOptions?.length ? filtersResult.data.filters.teamOptions : FILTER_OPTIONS.team,
    psr: filtersResult.data?.filters?.psrOptions?.length ? filtersResult.data.filters.psrOptions : FILTER_OPTIONS.psr,
    brand: (
      filtersResult.data?.filters?.brandOptions?.length ? filtersResult.data.filters.brandOptions : FILTER_OPTIONS.brand
    ).filter(
      (brand) => !shouldHideBrandOption(brand)
    ),
  };

  const teamRankingRows = overviewResult.data?.teamRankings || EMPTY_REPORT.teamRankings;
  const repRankingRows = overviewResult.data?.repRankings || EMPTY_REPORT.repRankings;

  const brandShareRows = overviewResult.data?.shareOfVoiceBrand || EMPTY_REPORT.shareOfVoiceBrand;
  const appShareRows = overviewResult.data?.shareOfVoiceApp || EMPTY_REPORT.shareOfVoiceApp;
  const generalCountRows = modulesResult.data?.generalCountModules || EMPTY_REPORT.generalCountModules;
  const generalTimeRows = modulesResult.data?.generalTimeModules || EMPTY_REPORT.generalTimeModules;
  const brandTotalRows = modulesResult.data?.brandTotalModules || EMPTY_REPORT.brandTotalModules;
  const specialtyCharts = teamSectionResult.data?.specialtyCharts || EMPTY_REPORT.specialtyCharts;
  const slideRetentionRows = slidesResult.data?.slideRetentionSlides || EMPTY_REPORT.slideRetentionSlides;

  const slideRetentionBrandOptions = useMemo(() => {
    const brands = Array.from(
      new Set(
        (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
          .map((row) => String(row?.brand || "").trim())
          .filter((brand) => brand && !shouldHideBrandOption(brand))
      )
    ).sort((left, right) => left.localeCompare(right));

    return ["All Brands", ...brands];
  }, [slideRetentionRows]);

  useEffect(() => {
    setSlideActivityBrand((current) =>
      slideRetentionBrandOptions.includes(current) ? current : slideRetentionBrandOptions[0] || "All Brands"
    );
  }, [slideRetentionBrandOptions]);

  const slideRetentionProductOptions = useMemo(() => {
    const products = Array.from(
      new Set(
        (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
          .filter((row) => slideActivityBrand === "All Brands" || row.brand === slideActivityBrand)
          .map((row) => String(row?.product || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));

    return ["All Products", ...products];
  }, [slideRetentionRows, slideActivityBrand]);

  useEffect(() => {
    setSlideActivityProduct((current) =>
      slideRetentionProductOptions.includes(current) ? current : slideRetentionProductOptions[0] || "All Products"
    );
  }, [slideRetentionProductOptions]);

  const slideRetentionAttachmentOptions = useMemo(() => {
    const attachments = Array.from(
      new Set(
        (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
          .filter((row) => slideActivityBrand === "All Brands" || row.brand === slideActivityBrand)
          .filter((row) => slideActivityProduct === "All Products" || row.product === slideActivityProduct)
          .map((row) => String(row?.attachment || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));

    return ["All Attachments", ...attachments];
  }, [slideRetentionRows, slideActivityBrand, slideActivityProduct]);

  useEffect(() => {
    setSlideActivityAttachment((current) =>
      slideRetentionAttachmentOptions.includes(current) ? current : slideRetentionAttachmentOptions[0] || "All Attachments"
    );
  }, [slideRetentionAttachmentOptions]);

  const slideActivityBrandRows = useMemo(
    () => {
      const grouped = new Map();

      (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
        .filter((row) => slideActivityBrand === "All Brands" || row.brand === slideActivityBrand)
        .forEach((row) => {
          const productLabel = String(row?.product || "").trim();
          if (!productLabel) return;

          const current = grouped.get(productLabel) || {
            label: productLabel,
            value: 0,
            brand: row.brand,
          };

          current.value += Number(row?.totalMinutes || 0);
          grouped.set(productLabel, current);
        });

      return Array.from(grouped.values())
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value || String(left.label || "").localeCompare(String(right.label || "")))
        .slice(0, 10);
    },
    [slideRetentionRows, slideActivityBrand]
  );
  const slideActivityProductRows = useMemo(
    () => {
      const grouped = new Map();

      (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
        .filter((row) => slideActivityBrand === "All Brands" || row.brand === slideActivityBrand)
        .filter((row) => slideActivityProduct === "All Products" || row.product === slideActivityProduct)
        .forEach((row) => {
          const attachmentLabel = String(row?.attachment || "").trim() || "Unknown Attachment";
          const current = grouped.get(attachmentLabel) || {
            label: attachmentLabel,
            value: 0,
            brand: row.brand,
            product: row.product,
          };

          current.value += Number(row?.totalMinutes || 0);
          grouped.set(attachmentLabel, current);
        });

      return Array.from(grouped.values())
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value || String(left.label || "").localeCompare(String(right.label || "")));
    },
    [slideRetentionRows, slideActivityBrand, slideActivityProduct]
  );
  const slideActivityAttachmentRows = useMemo(
    () => {
      const grouped = new Map();

      (Array.isArray(slideRetentionRows) ? slideRetentionRows : [])
        .filter((row) => slideActivityBrand === "All Brands" || row.brand === slideActivityBrand)
        .filter((row) => slideActivityProduct === "All Products" || row.product === slideActivityProduct)
        .filter((row) => slideActivityAttachment === "All Attachments" || row.attachment === slideActivityAttachment)
        .forEach((row) => {
          const slideLabel = String(row?.slide || row?.label || "").trim() || "Unknown Slide";
          const slideExportName = String(row?.exportName || row?.slide || row?.label || "").trim() || slideLabel;
          const slideOrder = Number(row?.slideNumber || 0) || null;
          const groupKey = slideOrder ? `slide-${slideOrder}` : slideLabel;
          const current = grouped.get(groupKey) || {
            label: slideLabel,
            exportName: slideExportName,
            value: 0,
            slideNumber: slideOrder,
            brand: row.brand,
            product: row.product,
            attachment: row.attachment,
          };

          current.value += Number(row?.totalMinutes || 0);
          grouped.set(groupKey, current);
        });

      return Array.from(grouped.values())
        .filter((row) => row.value > 0)
        .sort((left, right) => getSlideOrder(left) - getSlideOrder(right) || String(left.label || "").localeCompare(String(right.label || "")));
    },
    [slideRetentionRows, slideActivityBrand, slideActivityProduct, slideActivityAttachment]
  );

  const brandShareChart = useMemo(() => buildPieData(brandShareRows, filters.brand), [brandShareRows, filters.brand]);
  const appShareChart = useMemo(() => buildPieData(appShareRows, filters.brand), [appShareRows, filters.brand]);
  const generalCountChart = useMemo(
    () => buildSingleBarData(generalCountRows, { datasetLabel: "Material Open Count" }),
    [generalCountRows]
  );
  const generalTimeChart = useMemo(
    () => buildSingleBarData(generalTimeRows, { datasetLabel: "Minutes Spent" }),
    [generalTimeRows]
  );
  const brandTotalChart = useMemo(
    () => buildSingleBarData(brandTotalRows, { datasetLabel: "Material Open Count" }),
    [brandTotalRows]
  );
  const movingMonthlyChart = useMemo(
    () => buildMonthGroupedData(modulesResult.data?.movingMonthly),
    [modulesResult.data?.movingMonthly]
  );
  const allPerTeamChart = useMemo(
    () => buildTeamGroupedData(teamSectionResult.data?.allPerTeam),
    [teamSectionResult.data?.allPerTeam]
  );
  const divisionPerTeamChart = useMemo(
    () => buildTeamGroupedData(teamSectionResult.data?.divisionPerTeam),
    [teamSectionResult.data?.divisionPerTeam]
  );
  const slideActivityBrandChart = useMemo(
    () =>
      buildSingleBarData(slideActivityBrandRows, {
        datasetLabel: "Minutes Viewed",
        color: SERIES_COLORS[5],
        maxBarThickness: 28,
      }),
    [slideActivityBrandRows]
  );
  const slideActivityProductChart = useMemo(
    () =>
      buildSingleBarData(slideActivityProductRows, {
        datasetLabel: "Minutes Viewed",
        color: SERIES_COLORS[2],
        maxBarThickness: 28,
      }),
    [slideActivityProductRows]
  );
  const slideActivityAttachmentChart = useMemo(
    () => buildSlideTrendData(slideActivityAttachmentRows, { datasetLabel: "Minutes Viewed", color: SERIES_COLORS[0] }),
    [slideActivityAttachmentRows]
  );
  const isAttachmentDrilldown = slideActivityAttachment !== "All Attachments";
  const slideActivitySummaryHeight = useMemo(
    () => `${Math.max(260, Math.min(560, slideActivityProductRows.length * 38))}px`,
    [slideActivityProductRows.length]
  );

  const isAllYears = filters.year === "All";
  const isAllMonths = filters.month === "All";
  const selectedYearText = isAllYears ? "all years" : filters.year;
  const selectedMonthText = isAllMonths ? "all months" : filters.month;
  const periodScopeLabel = isAllMonths
    ? isAllYears
      ? "all months across all years"
      : `all months in ${selectedYearText}`
    : isAllYears
    ? `${selectedMonthText} across all years`
    : `${selectedMonthText} ${selectedYearText}`;
  const yearlyScopeLabel = isAllYears ? "all years combined" : selectedYearText;
  const rankingScopeLabel =
    isAllMonths || isAllYears
      ? `Shows the Material Open Count used to rank each team or representative during ${periodScopeLabel}.`
      : `Shows the Material Open Count used to rank each team or representative in ${periodScopeLabel}.`;
  const countScopeLabel =
    isAllMonths || isAllYears
      ? `Shows each brand's share of the total Material Open Count during ${periodScopeLabel}.`
      : `Shows each brand's share of the total Material Open Count in ${periodScopeLabel}.`;
  const timeScopeLabel =
    isAllMonths || isAllYears
      ? `Shows each brand's share of total time spent during ${periodScopeLabel}. Time is measured in minutes.`
      : `Shows each brand's share of total time spent in ${periodScopeLabel}. Time is measured in minutes.`;
  const generalCountPlainLabel =
    isAllMonths || isAllYears
      ? `Shows the Material Open Count for each material during ${periodScopeLabel}.`
      : `Shows the Material Open Count for each material in ${periodScopeLabel}.`;
  const generalTimePlainLabel =
    isAllMonths || isAllYears
      ? `Shows how many minutes people spent on each material during ${periodScopeLabel}. Time is measured in minutes.`
      : `Shows how many minutes people spent on each material in ${periodScopeLabel}. Time is measured in minutes.`;
  const brandTotalPlainLabel =
    isAllMonths
      ? `Shows the total Material Open Count for ${yearlyScopeLabel}.`
      : `Shows the total Material Open Count for ${periodScopeLabel}.`;
  const movingMonthlyPlainLabel = `Shows the monthly Material Open Count in ${yearlyScopeLabel}.`;
  const teamScopeLabel =
    isAllMonths || isAllYears
      ? `Shows the Material Open Count for each material during ${periodScopeLabel}. Each color in the legend is a team.`
      : `Shows the Material Open Count for each material in ${periodScopeLabel}. Each color in the legend is a team.`;
  const divisionScopeLabel =
    isAllMonths || isAllYears
      ? `Shows the Material Open Count for each material during ${periodScopeLabel}. Each color in the legend is a division.`
      : `Shows the Material Open Count for each material in ${periodScopeLabel}. Each color in the legend is a division.`;
  const slideBrandScopeLabel =
    isAllMonths || isAllYears
      ? `Shows the total minutes viewed for each product during ${periodScopeLabel}.`
      : `Shows the total minutes viewed for each product in ${periodScopeLabel}.`;
  const slideDetailTitle = isAttachmentDrilldown
    ? "Slides With the Most Viewing Time"
    : "Materials With the Most Slide Viewing Time";
  const slideDetailScopeLabel = isAttachmentDrilldown
    ? isAllMonths || isAllYears
      ? `Shows the total minutes viewed for each slide in ${slideActivityAttachment || "the selected material"} during ${periodScopeLabel}.`
      : `Shows the total minutes viewed for each slide in ${slideActivityAttachment || "the selected material"} in ${periodScopeLabel}.`
    : isAllMonths || isAllYears
    ? `Shows the total minutes viewed for each material during ${periodScopeLabel}. Pick one material below to switch to a slide-by-slide view.`
    : `Shows the total minutes viewed for each material in ${periodScopeLabel}. Pick one material below to switch to a slide-by-slide view.`;
  const slideDetailHelperText = isAttachmentDrilldown
    ? "Each bar is one slide, shown in slide number order."
    : "Each bar is one material. Pick one material below to switch to a slide-by-slide view.";
  const specialtyScopeLabel = `Shows the top module totals for ${periodScopeLabel}.`;
  const teamRankingColumns = getTeamTableColumns(filters);
  const repRankingColumns = getRepTableColumns(filters);

  const overviewError = overviewResult.error;
  const modulesError = modulesResult.error;
  const teamError = teamSectionResult.error;
  const slidesError = slidesResult.error;
  const firstSectionError =
    filtersResult.error || overviewError || modulesError || teamError || slidesError;
  const activeFilterText = `${filters.year} / ${filters.month} / ${filters.division} / ${filters.team} / ${filters.psr} / ${filters.brand}`;
  const visibleTeamRankingRows = overviewResult.isLoading ? [] : teamRankingRows;
  const visibleRepRankingRows = overviewResult.isLoading ? [] : repRankingRows;
  const hasBrandShareData = brandShareRows.length > 0;
  const hasAppShareData = appShareRows.length > 0;
  const hasGeneralCountData = generalCountRows.length > 0;
  const hasGeneralTimeData = generalTimeRows.length > 0;
  const hasBrandTotalData = brandTotalRows.length > 0;
  const hasMovingMonthlyData = Boolean(modulesResult.data?.movingMonthly?.rows?.length);
  const hasAllPerTeamData = Boolean(teamSectionResult.data?.allPerTeam?.labels?.length);
  const hasDivisionPerTeamData = Boolean(
    teamSectionResult.data?.divisionPerTeam?.labels?.length && teamSectionResult.data?.divisionPerTeam?.series?.length
  );
  const hasSpecialtyData = specialtyCharts.length > 0;
  const showDivisionPerTeamCard = teamSectionResult.isLoading || hasDivisionPerTeamData;
  const teamModulesHeadingClass = showDivisionPerTeamCard ? "grid gap-2 xl:grid-cols-2" : "grid gap-2";
  const teamModulesGridClass = showDivisionPerTeamCard ? "grid gap-4 sm:gap-6 xl:grid-cols-2" : "grid gap-4 sm:gap-6";
  const specialtyGridClass =
    teamSectionResult.isLoading || specialtyCharts.length > 1 ? "grid gap-4 sm:gap-6 xl:grid-cols-2" : "grid gap-4 sm:gap-6";
  const hasSlideActivityBrandData = slideActivityBrandRows.length > 0;
  const hasSlideActivityProductData = slideActivityProductRows.length > 0;
  const hasSlideActivityAttachmentData = isAttachmentDrilldown ? slideActivityAttachmentRows.length > 0 : hasSlideActivityProductData;
  const unifiedExportRows = useMemo(() => {
    if (Array.isArray(slidesResult.data?.unifiedExportRows) && slidesResult.data.unifiedExportRows.length > 0) {
      return slidesResult.data.unifiedExportRows;
    }

    // Fallback for environments that still serve older API payloads without unifiedExportRows.
    const materialWindows = new Map();
    const materialUseKeysByMaterial = new Map();
    const grouped = new Map();
    (Array.isArray(slideRetentionRows) ? slideRetentionRows : []).forEach((row) => {
      const year = String(row?.year || filters.year || "").trim() || "All";
      const month = String(row?.month || filters.month || "").trim() || "All";
      const date = String(row?.date || "").trim() || `${year}-${month}`;
      const team = String(row?.team || "").trim() || "Unassigned Team";
      const psr = String(row?.psr || "").trim() || "Unknown Representative";
      const brand = String(row?.brand || "").trim() || "Unknown Brand";
      const productName = String(row?.product || "").trim();
      if (!productName) return;

      const material = toMaterialName({
        attachment: row?.attachment,
        slide: row?.exportName || row?.label || row?.slide || "",
        brand,
      });
      const slide = String(row?.exportName || row?.label || row?.slide || "").trim() || "Unknown Slide";
      const materialUseKey =
        String(row?.materialUseKey || "").trim() ||
        [
          date,
          String(row?.userId || row?.psr || psr || "").trim(),
          String(row?.sessionId || row?.caseId || row?.deckId || material).trim(),
          productName,
          material,
        ]
          .filter(Boolean)
          .join("||");
      const secondsViewed = Number(row?.totalMinutes || 0) * 60;
      const materialWindowKey = `${date}||${year}||${month}||${team}||${psr}||${brand}||${productName}||${material}`;
      const key = `${date}||${year}||${month}||${team}||${psr}||${brand}||${productName}||${material}||${slide}`;

      const currentWindow = materialWindows.get(materialWindowKey) || {
        timeOpenedAt: "",
        timeClosedAt: "",
      };
      if (row?.timeOpenedAt) {
        currentWindow.timeOpenedAt =
          currentWindow.timeOpenedAt && currentWindow.timeOpenedAt < row.timeOpenedAt
            ? currentWindow.timeOpenedAt
            : row.timeOpenedAt;
      }
      if (row?.timeClosedAt) {
        currentWindow.timeClosedAt =
          currentWindow.timeClosedAt && currentWindow.timeClosedAt > row.timeClosedAt
            ? currentWindow.timeClosedAt
            : row.timeClosedAt;
      }
      materialWindows.set(materialWindowKey, currentWindow);

      const materialUseKeys = materialUseKeysByMaterial.get(materialWindowKey) || new Set();
      materialUseKeys.add(materialUseKey);
      materialUseKeysByMaterial.set(materialWindowKey, materialUseKeys);

      const current = grouped.get(key) || {
        date,
        year,
        month,
        team,
        psr,
        brand,
        productName,
        material,
        slide,
        materialWindowKey,
        secondsViewed: 0,
      };
      current.secondsViewed += secondsViewed;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map(({ materialWindowKey, ...row }) => {
      const window = materialWindows.get(materialWindowKey) || {};
      const openedAt = window?.timeOpenedAt ? new Date(window.timeOpenedAt) : null;
      const closedAt = window?.timeClosedAt ? new Date(window.timeClosedAt) : null;
      const elapsedTimeSeconds =
        openedAt && closedAt && !Number.isNaN(openedAt.getTime()) && !Number.isNaN(closedAt.getTime())
          ? Math.max(0, Math.round((closedAt.getTime() - openedAt.getTime()) / 1000))
          : 0;

      return {
        ...row,
        detailingCount: materialUseKeysByMaterial.get(materialWindowKey)?.size || 0,
        secondsViewed: Math.round(row.secondsViewed),
        timeOpenedAt: window?.timeOpenedAt || "",
        timeClosedAt: window?.timeClosedAt || "",
        elapsedTimeSeconds,
      };
    });
  }, [slidesResult.data?.unifiedExportRows, slideRetentionRows, filters.year, filters.month]);
  const unifiedExportSections = useMemo(
    () => [
      {
        title: "Dashboard Report Export",
        columns: UNIFIED_EXPORT_COLUMNS,
        rows: unifiedExportRows.map((row) => ({
          date: toHumanReadableDate(row?.date, row?.month, row?.year),
          month: row?.month || "",
          team: row?.team || "",
          psr: row?.psr || "",
          brand: row?.brand || "",
          productName: row?.productName || row?.product || "",
          material: row?.material || toMaterialName({ attachment: row?.attachment, slide: row?.slide, brand: row?.brand }),
          slide: row?.slide || "",
          secondsViewed: Number(row?.secondsViewed || 0),
          timeOpened: toHumanReadableTime(row?.timeOpenedAt || row?.startedAt),
          timeClosed: toHumanReadableTime(row?.timeClosedAt || row?.endedAt),
        })),
      },
    ],
    [unifiedExportRows]
  );
  const unifiedExportCsvSections = useMemo(
    () => [
      {
        title: "Dashboard Report Export",
        columns: UNIFIED_EXPORT_COLUMNS,
        rows: unifiedExportRows.map((row) => ({
          date: toCsvDate(row?.date, row?.month, row?.year),
          month: row?.month || "",
          team: row?.team || "",
          psr: row?.psr || "",
          brand: row?.brand || "",
          productName: row?.productName || row?.product || "",
          material: row?.material || toMaterialName({ attachment: row?.attachment, slide: row?.slide, brand: row?.brand }),
          slide: row?.slide || "",
          secondsViewed: Number(row?.secondsViewed || 0),
          timeOpened: toCsvTime(row?.timeOpenedAt || row?.startedAt),
          timeClosed: toCsvTime(row?.timeClosedAt || row?.endedAt),
        })),
      },
    ],
    [unifiedExportRows]
  );
  const unifiedExportDisabled = slidesResult.isLoading || Boolean(slidesError) || unifiedExportRows.length === 0;
  const unifiedExportFilenameBase = buildFilenameBase(filters, "dashboard-report-data");

  return (
    <div className="max-w-full space-y-5 sm:space-y-8">
      <SectionTitle
        title="Reports Dashboard"
        subtitle="Live dashboard view derived from the current database activity and product records."
      />

      <div className="rounded-[1.05rem] bg-white/90 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:-mx-1 sm:rounded-[1.2rem] sm:px-1 sm:py-1 md:-mx-2 md:rounded-[1.4rem] md:px-2 md:py-2">
        <div className="grid gap-[1px] overflow-hidden rounded-[1.05rem] bg-white/25 md:grid-cols-3 xl:grid-cols-6 md:rounded-2xl">
          {FILTERS.map((filter) => (
            <FilterTile
              key={filter.key}
              filterKey={filter.key}
              label={filter.label}
              hint={filter.hint}
              value={filters[filter.key]}
              options={filterOptions[filter.key]}
              onChange={handleFilterChange}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3 sm:text-sm">
        Active sample context: <span className="font-semibold text-slate-800">{activeFilterText}</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600 sm:text-sm">
            Export data columns: Date, Month, Team, Representative, Brand, Product Name, Material, Slide, Seconds viewed, Time opened, Time closed.
          </div>
          <ExportButtons
            disabled={unifiedExportDisabled}
            filenameBase={unifiedExportFilenameBase}
            sections={unifiedExportSections}
            csvSections={unifiedExportCsvSections}
          />
        </div>
      </div>


      <div className="space-y-5 sm:space-y-6">
        <SectionDivider label="Brand Share" />

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Brand Share of Material Open Count" subtitle={countScopeLabel}>
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,220px)] lg:items-center">
              {overviewResult.isLoading ? (
                <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
              ) : (
                hasBrandShareData ? (
                  <>
                    <div className="h-[240px] sm:h-[320px]">
                      <Pie data={brandShareChart} options={buildPieOptions()} />
                    </div>
                    <PieLegend items={brandShareRows} selectedBrand={filters.brand} />
                  </>
                ) : (
                  <ChartEmpty />
                )
              )}
            </div>
          </ReportCard>

          <ReportCard title="Brand Share of Total Time Spent" subtitle={timeScopeLabel}>
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,220px)] lg:items-center">
              {overviewResult.isLoading ? (
                <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
              ) : (
                hasAppShareData ? (
                  <>
                    <div className="h-[240px] sm:h-[320px]">
                      <Pie data={appShareChart} options={buildPieOptions()} />
                    </div>
                    <PieLegend items={appShareRows} selectedBrand={filters.brand} />
                  </>
                ) : (
                  <ChartEmpty />
                )
              )}
            </div>
          </ReportCard>
        </div>

        <SectionDivider label="Team and Representative Rankings" />

        <div className="grid gap-4 sm:gap-6">
          <RankingTable
            title="Teams With the Highest Material Open Count by Brand"
            subtitle={rankingScopeLabel}
            rows={visibleTeamRankingRows}
            columns={teamRankingColumns}
            emptyMessage={overviewResult.isLoading ? LOADING_PLACEHOLDER_TEXT : overviewError || EMPTY_TABLE_MESSAGE}
          />

          <div className="grid gap-3">
            <RankingTable
              title="Representatives With the Highest Material Open Count by Brand"
              subtitle={rankingScopeLabel}
              rows={visibleRepRankingRows}
              columns={repRankingColumns}
              emptyMessage={overviewResult.isLoading ? LOADING_PLACEHOLDER_TEXT : overviewError || EMPTY_TABLE_MESSAGE}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <SectionDivider label="Material Summary" />

        <div>
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">All Materials</div>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Materials With the Highest Material Open Count" subtitle={generalCountPlainLabel}>
            {modulesResult.isLoading ? (
              <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
            ) : !hasGeneralCountData ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={generalCountChart} options={buildBarOptions({ yTitle: "Material Open Count" })} />
              </div>
            )}
          </ReportCard>

          <ReportCard title="Materials With the Most Time Spent" subtitle={generalTimePlainLabel}>
            {modulesResult.isLoading ? (
              <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
            ) : !hasGeneralTimeData ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={generalTimeChart} options={buildBarOptions({ yTitle: "Minutes" })} />
              </div>
            )}
          </ReportCard>
        </div>

        <div className="pt-2">
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">Brand Totals</div>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Use the filters to look at one brand, compare months, or see the total for the whole year.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Shows the Top Materials by Brand" subtitle={brandTotalPlainLabel}>
            {modulesResult.isLoading ? (
              <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
            ) : !hasBrandTotalData ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={brandTotalChart} options={buildBarOptions({ yTitle: "Material Open Count" })} />
              </div>
            )}
          </ReportCard>

          <ReportCard title="How Material Activity Changed Each Month" subtitle={movingMonthlyPlainLabel}>
            {modulesResult.isLoading ? (
              <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
            ) : !hasMovingMonthlyData ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar
                  data={movingMonthlyChart}
                  options={buildBarOptions({
                    yTitle: "Material Open Count",
                    legend: true,
                    legendPosition: "top",
                  })}
                />
              </div>
            )}
          </ReportCard>
        </div>

        <p className="text-xs text-slate-600 sm:text-sm">You can also see these totals by Division, Team, and Representative.</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <SectionDivider label="Material Activity by Team" />

        <div className={teamModulesHeadingClass}>
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">
            Shows the Top Materials by Team
          </div>
          {showDivisionPerTeamCard ? (
            <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">
              Shows the Top Materials by Division
            </div>
          ) : null}
        </div>

        <div className={teamModulesGridClass}>
          <ReportCard title="Materials With the Highest Material Open Count by Team" subtitle={teamScopeLabel}>
            {teamSectionResult.isLoading ? (
              <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
            ) : !hasAllPerTeamData ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar
                  data={allPerTeamChart}
                  options={buildBarOptions({ yTitle: "Material Open Count", legend: true, legendPosition: "bottom" })}
                />
              </div>
            )}
          </ReportCard>

          {showDivisionPerTeamCard ? (
            <ReportCard title="Materials With the Highest Material Open Count by Division" subtitle={divisionScopeLabel}>
              {teamSectionResult.isLoading ? (
                <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
              ) : !hasDivisionPerTeamData ? (
                <ChartEmpty />
              ) : (
                <div className="h-[220px] sm:h-[320px]">
                  <Bar
                    data={divisionPerTeamChart}
                    options={buildBarOptions({ yTitle: "Material Open Count", legend: true, legendPosition: "bottom" })}
                  />
                </div>
              )}
            </ReportCard>
          ) : null}
        </div>

      </div>

      <div className="space-y-3 sm:space-y-4">
        <SectionDivider label="Slide Viewing Time" />

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">Slide Viewing Time</div>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Shows how long representatives stayed on slides before moving to another one. Time is measured in total minutes viewed.
            </p>
          </div>
        </div>

        <ReportCard
          title="Products With the Most Slide Viewing Time"
          subtitle={slideBrandScopeLabel}
        >
          <div className="mb-4 flex justify-end">
            <InlineSelect
              label="Brand Filter"
              value={slideActivityBrand}
              options={slideRetentionBrandOptions}
              onChange={setSlideActivityBrand}
            />
          </div>

          {slidesResult.isLoading ? (
            <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
          ) : !hasSlideActivityBrandData ? (
            <ChartEmpty
              message={
                slideActivityBrand === "All Brands"
                  ? EMPTY_CHART_MESSAGE
                  : `No slide activity found for ${slideActivityBrand}.`
              }
            />
          ) : (
            <div className="h-[260px] sm:h-[340px]">
              <Bar data={slideActivityBrandChart} options={buildBarOptions({ yTitle: "Minutes Viewed" })} />
            </div>
          )}
        </ReportCard>

        <ReportCard
          title={slideDetailTitle}
          subtitle={slideDetailScopeLabel}
        >
          <div className="mb-4 flex justify-end">
            <InlineSelect
              label="Material Filter"
              value={slideActivityAttachment}
              options={slideRetentionAttachmentOptions}
              onChange={setSlideActivityAttachment}
            />
          </div>

          {slidesResult.isLoading ? (
            <ChartEmpty message={LOADING_PLACEHOLDER_TEXT} />
          ) : !hasSlideActivityAttachmentData ? (
            <ChartEmpty
              message={
                slideActivityAttachment === "All Attachments"
                  ? `No slide activity found for ${slideActivityProduct}.`
                  : `No slide activity found for ${slideActivityAttachment}.`
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 sm:text-sm">
                {slideDetailHelperText}
              </p>
              {isAttachmentDrilldown ? (
                <div className="h-[280px] sm:h-[340px]">
                  <Bar
                    key={`slide-attachment-${slideActivityAttachment}`}
                    data={slideActivityAttachmentChart}
                    options={buildSlideBarOptions({ yTitle: "Minutes Viewed" })}
                  />
                </div>
              ) : (
                <div style={{ height: slideActivitySummaryHeight }}>
                  <Bar
                    key="slide-attachment-summary"
                    data={slideActivityProductChart}
                    options={buildHorizontalBarOptions({ xTitle: "Minutes Viewed" })}
                  />
                </div>
              )}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
