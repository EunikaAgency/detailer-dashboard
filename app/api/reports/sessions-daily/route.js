import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ActivityLog from "@/models/ActivityLog";

export const runtime = "nodejs";

const LOOKBACK_DAYS = 30;

const toDayKeyUtc = (value) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDateRows = (startDate, endDate) => {
  const rows = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    rows.push({
      day: toDayKeyUtc(cursor),
      sessions: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
};

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = String(searchParams.get("userId") || "").trim();

    if (userIdParam && !mongoose.Types.ObjectId.isValid(userIdParam)) {
      return NextResponse.json({ error: "Invalid userId." }, { status: 400 });
    }

    await connectDB();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - LOOKBACK_DAYS);

    const match = {
      startedAt: { $gte: startDate, $lte: now },
    };

    if (userIdParam) {
      match.userId = new mongoose.Types.ObjectId(userIdParam);
    }

    const aggregatedRows = await ActivityLog.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$startedAt",
              timezone: "UTC",
            },
          },
          sessions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const sessionCountByDay = new Map(
      aggregatedRows.map((row) => [String(row._id), Number(row.sessions || 0)])
    );
    const rows = buildDateRows(startDate, now).map((row) => ({
      ...row,
      sessions: sessionCountByDay.get(row.day) || 0,
    }));

    const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);

    return NextResponse.json({
      range: {
        days: LOOKBACK_DAYS,
        from: rows[0]?.day || null,
        to: rows[rows.length - 1]?.day || null,
        timezone: "UTC",
      },
      filters: {
        userId: userIdParam || null,
      },
      totalSessions,
      rows,
    });
  } catch (error) {
    console.error("Sessions daily report error:", error);
    return NextResponse.json({ error: "Failed to load session reports." }, { status: 500 });
  }
}
