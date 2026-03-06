import { NextResponse } from "next/server";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";

const normalizeText = (value) => String(value || "").trim();
const normalizeAccountKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const BASE_TEXT = {
  loadingLogoText: "APP LOGO",
  loginLogoText: "LOGO",
  brandTitle: "Generic Placeholder App",
  loginCaption: "Sign in to continue",
  usernamePlaceholder: "Enter username",
  passwordPlaceholder: "Enter password",
  loginButton: "Sign in",
  loginLoading: "Signing in...",
  rememberPassword: "Remember Password",
  bypassButton: "Bypass Login",
  loginFooter: "Placeholder mobile app footer\nReplace with your own legal text.",
  headerLogoText: "APP LOGO",
  syncButton: "Sync",
  syncingButton: "Syncing...",
  logoutButton: "Logout",
  productsTitle: "Select Product",
  productsSubtitle: "Tap a product to view placeholder content",
  searchPlaceholder: "Search products...",
  filterButton: "Filter by Category",
  filterTitle: "Filter by Category",
  filterClear: "Clear All",
  filterApply: "Apply Filters",
  noProducts: "No products match your filters.",
  noImage: "No image",
};

const BASE_IMAGES = {
  logoUrl: "",
  loadingLogoUrl: "",
  loginLogoUrl: "",
  headerLogoUrl: "",
};

const ACCOUNT_CONFIGS = {
  generic: {
    account: "generic",
    config: {
      text: BASE_TEXT,
      images: BASE_IMAGES,
    },
  },
  otsukadetailer: {
    account: "otsukadetailer",
    config: {
      text: {
        ...BASE_TEXT,
        loadingLogoText: "OTSUKA DETAILER",
        loginLogoText: "OTSUKA",
        headerLogoText: "OTSUKA",
        brandTitle: "One Detailer",
        loginFooter: "© {{year}} Otsuka Pharmaceutical Co., Ltd.\nAll rights reserved.",
        usernamePlaceholder: "Enter your Office ID",
        passwordPlaceholder: "Enter your password",
        productsSubtitle: "Tap a product to open Otsuka presentation content",
      },
      images: {
        ...BASE_IMAGES,
        logoUrl: "/images/otsuka-logo.png",
        loadingLogoUrl: "/images/otsuka-logo.png",
        loginLogoUrl: "/images/otsuka-logo.png",
        headerLogoUrl: "/images/otsuka-logo-landscape.png",
      },
    },
  },
};

const OTSUKA_TOKENS = [
  "otsuka",
  "otsukadetailer",
  "otsukadetailer.site",
  "@otsuka",
];

const hasOtsukaToken = (value) => {
  const lower = normalizeText(value).toLowerCase();
  if (!lower) return false;
  return OTSUKA_TOKENS.some((token) => lower.includes(token));
};

const isOtsukaDetailerUser = (user) => {
  if (!user || typeof user !== "object") return false;
  return [
    user.email,
    user.username,
    user.repId,
    user.role,
    user.name,
  ].some(hasOtsukaToken);
};

const resolveConfig = ({ requestedAccount, user }) => {
  const normalizedRequested = normalizeAccountKey(requestedAccount);
  if (normalizedRequested === "otsukadetailer") {
    return ACCOUNT_CONFIGS.otsukadetailer;
  }
  if (normalizedRequested === "generic") {
    return ACCOUNT_CONFIGS.generic;
  }
  if (isOtsukaDetailerUser(user)) {
    return ACCOUNT_CONFIGS.otsukadetailer;
  }
  return ACCOUNT_CONFIGS.generic;
};

export async function GET(request) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const searchParams = new URL(request.url).searchParams;
    const requestedAccount = searchParams.get("account");
    const responsePayload = resolveConfig({
      requestedAccount,
      user: auth?.user || null,
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error("Fetch mobile config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mobile config." },
      { status: 500 }
    );
  }
}
