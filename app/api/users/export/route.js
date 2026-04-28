import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import connectDB from "@/lib/db";
import { createUsersCsvBuffer, createUsersWorkbookBuffer } from "@/lib/userWorkbook";
import { getUserAccessType } from "@/lib/userAccess";
import User from "@/models/User";

export const runtime = "nodejs";

const mapUser = (user) => ({
  name: user?.name || "",
  username: user?.username || "",
  team: user?.role || "",
  division: user?.division || "",
  access: getUserAccessType(user) === "admin" ? "Admin" : "Representative",
  secretPassword: "",
  manualPassword: "",
});

const buildFilename = (format) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `users-${year}-${month}-${day}.${format}`;
};

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const users = await User.find().sort({ createdAt: -1 }).select("-password").lean();
    const url = new URL(request.url);
    const format = url.searchParams.get("format")?.toLowerCase() === "csv" ? "csv" : "xlsx";
    const exportRows = users.map(mapUser);
    const buffer =
      format === "csv"
        ? createUsersCsvBuffer(exportRows)
        : createUsersWorkbookBuffer(exportRows);
    const contentType =
      format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${buildFilename(format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export users workbook error:", error);
    return NextResponse.json({ error: "Failed to export users workbook." }, { status: 500 });
  }
}
