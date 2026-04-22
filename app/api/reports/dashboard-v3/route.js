import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDashboardReportV3 } from "@/lib/dashboardReports";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const report = await getDashboardReportV3({
      year: searchParams.get("year") || "",
      month: searchParams.get("month") || "",
      division: searchParams.get("division") || "",
      team: searchParams.get("team") || "",
      psr: searchParams.get("psr") || "",
      brand: searchParams.get("brand") || "",
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Dashboard v3 reports error:", error);
    return NextResponse.json({ error: "Failed to load dashboard v3 reports." }, { status: 500 });
  }
}
