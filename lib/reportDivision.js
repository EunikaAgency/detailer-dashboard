export const REPORT_DIVISION_VALUES = ["Carry-All GMA", "Carry-All Prov", "CNS"];

export const UNASSIGNED_DIVISION_LABEL = "Unassigned Division";

export const REPORT_DIVISION_FILTER_OPTIONS = ["All", ...REPORT_DIVISION_VALUES, UNASSIGNED_DIVISION_LABEL];

export const normalizeReportDivision = (value) => {
  const normalized = String(value || "").trim();
  return REPORT_DIVISION_VALUES.includes(normalized) ? normalized : "";
};

export const getReportDivisionLabel = (value, fallback = UNASSIGNED_DIVISION_LABEL) =>
  normalizeReportDivision(value) || fallback;
