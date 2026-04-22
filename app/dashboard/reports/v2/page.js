"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { REPORT_DIVISION_FILTER_OPTIONS } from "@/lib/reportDivision";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => <ChartLoading />,
});

const FILTERS = [
  { key: "year", label: "Year" },
  { key: "month", label: "Month" },
  { key: "division", label: "Division" },
  { key: "team", label: "Team" },
  { key: "psr", label: "PSR" },
  { key: "brand", label: "Brand" },
];

const FILTER_OPTIONS = {
  year: [],
  month: [],
  division: REPORT_DIVISION_FILTER_OPTIONS,
  team: ["All"],
  psr: ["All"],
  brand: ["All"],
};

const CHART_COLORS = {
  td: "196, 85, 8",
  cns: "22, 101, 52",
  team: "14, 116, 144",
  psr: "2, 132, 199",
  product: "124, 58, 237",
  slide: "220, 38, 38",
  average: "5, 150, 105",
};

const LOADING_PLACEHOLDER_TEXT = "Loading...";
const EMPTY_CHART_MESSAGE = "No data available for the selected filters.";

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
  nationalUtilization: {
    tdShareOfVoice: [],
    cnsShareOfVoice: [],
  },
  teamUtilization: {
    perTeam: [],
    perPsr: [],
    perProduct: [],
    perSlide: [],
    averageTimePerSlide: [],
  },
  meta: {
    monthlyTotalInteractions: 0,
    monthlyTotalSlideViews: 0,
    monthlyTotalSlideMinutes: 0,
  },
};

function rgba(color, alpha) {
  return `rgba(${color}, ${alpha})`;
}

function toMultilineLabel(value, maxLineLength = 24) {
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

function buildHorizontalBarData(items, { color, datasetLabel }) {
  return {
    labels: items.map((item) => toMultilineLabel(item.label)),
    datasets: [
      {
        label: datasetLabel,
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(color, 0.92),
        borderRadius: 8,
        maxBarThickness: 24,
        rawValues: items.map((item) => Number(item.rawValue || 0)),
      },
    ],
  };
}

function buildHorizontalBarOptions({ xTitle, datasetLabel, valueSuffix = "" }) {
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
            const value = Number(context.parsed.x || 0);
            const rawValue = context.dataset.rawValues?.[context.dataIndex];
            if (rawValue) {
              return `${datasetLabel}: ${value.toLocaleString()}${valueSuffix} (${rawValue.toLocaleString()} interactions)`;
            }
            return `${datasetLabel}: ${value.toLocaleString()}${valueSuffix}`;
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
          display: true,
          text: xTitle,
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#334155",
          font: { size: 11, weight: "600" },
        },
      },
    },
  };
}

function ChartLoading() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center text-sm text-slate-500">
      {LOADING_PLACEHOLDER_TEXT}
    </div>
  );
}

function ChartEmpty({ message = EMPTY_CHART_MESSAGE }) {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

function FilterTile({ filterKey, label, value, options, onChange }) {
  return (
    <label className="flex min-h-[76px] flex-col justify-between rounded-2xl border border-[#0f4c5c]/20 bg-[#0f4c5c] px-3 py-2.5 text-white md:min-h-[84px] md:px-4 md:py-3">
      <div className="text-[1.15rem] font-semibold leading-none md:text-[1.3rem]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(filterKey, event.target.value)}
        className="mt-3 w-full rounded-md border border-white/30 bg-white/95 px-3 py-2 text-sm font-medium text-slate-800 outline-none"
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

function StatCard({ label, value, helper, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    warm: "border-amber-200 bg-amber-50",
    green: "border-emerald-200 bg-emerald-50",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone] || tones.neutral}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{Number(value || 0).toLocaleString()}</div>
      {helper ? <div className="mt-1 text-xs text-slate-600">{helper}</div> : null}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f4c5c]">{eyebrow}</div> : null}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function ReportCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricChartCard({
  title,
  subtitle,
  items,
  color,
  datasetLabel,
  xTitle,
  valueSuffix = "",
  isLoading,
  className = "",
  chartHeight = "h-[320px]",
}) {
  const hasData = Array.isArray(items) && items.length > 0;

  return (
    <ReportCard title={title} subtitle={subtitle} className={className}>
      {isLoading ? (
        <ChartLoading />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <div className={chartHeight}>
          <Bar
            data={buildHorizontalBarData(items, { color, datasetLabel })}
            options={buildHorizontalBarOptions({ xTitle, datasetLabel, valueSuffix })}
          />
        </div>
      )}
    </ReportCard>
  );
}

