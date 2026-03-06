import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";
import ActivityLog from "@/models/ActivityLog";
import Product from "@/models/Product";
import User from "@/models/User";

export const runtime = "nodejs";

const LOOKBACK_DAYS = 30;

const toDayKeyUtc = (value) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const cloneDefaultValue = (value) => {
  if (typeof value === "function") return value();
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
};

const buildDateRows = (startDate, endDate, fieldName, defaultValue = () => []) => {
  const rows = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    rows.push({ day: toDayKeyUtc(cursor), [fieldName]: cloneDefaultValue(defaultValue) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
};

const buildUserLabel = (user) => {
  if (!user) return "Unknown User";
  return String(user.username || user.name || user.repId || user.email || "Unknown User").trim();
};

const buildProductLabel = (productEntry, productDoc) => {
  const entryName = String(productEntry?.productName || "").trim();
  if (entryName) return entryName;
  const productName = String(productDoc?.name || productDoc?.brandName || "").trim();
  if (productName) return productName;
  const productId = String(productEntry?.productId || "").trim();
  return productId || "Unknown Product";
};

export async function GET(request) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - LOOKBACK_DAYS);

    const [activitiesByActionDayRows, topUsersDailyRows, topProductsDailyRows, topFilesDailyRows] = await Promise.all([
      ActivityLog.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate, $lte: now },
          },
        },
        { $unwind: "$events" },
        {
          $match: {
            "events.occurredAt": { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$events.occurredAt",
                  timezone: "UTC",
                },
              },
              action: { $ifNull: ["$events.action", "unknown_action"] },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1, "_id.action": 1 } },
      ]),
      ActivityLog.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$startedAt",
                  timezone: "UTC",
                },
              },
              userId: "$userId",
            },
            sessions: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.day": 1,
            sessions: -1,
            "_id.userId": 1,
          },
        },
        {
          $group: {
            _id: "$_id.day",
            users: {
              $push: {
                userId: "$_id.userId",
                sessions: "$sessions",
              },
            },
          },
        },
        {
          $project: {
            topUsers: { $slice: ["$users", 3] },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ActivityLog.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate, $lte: now },
          },
        },
        { $unwind: "$events" },
        {
          $match: {
            "events.occurredAt": { $gte: startDate, $lte: now },
          },
        },
        {
          $project: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$events.occurredAt",
                timezone: "UTC",
              },
            },
            productId: {
              $cond: [
                { $ne: [{ $ifNull: ["$events.details.productId", null] }, null] },
                { $toString: "$events.details.productId" },
                null,
              ],
            },
            productName: {
              $cond: [
                { $ne: [{ $ifNull: ["$events.details.productName", null] }, null] },
                { $toString: "$events.details.productName" },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            productId: { $trim: { input: { $ifNull: ["$productId", ""] } } },
            productName: { $trim: { input: { $ifNull: ["$productName", ""] } } },
          },
        },
        {
          $addFields: {
            productKey: {
              $cond: [
                { $ne: ["$productId", ""] },
                "$productId",
                {
                  $cond: [{ $ne: ["$productName", ""] }, "$productName", ""],
                },
              ],
            },
          },
        },
        {
          $match: {
            productKey: { $ne: "" },
          },
        },
        {
          $group: {
            _id: {
              day: "$day",
              productKey: "$productKey",
            },
            interactions: { $sum: 1 },
            productId: { $first: "$productId" },
            productName: { $first: "$productName" },
          },
        },
        {
          $sort: {
            "_id.day": 1,
            interactions: -1,
            "_id.productKey": 1,
          },
        },
        {
          $group: {
            _id: "$_id.day",
            products: {
              $push: {
                productId: "$productId",
                productName: "$productName",
                interactions: "$interactions",
              },
            },
          },
        },
        {
          $project: {
            topProducts: { $slice: ["$products", 3] },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ActivityLog.aggregate([
        {
          $match: {
            startedAt: { $gte: startDate, $lte: now },
          },
        },
        { $unwind: "$events" },
        {
          $match: {
            "events.occurredAt": { $gte: startDate, $lte: now },
            "events.screen": "presentation-viewer",
          },
        },
        {
          $project: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$events.occurredAt",
                timezone: "UTC",
              },
            },
            actionLower: {
              $toLower: { $ifNull: ["$events.action", ""] },
            },
            fileLabelRaw: {
              $ifNull: [
                "$events.deckTitle",
                {
                  $ifNull: [
                    "$events.details.deckTitle",
                    {
                      $ifNull: ["$events.details.presentationTitle", "$events.details.deckId"],
                    },
                  ],
                },
              ],
            },
            deckIdRaw: {
              $ifNull: ["$events.details.deckId", ""],
            },
          },
        },
        {
          $addFields: {
            fileLabel: { $trim: { input: { $ifNull: ["$fileLabelRaw", ""] } } },
            deckId: { $trim: { input: { $ifNull: ["$deckIdRaw", ""] } } },
            isOpen: {
              $regexMatch: {
                input: "$actionLower",
                regex: "(open|view)",
              },
            },
            isClick: {
              $regexMatch: {
                input: "$actionLower",
                regex: "(click|tap|select)",
              },
            },
          },
        },
        {
          $addFields: {
            fileKey: {
              $cond: [{ $ne: ["$deckId", ""] }, "$deckId", "$fileLabel"],
            },
          },
        },
        {
          $match: {
            fileLabel: { $ne: "" },
            $or: [{ isOpen: true }, { isClick: true }],
          },
        },
        {
          $group: {
            _id: {
              day: "$day",
              fileKey: "$fileKey",
            },
            fileLabel: { $first: "$fileLabel" },
            deckId: { $first: "$deckId" },
            interactions: { $sum: 1 },
            openCount: {
              $sum: {
                $cond: [{ $eq: ["$isOpen", true] }, 1, 0],
              },
            },
            clickCount: {
              $sum: {
                $cond: [{ $eq: ["$isClick", true] }, 1, 0],
              },
            },
          },
        },
        {
          $sort: {
            "_id.day": 1,
            interactions: -1,
            fileLabel: 1,
          },
        },
        {
          $group: {
            _id: "$_id.day",
            files: {
              $push: {
                fileLabel: "$fileLabel",
                deckId: "$deckId",
                interactions: "$interactions",
                openCount: "$openCount",
                clickCount: "$clickCount",
              },
            },
          },
        },
        {
          $project: {
            topFiles: { $slice: ["$files", 3] },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const topUserIds = Array.from(
      new Set(
        topUsersDailyRows
          .flatMap((row) =>
            Array.isArray(row?.topUsers)
              ? row.topUsers.map((entry) => String(entry?.userId || "")).filter(Boolean)
              : []
          )
      )
    );

    const users = topUserIds.length
      ? await User.find({ _id: { $in: topUserIds } })
          .select("name username repId email")
          .lean()
      : [];
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const topProductIds = Array.from(
      new Set(
        topProductsDailyRows
          .flatMap((row) =>
            Array.isArray(row?.topProducts)
              ? row.topProducts
                  .map((entry) => String(entry?.productId || "").trim())
                  .filter(Boolean)
              : []
          )
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      )
    );
    const products = topProductIds.length
      ? await Product.find({ _id: { $in: topProductIds } }).select("name brandName").lean()
      : [];
    const productsById = new Map(products.map((product) => [String(product._id), product]));

    const topUsersByDayMap = new Map(
      topUsersDailyRows.map((row) => {
        const topUsers = (Array.isArray(row?.topUsers) ? row.topUsers : [])
          .slice(0, 3)
          .map((entry, index) => {
            const userId = String(entry?.userId || "");
            const user = usersById.get(userId);
            return {
              rank: index + 1,
              sessions: Number(entry?.sessions || 0),
              userId: userId || null,
              userLabel: buildUserLabel(user),
            };
          });
        return [
          String(row._id),
          {
            day: String(row._id),
            topUsers,
          },
        ];
      })
    );

    const topUsersByDay = buildDateRows(startDate, now, "topUsers").map((row) => {
      const mapped = topUsersByDayMap.get(row.day);
      if (!mapped) return row;
      return mapped;
    });
    const topProductsByDayMap = new Map(
      topProductsDailyRows.map((row) => {
        const topProducts = (Array.isArray(row?.topProducts) ? row.topProducts : [])
          .slice(0, 3)
          .map((entry, index) => {
            const productId = String(entry?.productId || "").trim();
            const product = productsById.get(productId);
            return {
              rank: index + 1,
              interactions: Number(entry?.interactions || 0),
              productId: productId || null,
              productLabel: buildProductLabel(entry, product),
            };
          });
        return [
          String(row._id),
          {
            day: String(row._id),
            topProducts,
          },
        ];
      })
    );
    const topProductsByDay = buildDateRows(startDate, now, "topProducts").map((row) => {
      const mapped = topProductsByDayMap.get(row.day);
      if (!mapped) return row;
      return mapped;
    });
    const topFilesByDayMap = new Map(
      topFilesDailyRows.map((row) => {
        const topFiles = (Array.isArray(row?.topFiles) ? row.topFiles : [])
          .slice(0, 3)
          .map((entry, index) => {
            const fileLabel = String(entry?.fileLabel || "").trim();
            const deckId = String(entry?.deckId || "").trim();
            return {
              rank: index + 1,
              interactions: Number(entry?.interactions || 0),
              openCount: Number(entry?.openCount || 0),
              clickCount: Number(entry?.clickCount || 0),
              deckId: deckId || null,
              fileLabel: fileLabel || "Unknown File",
            };
          });
        return [
          String(row._id),
          {
            day: String(row._id),
            topFiles,
          },
        ];
      })
    );
    const topFilesByDay = buildDateRows(startDate, now, "topFiles").map((row) => {
      const mapped = topFilesByDayMap.get(row.day);
      if (!mapped) return row;
      return mapped;
    });

    const activityTotalsByAction = new Map();
    const activityCountsByDay = new Map();
    activitiesByActionDayRows.forEach((row) => {
      const day = String(row?._id?.day || "");
      const action = String(row?._id?.action || "unknown_action").trim() || "unknown_action";
      const total = Number(row?.total || 0);
      if (!day || total <= 0) return;

      const dayCounts = activityCountsByDay.get(day) || {};
      dayCounts[action] = total;
      activityCountsByDay.set(day, dayCounts);

      activityTotalsByAction.set(action, (activityTotalsByAction.get(action) || 0) + total);
    });

    const activityActions = Array.from(activityTotalsByAction.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([action]) => action);

    const activitiesByDay = buildDateRows(startDate, now, "counts", () => ({})).map((row) => {
      const counts = activityCountsByDay.get(row.day) || {};
      const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
      return {
        day: row.day,
        counts,
        total,
      };
    });

    return NextResponse.json({
      range: {
        days: LOOKBACK_DAYS,
        from: topUsersByDay[0]?.day || null,
        to: topUsersByDay[topUsersByDay.length - 1]?.day || null,
        timezone: "UTC",
      },
      activitiesByDay,
      activityActions,
      topUsersByDay,
      topProductsByDay,
      topFilesByDay,
    });
  } catch (error) {
    console.error("Engagement summary error:", error);
    return NextResponse.json({ error: "Failed to load engagement summary." }, { status: 500 });
  }
}
