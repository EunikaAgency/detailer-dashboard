"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS } from "@/lib/reportDivision";
import { areReportFiltersEqual, useReportSection } from "./reportClient";
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
  { key: "psr", label: "Representative" },
  { key: "brand", label: "Brand" },
];

const FILTER_OPTIONS = {
  year: [],
  month: [],
  division: REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS,
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

function buildHorizontalBarData(items, { color, datasetLabel, labelMaxLineLength = 24, useRankLabels = false }) {
  return {
    labels: items.map((item, index) => (useRankLabels ? `#${index + 1}` : toMultilineLabel(item.label, labelMaxLineLength))),
    datasets: [
      {
        label: datasetLabel,
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(color, 0.92),
        borderRadius: 8,
        maxBarThickness: 28,
        rawValues: items.map((item) => Number(item.rawValue || 0)),
        fullLabels: items.map((item) => item.fullLabel || item.label),
      },
    ],
  };
}

function buildHorizontalBarOptions({ xTitle, datasetLabel, valueSuffix = "", rawValueLabel = "material open count" }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title(context) {
            const firstItem = context?.[0];
            return firstItem?.dataset?.fullLabels?.[firstItem.dataIndex] || firstItem?.label || "";
          },
          label(context) {
            const value = Number(context.parsed.y || 0);
            const rawValue = context.dataset.rawValues?.[context.dataIndex];
            if (rawValue !== undefined && rawValue !== null && !Number.isNaN(Number(rawValue)) && Number(rawValue) > 0) {
              return `${datasetLabel}: ${value.toLocaleString()}${valueSuffix} (${Number(rawValue).toLocaleString()} ${rawValueLabel})`;
            }
            return `${datasetLabel}: ${value.toLocaleString()}${valueSuffix}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          autoSkip: false,
          color: "#475569",
          font: { size: 11 },
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#334155",
          font: { size: 11, weight: "600" },
        },
        title: {
          display: true,
          text: xTitle,
          color: "#64748b",
          font: { size: 12, weight: "600" },
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

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f4c5c]">{eyebrow}</div> : null}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
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

function getProductMaterialLegendContent(item) {
  const materialLabel = String(item?.label || "").trim();
  if (!materialLabel) {
    return {
      productLabel: "",
      materialLabel: "",
    };
  }

  if (/^rexulti\b/i.test(materialLabel)) {
    return {
      productLabel: "Rexulti",
      materialLabel,
    };
  }

  if (/^abilify maintena\b/i.test(materialLabel)) {
    return {
      productLabel: "Abilify Maintena",
      materialLabel,
    };
  }

  return {
    productLabel: materialLabel,
    materialLabel,
  };
}

function ChartItemLegend({ items, color, valueSuffix = "", variant = "default" }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => {
        const productMaterialContent = variant === "product-material" ? getProductMaterialLegendContent(item) : null;

        return (
        <div
          key={`${item.label}-${index}`}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"
        >
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">#{index + 1}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rgba(color, 0.92) }} />
          <span className="min-w-0 flex-1">
            {variant === "slide-detail" ? (
              <span className="flex min-w-0 flex-col leading-snug">
                <span className="break-words font-semibold text-slate-800" title={item.materialName || item.label}>
                  {item.materialName || item.label}
                </span>
                <span className="break-all font-medium text-slate-500" title={item.slideDetailLabel || item.slideFilename || item.label}>
                  {item.slideDetailLabel || item.slideFilename || item.label}
                </span>
              </span>
            ) : variant === "product-material" ? (
              <span className="flex min-w-0 flex-col leading-snug">
                <span
                  className="break-words font-semibold text-slate-800"
                  title={productMaterialContent?.productLabel || item.label}
                >
                  {productMaterialContent?.productLabel || item.label}
                </span>
                <span className="break-words font-medium text-slate-500" title={item.label}>
                  {productMaterialContent?.materialLabel || item.label}
                </span>
              </span>
            ) : (
              <span className="break-words font-medium leading-snug" title={item.label}>
                {item.label}
              </span>
            )}
          </span>
          <span className="shrink-0 font-semibold text-slate-900">
            {Number(item.value || 0).toLocaleString()}
            {valueSuffix}
          </span>
        </div>
        );
      })}
    </div>
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
  labelMaxLineLength = 24,
  useRankLabels = false,
  showItemLegend = false,
  legendVariant = "default",
}) {
  const hasData = Array.isArray(items) && items.length > 0;

  return (
    <ReportCard title={title} subtitle={subtitle} className={className}>
      {isLoading ? (
        <ChartLoading />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <>
          <div className={chartHeight}>
            <Bar
              data={buildHorizontalBarData(items, { color, datasetLabel, labelMaxLineLength, useRankLabels })}
              options={buildHorizontalBarOptions({ xTitle, datasetLabel, valueSuffix })}
            />
          </div>
          {showItemLegend ? (
            <ChartItemLegend items={items} color={color} valueSuffix={valueSuffix} variant={legendVariant} />
          ) : null}
        </>
      )}
    </ReportCard>
  );
}

export default function ReportsUtilizationSection({
  filters: controlledFilters,
  onFiltersChange,
  hideHeader = false,
  hideFilters = false,
} = {}) {
  const [localFilters, setLocalFilters] = useState(EMPTY_REPORT.filters.selected);
  const filters = controlledFilters || localFilters;
  const setSelectedFilters = onFiltersChange || setLocalFilters;

  const filtersResult = useReportSection({
    endpoint: "/api/reports/dashboard-v2",
    filters,
    section: "filters",
    fallbackData: { filters: EMPTY_REPORT.filters },
  });
  const nationalResult = useReportSection({
    endpoint: "/api/reports/dashboard-v2",
    filters,
    section: "national",
    fallbackData: { filters: EMPTY_REPORT.filters, nationalUtilization: EMPTY_REPORT.nationalUtilization },
  });
  const teamResult = useReportSection({
    endpoint: "/api/reports/dashboard-v2",
    filters,
    section: "team",
    fallbackData: { filters: EMPTY_REPORT.filters, teamUtilization: EMPTY_REPORT.teamUtilization },
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
    brand: filtersResult.data?.filters?.brandOptions?.length ? filtersResult.data.filters.brandOptions : FILTER_OPTIONS.brand,
  };

  const tdShareOfVoice = nationalResult.data?.nationalUtilization?.tdShareOfVoice || [];
  const cnsShareOfVoice = nationalResult.data?.nationalUtilization?.cnsShareOfVoice || [];
  const perTeam = teamResult.data?.teamUtilization?.perTeam || [];
  const perPsr = teamResult.data?.teamUtilization?.perPsr || [];
  const perProduct = teamResult.data?.teamUtilization?.perProduct || [];
  const perSlide = teamResult.data?.teamUtilization?.perSlide || [];
  const averageTimePerSlide = teamResult.data?.teamUtilization?.averageTimePerSlide || [];

  return (
    <div className="space-y-6 pb-6">
      {!hideHeader ? (
        <div className="rounded-[2rem] border border-[#0f4c5c]/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,247,237,0.95),_rgba(255,255,255,1)_38%,_rgba(240,253,250,0.95)_100%)] px-4 py-5 shadow-sm sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c]">Dashboard Reports</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Reports</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
                Monthly report charts for Material Open Count, product share, and slide viewing time.
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
      ) : null}

      {!hideFilters ? (
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
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <MetricChartCard
            title="TD Product Share of Material Open Count"
            subtitle="Shows the percent share of Material Open Count for Meptin, Mucosta, Pletaal, Aminoleban Oral, Samsca, and Jinarc."
            items={tdShareOfVoice}
            color={CHART_COLORS.td}
            datasetLabel="Percent Share"
            xTitle="Percent Share"
            valueSuffix="%"
            isLoading={nationalResult.isLoading}
            useRankLabels
            showItemLegend
          />
          <MetricChartCard
            title="CNS Product Share by Interactions"
            subtitle="Shows the percent share of recorded interactions for each Abilify Maintena and Rexulti material."
            items={cnsShareOfVoice}
            color={CHART_COLORS.cns}
            datasetLabel="Percent Share"
            xTitle="Percent Share"
            valueSuffix="%"
            isLoading={nationalResult.isLoading}
            useRankLabels
            showItemLegend
            legendVariant="product-material"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4">
          <MetricChartCard
            title="Teams With the Highest Material Open Count"
            subtitle="Shows the top 20 teams based on Material Open Count for the selected month."
            items={perTeam}
            color={CHART_COLORS.team}
            datasetLabel="Material Open Count"
            xTitle="Material Open Count"
            isLoading={teamResult.isLoading}
            className="w-full"
            chartHeight="h-[420px]"
            useRankLabels
            showItemLegend
          />
          <MetricChartCard
            title="Representatives With the Highest Material Open Count"
            subtitle="Shows the top 20 representatives based on Material Open Count for the selected month."
            items={perPsr}
            color={CHART_COLORS.psr}
            datasetLabel="Material Open Count"
            xTitle="Material Open Count"
            isLoading={teamResult.isLoading}
            className="w-full"
            chartHeight="h-[420px]"
            useRankLabels
            showItemLegend
          />
          <MetricChartCard
            title="Products With the Highest Material Open Count"
            subtitle="Shows the top 20 products based on Material Open Count for the selected month."
            items={perProduct}
            color={CHART_COLORS.product}
            datasetLabel="Material Open Count"
            xTitle="Material Open Count"
            isLoading={teamResult.isLoading}
            className="w-full"
            chartHeight="h-[420px]"
            useRankLabels
            showItemLegend
          />
        </div>

        <SectionDivider label="Slide Viewing Time" />

        <div className="grid gap-4">
          <MetricChartCard
            title="Slides With the Most Total Viewing Time"
            subtitle="Shows the top 20 slides based on total minutes viewed. The legend shows the material name and exact slide number."
            items={perSlide}
            color={CHART_COLORS.slide}
            datasetLabel="Minutes Viewed"
            xTitle="Minutes Viewed"
            isLoading={teamResult.isLoading}
            className="w-full"
            chartHeight="h-[420px] xl:h-[500px]"
            useRankLabels
            showItemLegend
            legendVariant="slide-detail"
          />
          <MetricChartCard
            title="Slides With the Highest Average Viewing Time"
            subtitle="Shows the top 20 slides based on average minutes viewed per slide view. Average minutes = total minutes viewed divided by total slide views."
            items={averageTimePerSlide}
            color={CHART_COLORS.average}
            datasetLabel="Average Minutes Viewed"
            xTitle="Average Minutes Viewed"
            isLoading={teamResult.isLoading}
            className="w-full"
            chartHeight="h-[420px] xl:h-[500px]"
            useRankLabels
            showItemLegend
            legendVariant="slide-detail"
          />
        </div>
      </div>
    </div>
  );
}
