const BRAND_COLOR_FALLBACKS = [
  "31, 98, 132",
  "240, 116, 48",
  "29, 120, 44",
  "40, 157, 200",
  "160, 46, 157",
  "78, 171, 44",
];

export const BRAND_COLOR_RULES = [
  { keys: ["mucosta"], color: "244, 114, 182" },
  { keys: ["aminoleban oral", "aminoleban"], color: "249, 115, 22" },
  { keys: ["pletaal"], color: "190, 24, 93" },
  { keys: ["samsca"], color: "191, 219, 254" },
  { keys: ["jinarc"], color: "250, 204, 21" },
  { keys: ["rexulti"], color: "34, 197, 94" },
  { keys: ["abilify maintena", "abilify"], color: "59, 130, 246" },
  { keys: ["meptin"], color: "20, 184, 166" },
];

function normalizeChartColorKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBrandColorRule(value) {
  const normalizedLabel = normalizeChartColorKey(value);
  if (!normalizedLabel) return null;

  return (
    BRAND_COLOR_RULES.find((rule) =>
      rule.keys.some((key) => {
        const normalizedKey = normalizeChartColorKey(key);
        return normalizedLabel === normalizedKey || normalizedLabel.includes(normalizedKey) || normalizedKey.includes(normalizedLabel);
      })
    ) || null
  );
}

export function getBrandColorConfig(label, index = 0) {
  const matchedRule = findBrandColorRule(label);
  if (matchedRule) {
    return {
      color: matchedRule.color,
      borderColor: matchedRule.borderColor || "#ffffff",
    };
  }

  return {
    color: BRAND_COLOR_FALLBACKS[index % BRAND_COLOR_FALLBACKS.length],
    borderColor: "#ffffff",
  };
}

export function getChartItemColorConfig(item, index = 0) {
  const candidates = [
    item?.brand,
    item?.productGroupLabel,
    item?.product,
    item?.productName,
    item?.materialName,
    item?.fullLabel,
    item?.label,
  ];

  for (const candidate of candidates) {
    const matchedRule = findBrandColorRule(candidate);
    if (!matchedRule) continue;

    return {
      color: matchedRule.color,
      borderColor: matchedRule.borderColor || "#ffffff",
    };
  }

  return getBrandColorConfig(item?.label, index);
}
