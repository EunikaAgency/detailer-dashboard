import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDashboardReportV2Section } from "@/lib/dashboardReports";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const report = await getDashboardReportV2Section(
      {
      year: searchParams.get("year") || "",
      month: searchParams.get("month") || "",
      division: searchParams.get("division") || "",
      team: searchParams.get("team") || "",
      psr: searchParams.get("psr") || "",
      brand: searchParams.get("brand") || "",
      },
      searchParams.get("section") || "full"
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("Dashboard v2 reports error:", error);
    return NextResponse.json({ error: "Failed to load dashboard v2 reports." }, { status: 500 });
  }
}