export default function ReportsPageV2() {
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

        const response = await fetch(`/api/reports/dashboard-v2?${searchParams.toString()}`, {
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

  const scopeDetail = useMemo(() => {
    const detailParts = [];
    if (filters.division && filters.division !== "All") detailParts.push(filters.division);
    if (filters.team && filters.team !== "All") detailParts.push(filters.team);
    if (filters.psr && filters.psr !== "All") detailParts.push(filters.psr);
    if (filters.brand && filters.brand !== "All") detailParts.push(filters.brand);
    return detailParts.length > 0 ? detailParts.join(" / ") : "All divisions, teams, PSRs, and brands";
  }, [filters.brand, filters.division, filters.psr, filters.team]);

  const monthlyScopeLabel = useMemo(() => {
    const monthLabel = filters.month === "All" ? "all months in scope" : `${filters.month} ${filters.year || ""}`.trim();
    return `Monthly dashboard view for ${monthLabel}. Filters: ${scopeDetail}.`;
  }, [filters.month, filters.year, scopeDetail]);

  const tdShareOfVoice = reportData?.nationalUtilization?.tdShareOfVoice || [];
  const cnsShareOfVoice = reportData?.nationalUtilization?.cnsShareOfVoice || [];
  const perTeam = reportData?.teamUtilization?.perTeam || [];
  const perPsr = reportData?.teamUtilization?.perPsr || [];
  const perProduct = reportData?.teamUtilization?.perProduct || [];
  const perSlide = reportData?.teamUtilization?.perSlide || [];
  const averageTimePerSlide = reportData?.teamUtilization?.averageTimePerSlide || [];

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-[2rem] border border-[#0f4c5c]/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,247,237,0.95),_rgba(255,255,255,1)_38%,_rgba(240,253,250,0.95)_100%)] px-4 py-5 shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c]">Dashboard Reports</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Reports</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              Monthly dashboard graphs for national utilization share of voice, then team, PSR, product, and slide
              utilization views.
            </p>
          </div>
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center justify-center rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-2 text-sm font-medium text-[#0f4c5c] transition hover:bg-slate-50"
          >
            Open current reports
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FILTERS.map((filter) => (
          <FilterTile
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            value={filters[filter.key]}
            options={filterOptions[filter.key] || []}
            onChange={handleFilterChange}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard
          label="Total National Utilization"
          value={reportData?.meta?.monthlyTotalInteractions || 0}
          helper="Monthly tracked interactions"
          tone="warm"
        />
        <StatCard
          label="Per Slide Views"
          value={reportData?.meta?.monthlyTotalSlideViews || 0}
          helper="Monthly slide view records"
        />
        <StatCard
          label="Slide Minutes"
          value={reportData?.meta?.monthlyTotalSlideMinutes || 0}
          helper="Monthly total minutes viewed"
          tone="green"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        {isLoading ? (
          <span>{LOADING_PLACEHOLDER_TEXT}</span>
        ) : error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span>{monthlyScopeLabel}</span>
        )}
      </div>

      <div className="space-y-4">
        <SectionHeader
          eyebrow="Monthly"
          title="Total National Utilization"
          subtitle="Share of voice per product for the TD and CNS product groups requested for the dashboard."
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <MetricChartCard
            title="TD Share of Voice per Product"
            subtitle="Pletaa, Mucosta, Meptin, and Aminoleban."
            items={tdShareOfVoice}
            color={CHART_COLORS.td}
            datasetLabel="Share of Voice"
            xTitle="Percent Share"
            valueSuffix="%"
            isLoading={isLoading}
          />
          <MetricChartCard
            title="CNS Share of Voice per Product"
            subtitle="Abilify, Maintena, and Rexulti."
            items={cnsShareOfVoice}
            color={CHART_COLORS.cns}
            datasetLabel="Share of Voice"
            xTitle="Percent Share"
            valueSuffix="%"
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader
          eyebrow="Monthly"
          title="Total Per Team Utilization"
          subtitle="Additional dashboard graphs for team, PSR, product, and slide activity."
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <MetricChartCard
            title="Per Team"
            subtitle="Top 20 teams by monthly utilization."
            items={perTeam}
            color={CHART_COLORS.team}
            datasetLabel="Utilization"
            xTitle="Total Interactions"
            isLoading={isLoading}
          />
          <MetricChartCard
            title="Per PSR"
            subtitle="Top 20 PSRs by monthly utilization."
            items={perPsr}
            color={CHART_COLORS.psr}
            datasetLabel="Utilization"
            xTitle="Total Interactions"
            isLoading={isLoading}
          />
          <MetricChartCard
            title="Per Product"
            subtitle="Top 20 products by monthly utilization."
            items={perProduct}
            color={CHART_COLORS.product}
            datasetLabel="Utilization"
            xTitle="Total Interactions"
            isLoading={isLoading}
          />
        </div>

        <div className="grid gap-4">
          <MetricChartCard
            title="Per Slide"
            subtitle="Top 20 slides by total minutes viewed."
            items={perSlide}
            color={CHART_COLORS.slide}
            datasetLabel="Minutes Viewed"
            xTitle="Minutes Viewed"
            isLoading={isLoading}
            className="w-full"
            chartHeight="h-[420px] xl:h-[500px]"
          />
          <MetricChartCard
            title="Average Time per Slide"
            subtitle="Top 20 slides by average minutes viewed per slide view."
            items={averageTimePerSlide}
            color={CHART_COLORS.average}
            datasetLabel="Average Minutes"
            xTitle="Average Minutes"
            isLoading={isLoading}
            className="w-full"
            chartHeight="h-[420px] xl:h-[500px]"
          />
        </div>
      </div>
    </div>
  );
}
