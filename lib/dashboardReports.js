import connectDB from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import Product from "@/models/Product";
import SlideRetention from "@/models/SlideRetention";
import User from "@/models/User";
import {
  REPORT_DIVISION_FILTER_OPTIONS,
  getReportDivisionLabel,
} from "@/lib/reportDivision";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const EMPTY_FILTER_VALUE = "All";
const normalizeText = (value) => String(value || "").trim();
const normalizeBrandKey = (value) => normalizeText(value).toLowerCase();
const isExcludedBrandFilterOption = (value) => {
  const key = normalizeBrandKey(value);
  if (!key) return false;
  if (key === "unknown brand") return true;
  // Hide staging/demo labels used for test content.
  return key.includes("test product") || key.includes("local test") || key.startsWith("demo product");
};

const uniqueSorted = (values) =>
  Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );

const sumValues = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

const incrementMap = (map, key, amount = 1) => {
  map.set(key, (map.get(key) || 0) + amount);
};

const buildPercentRows = (map, limit = 6) => {
  const rows = Array.from(map.entries())
    .map(([label, value]) => ({ label, value: Number(value || 0) }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit);

  const total = sumValues(rows.map((row) => row.value));
  if (!total) return [];

  return rows.map((row) => ({
    label: row.label,
    value: Math.max(1, Math.round((row.value / total) * 100)),
  }));
};

const cleanModuleLabel = (value) =>
  normalizeText(value)
    .replace(/^[0-9]+(?:-[0-9]+)+-/, "")
    .replace(/\.(pdf|ppt|pptx|html?)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeLookupKey = (value) =>
  cleanModuleLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getFilenameFromUrl = (value) => {
  const raw = normalizeText(value).split("#")[0].split("?")[0];
  if (!raw) return "";
  return raw.split("/").pop() || raw;
};

const getPageNumberFromFilename = (filename = "") => {
  const value = String(filename || "");
  const namedMatch = value.match(/(?:^|[._\-\s])(page|slide)[._\-\s]?(\d+)(?=\.[^.]+$|$)/i);
  if (namedMatch) {
    const parsed = Number.parseInt(namedMatch[2], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const trailingMatch = value.match(/(\d+)(?=\.[^.]+$|$)/);
  if (!trailingMatch) return null;
  const parsed = Number.parseInt(trailingMatch[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getMediaSortKey = (item) => {
  const titleFilename = getFilenameFromUrl(item?.title || "");
  const urlFilename = getFilenameFromUrl(item?.url || "");
  const thumbnailFilename = getFilenameFromUrl(item?.thumbnailUrl || "");

  return titleFilename || urlFilename || thumbnailFilename || normalizeText(item?.title) || normalizeText(item?.url);
};

const sortMediaItemsBySlideOrder = (left, right) => {
  const leftSortKey = getMediaSortKey(left);
  const rightSortKey = getMediaSortKey(right);
  const leftPage = getPageNumberFromFilename(leftSortKey);
  const rightPage = getPageNumberFromFilename(rightSortKey);

  if (leftPage !== null && rightPage !== null && leftPage !== rightPage) {
    return leftPage - rightPage;
  }

  return String(leftSortKey).localeCompare(String(rightSortKey), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const getMediaExportName = (item) => {
  const urlFilename = getFilenameFromUrl(item?.url || "");
  if (urlFilename) return urlFilename;

  const titleFilename = getFilenameFromUrl(item?.title || "");
  if (titleFilename) return titleFilename;

  return normalizeText(item?.title);
};

const getRetentionMediaItems = (record, product) => {
  const media = Array.isArray(product?.media) ? product.media : [];
  if (!media.length) return [];

  const deckId = normalizeText(record?.deckId || record?.caseId);
  if (deckId) {
    const groupMatches = media.filter((item) => normalizeText(item?.groupId) === deckId);
    if (groupMatches.length) return groupMatches;
  }

  const deckKey = normalizeLookupKey(record?.deckTitle || record?.presentationTitle);
  if (deckKey) {
    const groupedMatches = media.filter((item) => {
      const candidates = [item?.groupTitle, item?.sourceName, item?.title, item?.groupId];
      return candidates.some((candidate) => {
        const candidateKey = normalizeLookupKey(candidate);
        return candidateKey && (candidateKey === deckKey || candidateKey.includes(deckKey) || deckKey.includes(candidateKey));
      });
    });
    if (groupedMatches.length) return groupedMatches;
  }

  return media;
};

const resolveRetentionSlideExportName = (record, product) => {
  const rawSlideTitle = normalizeText(record?.slideTitle);
  const slideNumber = Number.isFinite(Number(record?.slideNumber))
    ? Math.max(1, Math.round(Number(record.slideNumber)))
    : Math.max(1, Math.round(Number(record?.slideIndex || 0)) + 1);

  const mediaItems = getRetentionMediaItems(record, product);
  if (mediaItems.length) {
    const sortedItems = [...mediaItems].sort(sortMediaItemsBySlideOrder);
    const matchedItem = sortedItems[slideNumber - 1];
    const matchedName = getMediaExportName(matchedItem);
    if (matchedName) return matchedName;
  }

  return rawSlideTitle || `Slide ${slideNumber}`;
};

const getTeamLabel = (user) =>
  normalizeText(user?.role) || normalizeText(user?.accessType) || "Unassigned Team";

const getRepLabel = (user) => {
  const name = normalizeText(user?.name);
  const username = normalizeText(user?.username);
  const repId = normalizeText(user?.repId);

  if (name && username && name.toLowerCase() !== username.toLowerCase()) return `${name} / ${username}`;
  return name || username || repId || "Unknown Rep";
};

const getBrandLabel = (product, details) =>
  normalizeText(product?.brandName) ||
  normalizeText(details?.brandName) ||
  normalizeText(details?.productName) ||
  normalizeText(product?.name) ||
  "Unknown Brand";

const getDivisionLabel = (user) => getReportDivisionLabel(user?.division);

const getEventLookupCandidates = (event) => {
  const details = event?.details || {};
  return [
    details.productId,
    details.productName,
    details.brandName,
    event?.deckTitle,
    details.deckTitle,
    details.presentationTitle,
    details.caseName,
    details.caseId,
    details.deckId,
    details.sourceName,
    details.groupTitle,
    details.title,
  ];
};

const buildProductLookup = (products) => {
  const exact = new Map();
  const fuzzy = [];

  const addAlias = (product, value) => {
    const key = normalizeLookupKey(value);
    if (!key) return;

    if (!exact.has(key)) exact.set(key, product);
    if (key.length >= 5) {
      fuzzy.push({ key, product });
    }
  };

  products.forEach((product) => {
    addAlias(product, product?._id);
    addAlias(product, product?.name);
    addAlias(product, product?.brandName);
    addAlias(product, product?.category);

    (Array.isArray(product?.media) ? product.media : []).forEach((media) => {
      addAlias(product, media?.sourceName);
      addAlias(product, media?.groupTitle);
      addAlias(product, media?.title);
    });
  });

  fuzzy.sort((left, right) => right.key.length - left.key.length || left.key.localeCompare(right.key));

  return {
    exact,
    fuzzy,
  };
};

const findProductByLookup = (lookup, value) => {
  const key = normalizeLookupKey(value);
  if (!key) return null;

  const exactMatch = lookup.exact.get(key);
  if (exactMatch) return exactMatch;

  const fuzzyMatch = lookup.fuzzy.find((entry) => key.includes(entry.key) || entry.key.includes(key));
  return fuzzyMatch?.product || null;
};

const resolveEventProduct = (event, productById, productLookup) => {
  const details = event?.details || {};
  const directProductId = normalizeText(details.productId);
  if (directProductId) {
    const directProduct = productById.get(directProductId);
    if (directProduct) return directProduct;
  }

  for (const candidate of getEventLookupCandidates(event)) {
    const matchedProduct = findProductByLookup(productLookup, candidate);
    if (matchedProduct) return matchedProduct;
  }

  return null;
};

const getRetentionLookupCandidates = (record) => {
  const details = record?.details || {};
  return [
    record?.presentationId,
    record?.caseId,
    record?.deckId,
    record?.presentationTitle,
    record?.deckTitle,
    record?.slideTitle,
    details.productId,
    details.productName,
    details.brandName,
    details.deckTitle,
    details.presentationTitle,
    details.caseId,
    details.deckId,
  ];
};

const resolveRetentionProduct = (record, productById, productLookup) => {
  const directProductId = normalizeText(record?.presentationId);
  if (directProductId) {
    const directProduct = productById.get(directProductId);
    if (directProduct) return directProduct;
  }

  for (const candidate of getRetentionLookupCandidates(record)) {
    const matchedProduct = findProductByLookup(productLookup, candidate);
    if (matchedProduct) return matchedProduct;
  }

  return null;
};

const buildProductModuleFallback = (product, brand) => {
  const mediaNames = uniqueSorted((Array.isArray(product?.media) ? product.media : []).map((media) => cleanModuleLabel(media?.sourceName)));
  if (mediaNames.length === 1) return mediaNames[0];
  return brand;
};

const getModuleLabel = (event, product, brand) => {
  const details = event?.details || {};
  const candidates = [
    event?.deckTitle,
    details.deckTitle,
    details.presentationTitle,
    details.caseName,
    details.deckId,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanModuleLabel(candidate);
    if (cleaned) return cleaned;
  }

  return buildProductModuleFallback(product, brand);
};

const isMeaningfulEvent = (event) => {
  const action = normalizeText(event?.action).toLowerCase();
  const screen = normalizeText(event?.screen).toLowerCase();

  if (!action && !screen) return false;
  if (screen === "presentation") return true;
  if (screen === "presentation-viewer") return true;
  if (action === "product_opened") return true;
  return /(presentation|thumbnail|slide|deck|viewer|detailer|product_opened)/.test(action);
};

const buildMatchesFilter = (filters) => (record) => {
  if (filters.division !== EMPTY_FILTER_VALUE && record.division !== filters.division) return false;
  if (filters.team !== EMPTY_FILTER_VALUE && record.team !== filters.team) return false;
  if (filters.psr !== EMPTY_FILTER_VALUE && record.psr !== filters.psr) return false;
  if (filters.brand !== EMPTY_FILTER_VALUE && record.brand !== filters.brand) return false;
  return true;
};

const mapRowsWithRank = (rows) =>
  rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

const sortByValueDesc = (rows, key = "value") =>
  [...rows].sort((left, right) => Number(right?.[key] || 0) - Number(left?.[key] || 0) || String(left?.label || "").localeCompare(String(right?.label || "")));

const groupCountRows = (records, keyField, valueField = "count") => {
  const totals = new Map();
  records.forEach((record) => {
    const label = normalizeText(record?.[keyField]);
    if (!label) return;
    incrementMap(totals, label, Number(record?.[valueField] || 0));
  });

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
};

const buildTopModuleRows = (records, key = "count", limit = 9) => {
  const byModule = new Map();

  records.forEach((record) => {
    const moduleLabel = normalizeText(record?.module);
    if (!moduleLabel) return;
    const current = byModule.get(moduleLabel) || {
      label: moduleLabel,
      value: 0,
      brand: record?.brand || "Unknown Brand",
    };
    current.value += Number(record?.[key] || 0);
    if (!current.brand && record?.brand) current.brand = record.brand;
    byModule.set(moduleLabel, current);
  });

  return Array.from(byModule.values())
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map((row) => ({
      label: row.label,
      value: Math.round(row.value),
      brand: row.brand,
    }));
};

const buildSlideRetentionRows = (records) => {
  const bySlide = new Map();

  records.forEach((record) => {
    const slideKey = normalizeText(record?.slideKey);
    if (!slideKey) return;

    const current = bySlide.get(slideKey) || {
      year: record.year,
      month: record.month,
      team: record.team,
      psr: record.psr,
      label: record.slideLabel,
      attachment: record.attachment || record.slideLabel,
      slide: record.slide || record.slideLabel,
      exportName: record.slideExportName || record.slide || record.slideLabel,
      slideNumber: Number(record?.slideNumber || 0) || null,
      totalMinutes: 0,
      views: 0,
      brand: record.brand || "Unknown Brand",
      product: record.product || "Unknown Product",
    };

    current.totalMinutes += Number(record?.durationMinutes || 0);
    current.views += Number(record?.views || 0) || 1;

    bySlide.set(slideKey, current);
  });

  return Array.from(bySlide.values())
    .map((row) => ({
      year: row.year,
      month: row.month,
      team: row.team,
      psr: row.psr,
      ...row,
      totalMinutes: Number(row.totalMinutes.toFixed(2)),
      averageMinutes: Number((row.views > 0 ? row.totalMinutes / row.views : 0).toFixed(2)),
    }))
    .filter((row) => row.totalMinutes > 0)
    .sort((left, right) => right.totalMinutes - left.totalMinutes || left.label.localeCompare(right.label))
    .map((row) => ({
      year: row.year,
      month: row.month,
      team: row.team,
      psr: row.psr,
      label: row.label,
      attachment: row.attachment,
      slide: row.slide,
      exportName: row.exportName,
      slideNumber: row.slideNumber,
      brand: row.brand,
      product: row.product,
      totalMinutes: row.totalMinutes,
      averageMinutes: row.averageMinutes,
      views: row.views,
    }));
};

const buildUnifiedExportRows = (records) => {
  const byCompositeKey = new Map();

  records.forEach((record) => {
    const date = normalizeText(record?.date) || "-";
    const year = normalizeText(record?.year) || "-";
    const month = normalizeText(record?.month) || "-";
    const team = normalizeText(record?.team) || "Unassigned Team";
    const psr = normalizeText(record?.psr) || "Unknown Rep";
    const brand = normalizeText(record?.brand) || "Unknown Brand";
    const slide = normalizeText(record?.slideExportName || record?.slideTitle || record?.slideLabel || record?.slide || `Slide ${Number(record?.slideNumber || 0) || 1}`);
    const detailingCount = Math.max(1, Number(record?.views || 1));
    const secondsViewed = Number(record?.durationMinutes || 0) * 60;
    const compositeKey = [date, year, month, team, psr, brand, slide].join("||");

    const current = byCompositeKey.get(compositeKey) || {
      date,
      year,
      month,
      team,
      psr,
      brand,
      slide,
      detailingCount: 0,
      secondsViewed: 0,
    };

    current.detailingCount += detailingCount;
    current.secondsViewed += secondsViewed;
    byCompositeKey.set(compositeKey, current);
  });

  return Array.from(byCompositeKey.values())
    .map((row) => ({
      ...row,
      detailingCount: Math.round(row.detailingCount),
      secondsViewed: Math.round(row.secondsViewed),
    }))
    .sort(
      (left, right) =>
        String(left.date).localeCompare(String(right.date)) ||
        String(left.month).localeCompare(String(right.month)) ||
        String(left.team).localeCompare(String(right.team)) ||
        String(left.psr).localeCompare(String(right.psr)) ||
        String(left.brand).localeCompare(String(right.brand)) ||
        String(left.slide).localeCompare(String(right.slide))
    );
};

const buildMovingMonthlyModules = (records, limit = 6) => {
  const monthIndices = uniqueSorted(records.map((record) => String(record.monthIndex)))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right);

  const topModules = buildTopModuleRows(records, "count", limit).map((row) => row.label);
  return {
    monthKeys: monthIndices.map((index) => MONTH_KEYS[index] || `M${index + 1}`),
    rows: topModules.map((moduleLabel) => {
      const moduleRecords = records.filter((record) => record.module === moduleLabel);
      const brand = moduleRecords[0]?.brand || "Unknown Brand";
      const values = Object.fromEntries(
        monthIndices.map((monthIndex) => {
          const monthKey = MONTH_KEYS[monthIndex] || `M${monthIndex + 1}`;
          const total = sumValues(
            moduleRecords
              .filter((record) => record.monthIndex === monthIndex)
              .map((record) => record.count)
          );
          return [monthKey, Math.round(total)];
        })
      );

      return {
        label: moduleLabel,
        brand,
        values,
      };
    }),
  };
};

const buildSeriesChart = (records, labelLimit = 7, seriesField = "team", seriesLimit = 6) => {
  const topLabels = buildTopModuleRows(records, "count", labelLimit).map((row) => row.label);
  const topSeries = groupCountRows(records, seriesField, "count")
    .slice(0, seriesLimit)
    .map((row) => row.label);

  return {
    labels: topLabels,
    series: topSeries.map((seriesLabel) => ({
      label: seriesLabel,
      values: topLabels.map((moduleLabel) =>
        Math.round(
          sumValues(
            records
              .filter((record) => record.module === moduleLabel && record[seriesField] === seriesLabel)
              .map((record) => record.count)
          )
        )
      ),
    })),
  };
};

const buildSpecialtyCharts = (records) => {
  const toGenericKey = (value) => normalizeText(value).toLowerCase();
  const genericLabels = new Set(["uncategorized", "unknown brand", "-", "all divisions", "all brands"]);
  const toCharts = (field) =>
    groupCountRows(records, field, "count").map((row) => ({
      title: row.label,
      sourceField: field,
      modules: buildTopModuleRows(
        records.filter((record) => record[field] === row.label),
        "count",
        7
      ),
    }));

  const preferredDivisionCharts = toCharts("division").filter(
    (chart) => !genericLabels.has(toGenericKey(chart.title))
  );
  const genericDivisionCharts = toCharts("division").filter((chart) =>
    genericLabels.has(toGenericKey(chart.title))
  );
  const preferredBrandCharts = toCharts("brand").filter(
    (chart) => !genericLabels.has(toGenericKey(chart.title))
  );
  const genericBrandCharts = toCharts("brand").filter((chart) =>
    genericLabels.has(toGenericKey(chart.title))
  );

  const result = [];
  const seenTitles = new Set();

  const appendCharts = (charts) => {
    charts.forEach((chart) => {
      if (result.length >= 2) return;
      const dedupeKey = `${chart.sourceField}:${chart.title}`;
      if (seenTitles.has(dedupeKey)) return;
      if (!Array.isArray(chart.modules) || chart.modules.length === 0) return;
      seenTitles.add(dedupeKey);
      result.push(chart);
    });
  };

  appendCharts(preferredDivisionCharts);
  appendCharts(preferredBrandCharts);
  appendCharts(genericDivisionCharts);
  appendCharts(genericBrandCharts);

  return result.slice(0, 2).map(({ sourceField, ...chart }) => chart);
};

const buildRankingRows = (records, groupKeys, limit = 10) => {
  const totals = new Map();

  records.forEach((record) => {
    const compositeKey = groupKeys.map((key) => normalizeText(record?.[key]) || "-").join("||");
    const current = totals.get(compositeKey) || Object.fromEntries(groupKeys.map((key) => [key, record?.[key] || "-"]));
    current.detailingCount = (current.detailingCount || 0) + Number(record?.count || 0);
    totals.set(compositeKey, current);
  });

  return Array.from(totals.values())
    .filter((row) => Number(row.detailingCount || 0) > 0)
    .sort(
      (left, right) =>
        Number(right.detailingCount || 0) - Number(left.detailingCount || 0) ||
        String(left[groupKeys[0]] || "").localeCompare(String(right[groupKeys[0]] || ""))
    )
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
};

const toMonthValue = (month) => {
  const monthIndex = MONTH_NAMES.findIndex((entry) => entry.toLowerCase() === normalizeText(month).toLowerCase());
  return monthIndex >= 0 ? monthIndex : null;
};

const normalizeFilterValue = (value, options, fallback) => {
  const normalized = normalizeText(value);
  if (normalized && options.includes(normalized)) return normalized;
  return fallback;
};

export async function getDashboardReport(inputFilters = {}) {
  await connectDB();

  const [products, users, yearRows, retentionYearRows] = await Promise.all([
    Product.find({}).select("name brandName category media.url media.groupId media.sourceName media.groupTitle media.title").lean(),
    User.find({}).select("name username repId role division accessType").lean(),
    ActivityLog.aggregate([
      {
        $group: {
          _id: {
            $year: "$startedAt",
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    SlideRetention.aggregate([
      {
        $group: {
          _id: {
            $year: "$endedAt",
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const productLookup = buildProductLookup(products);
  const userById = new Map(users.map((user) => [String(user._id), user]));

  const availableYearOptions = uniqueSorted(
    [...yearRows, ...retentionYearRows].map((row) => String(row?._id || ""))
  );
  const yearOptions = [EMPTY_FILTER_VALUE, ...availableYearOptions];
  const fallbackYear = availableYearOptions[availableYearOptions.length - 1] || EMPTY_FILTER_VALUE;
  const selectedYear = normalizeFilterValue(inputFilters.year, yearOptions, fallbackYear);

  const logMatch = {};
  if (selectedYear !== EMPTY_FILTER_VALUE) {
    const yearStart = new Date(Date.UTC(Number(selectedYear), 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(Number(selectedYear) + 1, 0, 1, 0, 0, 0, 0));
    logMatch.startedAt = { $gte: yearStart, $lt: yearEnd };
  }

  const retentionMatch = {};
  if (selectedYear !== EMPTY_FILTER_VALUE) {
    const yearStart = new Date(Date.UTC(Number(selectedYear), 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(Number(selectedYear) + 1, 0, 1, 0, 0, 0, 0));
    retentionMatch.endedAt = { $gte: yearStart, $lt: yearEnd };
  }

  const [logs, slideRetentionRows] = await Promise.all([
    ActivityLog.find(logMatch)
      .select("userId sessionId startedAt endedAt lastOccurredAt events.action events.screen events.deckTitle events.details events.occurredAt")
      .lean(),
    SlideRetention.find(retentionMatch)
      .select("userId presentationId caseId deckId presentationTitle deckTitle slideId slideIndex slideNumber slideTitle slideType endedAt durationMs durationMinutes details")
      .lean(),
  ]);

  const monthIndicesWithData = uniqueSorted(
    [
      ...logs.map((log) => {
        const startedAt = new Date(log?.startedAt || 0);
        return Number.isNaN(startedAt.getTime()) ? "" : String(startedAt.getUTCMonth());
      }),
      ...slideRetentionRows.map((row) => {
        const endedAt = new Date(row?.endedAt || 0);
        return Number.isNaN(endedAt.getTime()) ? "" : String(endedAt.getUTCMonth());
      }),
    ]
  )
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right);

  const availableMonthOptions = monthIndicesWithData.map((index) => MONTH_NAMES[index]).filter(Boolean);
  const monthOptions = [EMPTY_FILTER_VALUE, ...availableMonthOptions];
  const fallbackMonth = availableMonthOptions[availableMonthOptions.length - 1] || EMPTY_FILTER_VALUE;
  const selectedMonth = normalizeFilterValue(inputFilters.month, monthOptions, fallbackMonth);
  const selectedMonthIndex = toMonthValue(selectedMonth);

  const yearEventRecords = [];
  const yearModuleTimeRecords = [];
  const yearBrandTimeRecords = [];
  const yearSlideRetentionRecords = [];

  logs.forEach((log) => {
    const startedAt = new Date(log?.startedAt || 0);
    if (Number.isNaN(startedAt.getTime())) return;

    const user = userById.get(String(log?.userId || ""));
    const team = getTeamLabel(user);
    const psr = getRepLabel(user);
    const sessionId = normalizeText(log?.sessionId) || String(log?._id || "");
    const sessionDurationSeconds = Math.max(
      30,
      Math.round(
        Math.max(
          0,
          (new Date(log?.endedAt || log?.lastOccurredAt || log?.startedAt || 0).getTime() - startedAt.getTime()) / 1000
        )
      )
    );

    const sessionBrandDurations = new Map();
    const sessionModuleDurations = new Map();

    const rawEvents = Array.isArray(log?.events) ? log.events : [];
    const resolvedProducts = rawEvents.map((event) => resolveEventProduct(event, productById, productLookup));
    const nextResolvedProducts = new Array(rawEvents.length).fill(null);
    let nextResolvedProduct = null;

    for (let index = rawEvents.length - 1; index >= 0; index -= 1) {
      if (resolvedProducts[index]) nextResolvedProduct = resolvedProducts[index];
      nextResolvedProducts[index] = nextResolvedProduct;
    }

    let lastResolvedProduct = null;
    rawEvents.forEach((event, eventIndex) => {
      if (!isMeaningfulEvent(event)) return;

      const occurredAt = new Date(event?.occurredAt || startedAt);
      if (Number.isNaN(occurredAt.getTime())) return;

      const details = event?.details || {};
      const product = resolvedProducts[eventIndex] || lastResolvedProduct || nextResolvedProducts[eventIndex] || null;
      if (product) lastResolvedProduct = product;
      const brand = getBrandLabel(product, details);
      const division = getDivisionLabel(user);
      const moduleLabel = getModuleLabel(event, product, brand);

      const record = {
        year: String(occurredAt.getUTCFullYear()),
        month: MONTH_NAMES[occurredAt.getUTCMonth()],
        monthIndex: occurredAt.getUTCMonth(),
        division,
        team,
        psr,
        brand,
        module: moduleLabel,
        sessionId,
        count: 1,
      };

      yearEventRecords.push(record);

      const brandDuration = sessionBrandDurations.get(brand) || {
        year: record.year,
        month: record.month,
        monthIndex: record.monthIndex,
        division,
        team,
        psr,
        brand,
        durationSeconds: 0,
      };
      brandDuration.durationSeconds += 1;
      sessionBrandDurations.set(brand, brandDuration);

      const moduleDurationKey = `${brand}__${moduleLabel}`;
      const moduleDuration = sessionModuleDurations.get(moduleDurationKey) || {
        year: record.year,
        month: record.month,
        monthIndex: record.monthIndex,
        division,
        team,
        psr,
        brand,
        module: moduleLabel,
        durationSeconds: 0,
      };
      moduleDuration.durationSeconds += 1;
      sessionModuleDurations.set(moduleDurationKey, moduleDuration);
    });

    const brandEntries = Array.from(sessionBrandDurations.values());
    if (brandEntries.length > 0) {
      const perBrandSeconds = Math.max(30, Math.round(sessionDurationSeconds / brandEntries.length));
      brandEntries.forEach((entry) => {
        yearBrandTimeRecords.push({
          ...entry,
          durationSeconds: perBrandSeconds,
        });
      });
    }

    const moduleEntries = Array.from(sessionModuleDurations.values());
    if (moduleEntries.length > 0) {
      const perModuleSeconds = Math.max(30, Math.round(sessionDurationSeconds / moduleEntries.length));
      moduleEntries.forEach((entry) => {
        yearModuleTimeRecords.push({
          ...entry,
          durationSeconds: perModuleSeconds,
        });
      });
    }
  });

  slideRetentionRows.forEach((row) => {
    const endedAt = new Date(row?.endedAt || 0);
    if (Number.isNaN(endedAt.getTime())) return;

    const user = userById.get(String(row?.userId || ""));
    const product = resolveRetentionProduct(row, productById, productLookup);
    const details = row?.details || {};
    const brand = getBrandLabel(product, details);
    const division = getDivisionLabel(user);
    const deckTitle = cleanModuleLabel(row?.deckTitle || row?.presentationTitle || "");
    const attachmentLabel = deckTitle || cleanModuleLabel(product?.name || row?.presentationTitle || "Untitled Attachment");
    const slideNumber = Number.isFinite(Number(row?.slideNumber))
      ? Math.max(1, Math.round(Number(row.slideNumber)))
      : Math.max(1, Math.round(Number(row?.slideIndex || 0)) + 1);
    const rawSlideTitle = cleanModuleLabel(row?.slideTitle || "");
    const slideLabel =
      rawSlideTitle && rawSlideTitle.toLowerCase() !== attachmentLabel.toLowerCase()
        ? rawSlideTitle
        : `Slide ${slideNumber}`;
    const slideExportName = resolveRetentionSlideExportName(row, product);

    yearSlideRetentionRecords.push({
      date: endedAt.toISOString().slice(0, 10),
      year: String(endedAt.getUTCFullYear()),
      month: MONTH_NAMES[endedAt.getUTCMonth()],
      monthIndex: endedAt.getUTCMonth(),
      division,
      team: getTeamLabel(user),
      psr: getRepLabel(user),
      brand,
      product: normalizeText(product?.name) || normalizeText(row?.presentationTitle) || "Unknown Product",
      attachment: attachmentLabel,
      slide: slideLabel,
      slideExportName,
      slideNumber,
      // Group retention by product + attachment + slide number so mixed IDs still aggregate into one slide bar.
      slideKey:
        `${normalizeText(product?.name) || normalizeText(row?.presentationTitle) || "Unknown Product"}::${attachmentLabel}::${slideNumber}` ||
        normalizeText(row?.slideId) ||
        `${normalizeText(row?.deckId) || attachmentLabel}::${slideNumber}::${slideLabel}` ||
        "attachment",
      slideLabel,
      durationMinutes: Number(row?.durationMinutes || Number(row?.durationMs || 0) / 60000 || 0),
      views: 1,
    });
  });

  const divisionOptions = REPORT_DIVISION_FILTER_OPTIONS;
  const teamOptions = [
    EMPTY_FILTER_VALUE,
    ...uniqueSorted([...yearEventRecords, ...yearSlideRetentionRecords].map((record) => record.team)),
  ];
  const psrOptions = [
    EMPTY_FILTER_VALUE,
    ...uniqueSorted([...yearEventRecords, ...yearSlideRetentionRecords].map((record) => record.psr)),
  ];
  const brandOptions = [
    EMPTY_FILTER_VALUE,
    ...uniqueSorted([...yearEventRecords, ...yearSlideRetentionRecords].map((record) => record.brand)).filter(
      (brand) => !isExcludedBrandFilterOption(brand)
    ),
  ];

  const filters = {
    year: selectedYear,
    month: selectedMonth,
    division: normalizeFilterValue(inputFilters.division, divisionOptions, EMPTY_FILTER_VALUE),
    team: normalizeFilterValue(inputFilters.team, teamOptions, EMPTY_FILTER_VALUE),
    psr: normalizeFilterValue(inputFilters.psr, psrOptions, EMPTY_FILTER_VALUE),
    brand: normalizeFilterValue(inputFilters.brand, brandOptions, EMPTY_FILTER_VALUE),
  };

  const matchesFilter = buildMatchesFilter(filters);
  const matchesMonth = (record) =>
    filters.month === EMPTY_FILTER_VALUE ? true : record.monthIndex === selectedMonthIndex;

  const selectedMonthEventRecords = yearEventRecords.filter(
    (record) => matchesMonth(record) && matchesFilter(record)
  );
  const selectedMonthModuleTimeRecords = yearModuleTimeRecords.filter(
    (record) => matchesMonth(record) && matchesFilter(record)
  );
  const selectedMonthBrandTimeRecords = yearBrandTimeRecords.filter(
    (record) => matchesMonth(record) && matchesFilter(record)
  );
  const selectedMonthSlideRetentionRecords = yearSlideRetentionRecords.filter(
    (record) => matchesMonth(record) && matchesFilter(record)
  );
  const selectedYearEventRecords = yearEventRecords.filter(matchesFilter);

  const shareOfVoiceBrandMap = new Map();
  selectedMonthEventRecords.forEach((record) => incrementMap(shareOfVoiceBrandMap, record.brand, record.count));

  const shareOfVoiceAppMap = new Map();
  selectedMonthBrandTimeRecords.forEach((record) =>
    incrementMap(shareOfVoiceAppMap, record.brand, record.durationSeconds)
  );

  const teamRankings = buildRankingRows(
    selectedMonthEventRecords.map((record) => ({
      year: filters.year,
      month: filters.month,
      division: record.division,
      team: record.team,
      brand: record.brand,
      count: record.count,
    })),
    ["year", "month", "division", "team", "brand"],
    10
  );

  const repRankings = buildRankingRows(
    selectedMonthEventRecords.map((record) => ({
      year: filters.year,
      month: filters.month,
      division: record.division,
      team: record.team,
      psr: record.psr,
      brand: record.brand,
      count: record.count,
    })),
    ["year", "month", "division", "team", "psr", "brand"],
    10
  );

  return {
    filters: {
      yearOptions,
      monthOptions,
      divisionOptions,
      teamOptions,
      psrOptions,
      brandOptions,
      selected: filters,
    },
    shareOfVoiceBrand: buildPercentRows(shareOfVoiceBrandMap),
    shareOfVoiceApp: buildPercentRows(shareOfVoiceAppMap),
    teamRankings,
    repRankings,
    generalCountModules: buildTopModuleRows(selectedMonthEventRecords, "count", 9),
    generalTimeModules: buildTopModuleRows(
      selectedMonthModuleTimeRecords.map((record) => ({
        ...record,
        count: Math.round(record.durationSeconds / 60),
      })),
      "count",
      9
    ),
    brandTotalModules: buildTopModuleRows(selectedMonthEventRecords, "count", 7),
    movingMonthly: buildMovingMonthlyModules(selectedYearEventRecords, 7),
    allPerTeam: buildSeriesChart(selectedMonthEventRecords, 8, "team", 7),
    divisionPerTeam: buildSeriesChart(selectedMonthEventRecords, 7, "division", 6),
    specialtyCharts: buildSpecialtyCharts(selectedMonthEventRecords),
    slideRetentionSlides: buildSlideRetentionRows(selectedMonthSlideRetentionRecords),
    unifiedExportRows: buildUnifiedExportRows(selectedMonthSlideRetentionRecords),
    meta: {
      totalSessionsInYear: logs.length,
      totalInteractionsInMonth: selectedMonthEventRecords.length,
      totalSlideViewsInMonth: selectedMonthSlideRetentionRecords.length,
      totalSlideMinutesInMonth: Number(
        sumValues(selectedMonthSlideRetentionRecords.map((record) => record.durationMinutes)).toFixed(2)
      ),
    },
  };
}
