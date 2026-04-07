"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
  { key: "psr", label: "PSR", hint: "" },
  { key: "brand", label: "Brand", hint: "" },
];

const FILTER_OPTIONS = {
  year: [],
  month: [],
  division: ["All"],
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
  meta: {
    totalSessionsInYear: 0,
    totalInteractionsInMonth: 0,
  },
};

const TEAM_TABLE_COLUMNS = [
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
  { key: "rank", label: "Rank", align: "right" },
  { key: "division", label: "Division" },
  { key: "team", label: "Team" },
  { key: "brand", label: "Brand" },
  { key: "detailingCount", label: "Detailing Count", align: "right", format: (value) => value.toLocaleString() },
];

const REP_TABLE_COLUMNS = [
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
  { key: "rank", label: "Rank", align: "right" },
  { key: "division", label: "Division" },
  { key: "team", label: "Team" },
  { key: "psr", label: "Rep" },
  { key: "brand", label: "Brand" },
  { key: "detailingCount", label: "Detailing Count", align: "right", format: (value) => value.toLocaleString() },
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

function ChartLoading() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-gray-500">
      {LOADING_PLACEHOLDER_TEXT}
    </div>
  );
}

function ChartEmpty({ message = LOADING_PLACEHOLDER_TEXT }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
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

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-[1.65rem] font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
    </div>
  );
}

function ReportCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-4">
          <h3 className="text-[0.92rem] font-semibold text-slate-900 sm:text-[1.05rem]">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PieLegend({ items, selectedBrand }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
                <tr key={`${row.year}-${row.month}-${row.division}-${row.team}-${row.brand}-${row.rank}`} className="odd:bg-white even:bg-slate-50/70">
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
        label: options.datasetLabel || "Utilization",
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(options.color || SERIES_COLORS[0], 0.95),
        borderRadius: 4,
        maxBarThickness: options.maxBarThickness || 36,
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
  yTitle = "Utilization",
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

export default function ReportsPage() {
  const [filters, setFilters] = useState(EMPTY_REPORT.filters.selected);
  const [reportData, setReportData] = useState(EMPTY_REPORT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadReport = async () => {
      setIsLoading(true);
      setError("");

      try {
        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) searchParams.set(key, value);
        });

        const response = await fetch(`/api/reports/dashboard?${searchParams.toString()}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load dashboard reports.");
        }

        setReportData({ ...EMPTY_REPORT, ...payload });

        const nextSelected = payload?.filters?.selected || EMPTY_REPORT.filters.selected;
        setFilters((current) => {
          const isSame =
            current.year === nextSelected.year &&
            current.month === nextSelected.month &&
            current.division === nextSelected.division &&
            current.team === nextSelected.team &&
            current.psr === nextSelected.psr &&
            current.brand === nextSelected.brand;

          return isSame ? current : nextSelected;
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error("Failed to load dashboard reports:", loadError);
        setReportData(EMPTY_REPORT);
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard reports.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadReport();
    return () => controller.abort();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const filterOptions = {
    year: reportData?.filters?.yearOptions?.length ? reportData.filters.yearOptions : FILTER_OPTIONS.year,
    month: reportData?.filters?.monthOptions?.length ? reportData.filters.monthOptions : FILTER_OPTIONS.month,
    division: reportData?.filters?.divisionOptions?.length ? reportData.filters.divisionOptions : FILTER_OPTIONS.division,
    team: reportData?.filters?.teamOptions?.length ? reportData.filters.teamOptions : FILTER_OPTIONS.team,
    psr: reportData?.filters?.psrOptions?.length ? reportData.filters.psrOptions : FILTER_OPTIONS.psr,
    brand: reportData?.filters?.brandOptions?.length ? reportData.filters.brandOptions : FILTER_OPTIONS.brand,
  };

  const teamRankingRows = reportData.teamRankings;
  const repRankingRows = reportData.repRankings;

  const brandShareRows = reportData.shareOfVoiceBrand;
  const appShareRows = reportData.shareOfVoiceApp;
  const generalCountRows = reportData.generalCountModules;
  const generalTimeRows = reportData.generalTimeModules;
  const brandTotalRows = reportData.brandTotalModules;
  const specialtyCharts = reportData.specialtyCharts;

  const brandShareChart = useMemo(() => buildPieData(brandShareRows, filters.brand), [brandShareRows, filters.brand]);
  const appShareChart = useMemo(() => buildPieData(appShareRows, filters.brand), [appShareRows, filters.brand]);
  const generalCountChart = useMemo(() => buildSingleBarData(generalCountRows), [generalCountRows]);
  const generalTimeChart = useMemo(() => buildSingleBarData(generalTimeRows), [generalTimeRows]);
  const brandTotalChart = useMemo(() => buildSingleBarData(brandTotalRows), [brandTotalRows]);
  const movingMonthlyChart = useMemo(() => buildMonthGroupedData(reportData?.movingMonthly), [reportData?.movingMonthly]);
  const allPerTeamChart = useMemo(() => buildTeamGroupedData(reportData?.allPerTeam), [reportData?.allPerTeam]);
  const divisionPerTeamChart = useMemo(() => buildTeamGroupedData(reportData?.divisionPerTeam), [reportData?.divisionPerTeam]);

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
  const brandTotalScopeLabel = isAllMonths
    ? `Based on selected year total: ${yearlyScopeLabel}.`
    : `Based on selected month total: ${periodScopeLabel}.`;
  const rankingScopeLabel = `Based on detailing count for ${periodScopeLabel}.`;
  const countScopeLabel = `Based on interaction count for ${periodScopeLabel}.`;
  const timeScopeLabel = `Based on time spent for ${periodScopeLabel}.`;
  const movingMonthlyScopeLabel = `Monthly totals within ${yearlyScopeLabel}.`;
  const teamScopeLabel = `Grouped by team for ${periodScopeLabel}.`;
  const divisionScopeLabel = `Grouped by division and team for ${periodScopeLabel}.`;
  const specialtyScopeLabel = `Top module totals for ${periodScopeLabel}.`;

  const activeFilterText = `${filters.year} / ${filters.month} / ${filters.division} / ${filters.team} / ${filters.psr} / ${filters.brand}`;
  const visibleTeamRankingRows = isLoading ? [] : teamRankingRows;
  const visibleRepRankingRows = isLoading ? [] : repRankingRows;
  const showBrandShareLoading = isLoading || brandShareRows.length === 0;
  const showAppShareLoading = isLoading || appShareRows.length === 0;
  const showGeneralCountLoading = isLoading || generalCountRows.length === 0;
  const showGeneralTimeLoading = isLoading || generalTimeRows.length === 0;
  const showBrandTotalLoading = isLoading || brandTotalRows.length === 0;
  const showMovingMonthlyLoading = isLoading || !reportData?.movingMonthly?.rows?.length;
  const showAllPerTeamLoading = isLoading || !reportData?.allPerTeam?.labels?.length;
  const showDivisionPerTeamLoading = isLoading || !reportData?.divisionPerTeam?.labels?.length;
  const showSpecialtyLoading = isLoading || specialtyCharts.length === 0;

  return (
    <div className="max-w-full space-y-5 sm:space-y-8">
      <SectionTitle
        title="One Marketing App"
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

      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 shadow-sm sm:px-4 sm:py-3 sm:text-sm">
        {isLoading ? (
          <span>Loading dashboard metrics from the database...</span>
        ) : error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span>
            {reportData?.meta?.totalInteractionsInMonth || 0} tracked interactions for{" "}
            <span className="font-semibold text-slate-800">{filters.month || "selected month"}</span> across{" "}
            <span className="font-semibold text-slate-800">{reportData?.meta?.totalSessionsInYear || 0}</span> session
            {(reportData?.meta?.totalSessionsInYear || 0) === 1 ? "" : "s"} in {filters.year || "selected year"}.
          </span>
        )}
      </div>

      <div className="space-y-5 sm:space-y-6">
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Share of Voice (Brand)" subtitle={countScopeLabel}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),220px]">
              {showBrandShareLoading ? (
                <ChartEmpty />
              ) : (
                <>
                  <div className="h-[240px] sm:h-[320px]">
                    <Pie data={brandShareChart} options={buildPieOptions()} />
                  </div>
                  <PieLegend items={brandShareRows} selectedBrand={filters.brand} />
                </>
              )}
            </div>
          </ReportCard>

          <ReportCard title="Share of Voice (ONE App Detailer)" subtitle={timeScopeLabel}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),220px]">
              {showAppShareLoading ? (
                <ChartEmpty />
              ) : (
                <>
                  <div className="h-[240px] sm:h-[320px]">
                    <Pie data={appShareChart} options={buildPieOptions()} />
                  </div>
                  <PieLegend items={appShareRows} selectedBrand={filters.brand} />
                </>
              )}
            </div>
          </ReportCard>
        </div>

        <div className="grid gap-4 sm:gap-6">
          <RankingTable
            title="Ranking of Teams based on Brand Detailing Count / Utilization per Month"
            subtitle={rankingScopeLabel}
            rows={visibleTeamRankingRows}
            columns={TEAM_TABLE_COLUMNS}
            emptyMessage={LOADING_PLACEHOLDER_TEXT}
          />

          <div className="grid gap-3">
            <RankingTable
              title="Ranking of Reps based on Brand Detailing Count / Utilization per Month"
              subtitle={rankingScopeLabel}
              rows={visibleRepRankingRows}
              columns={REP_TABLE_COLUMNS}
              emptyMessage={LOADING_PLACEHOLDER_TEXT}
            />
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 shadow-sm sm:px-4 sm:py-3 sm:text-sm">
              <p>* Ranking can extend to show all teams from highest to lowest, then Top 10 or 20 reps.</p>
              <p>* This can also be connected to calls, type of MDs, and type of calls.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div>
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">General (All Products)</div>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Module Utilization (All) - Based on Count" subtitle={countScopeLabel}>
            {showGeneralCountLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={generalCountChart} options={buildBarOptions({ yTitle: "Utilization" })} />
              </div>
            )}
          </ReportCard>

          <ReportCard title="Module Utilization (All) - Based on Time Spent" subtitle={timeScopeLabel}>
            {showGeneralTimeLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={generalTimeChart} options={buildBarOptions({ yTitle: "Minutes" })} />
              </div>
            )}
          </ReportCard>
        </div>

        <div className="pt-2">
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">Per Brand (Total)</div>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Filter context can be used per brand module, highest per month, or year-to-date total.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Module Utilization by Brand Total" subtitle={brandTotalScopeLabel}>
            {showBrandTotalLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar data={brandTotalChart} options={buildBarOptions({ yTitle: "Utilization" })} />
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Moving Monthly per Module"
            subtitle={movingMonthlyScopeLabel}
          >
            {showMovingMonthlyLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar
                  data={movingMonthlyChart}
                  options={buildBarOptions({
                    yTitle: "No. of Modules Detailed",
                    legend: true,
                    legendPosition: "top",
                  })}
                />
              </div>
            )}
          </ReportCard>
        </div>

        <p className="text-xs text-slate-600 sm:text-sm">Module utilization can also be shown per Division, Team, and Rep.</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="grid gap-2 xl:grid-cols-2">
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">
            General (All Products Modules) per Team
          </div>
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">Per Product Modules / Div / Team</div>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <ReportCard title="Module Utilization (All) per Team" subtitle={teamScopeLabel}>
            {showAllPerTeamLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar
                  data={allPerTeamChart}
                  options={buildBarOptions({ yTitle: "", legend: true, legendPosition: "bottom" })}
                />
              </div>
            )}
          </ReportCard>

          <ReportCard title="Module Utilization per Division / Team" subtitle={divisionScopeLabel}>
            {showDivisionPerTeamLoading ? (
              <ChartEmpty />
            ) : (
              <div className="h-[220px] sm:h-[320px]">
                <Bar
                  data={divisionPerTeamChart}
                  options={buildBarOptions({ yTitle: "", legend: true, legendPosition: "bottom" })}
                />
              </div>
            )}
          </ReportCard>
        </div>

        <div>
          <div className="text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">
            Per Brand / Per Specialty
          </div>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Moving forward, this can also expand into MD type, class, time spent, and call-type breakdowns.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          {showSpecialtyLoading ? (
            <ReportCard title="Specialty Breakdown" subtitle={specialtyScopeLabel}>
              <ChartEmpty />
            </ReportCard>
          ) : (
            specialtyCharts.map((chart) => (
              <ReportCard key={chart.title} title={chart.title} subtitle={specialtyScopeLabel}>
                {chart.modules.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <div className="h-[220px] sm:h-[320px]">
                    <Bar data={buildSingleBarData(chart.modules)} options={buildBarOptions({ yTitle: "" })} />
                  </div>
                )}
              </ReportCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
