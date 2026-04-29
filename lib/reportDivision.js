export const OFFICE_DIVISION_LABEL = "Office";

const LEGACY_REPORT_DIVISION_ALIASES = {
  "Carry-All Prov": "Carry-All Province",
  CNS: "CNS Division",
  "House Accounts GMA": "Hospital Accounts GMA",
};

export const REPORT_DIVISION_VALUES = [
  OFFICE_DIVISION_LABEL,
  "CNS Division",
  "Key Accounts",
  "Carry-All GMA",
  "Carry-All Province",
  "Hospital Accounts GMA",
  "Clinical Nutrition",
  "Oncology",
  "Trade Accounts",
  "Sales",
  "Marketing",
  "Training",
];

export const REPORT_DIVISION_ACCEPTED_VALUES = [
  ...REPORT_DIVISION_VALUES,
  ...Object.keys(LEGACY_REPORT_DIVISION_ALIASES),
];

export const REPORT_DIVISION_FILTER_OPTIONS = ["All", ...REPORT_DIVISION_VALUES];
export const REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS = REPORT_DIVISION_FILTER_OPTIONS;

export const normalizeReportDivision = (value, fallback = OFFICE_DIVISION_LABEL) => {
  const normalized = String(value || "").trim();
  const canonicalValue = LEGACY_REPORT_DIVISION_ALIASES[normalized] || normalized;
  return REPORT_DIVISION_VALUES.includes(canonicalValue) ? canonicalValue : fallback;
};

export const getReportDivisionLabel = (value, fallback = OFFICE_DIVISION_LABEL) =>
  normalizeReportDivision(value, fallback);
