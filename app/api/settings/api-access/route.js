import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getApiLoginRequired, setApiLoginRequired } from "@/lib/apiAccess";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const apiLoginRequired = await getApiLoginRequired();
    return NextResponse.json({ apiLoginRequired });
  } catch (error) {
    console.error("Get API access settings error:", error);
    return NextResponse.json(
      { error: "Failed to load API access setting." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.apiLoginRequired !== "boolean") {
      return NextResponse.json(
        { error: "apiLoginRequired must be a boolean." },
        { status: 400 }
      );
    }

    const apiLoginRequired = await setApiLoginRequired(body.apiLoginRequired);
    return NextResponse.json({ apiLoginRequired });
  } catch (error) {
    console.error("Update API access settings error:", error);
    return NextResponse.json(
      { error: "Failed to update API access setting." },
      { status: 500 }
    );
  }
}
