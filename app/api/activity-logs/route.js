import { NextResponse } from "next/server";
import { GET as getUserActivityLogs } from "@/app/api/users/[id]/activity-logs/route";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const withCors = (response) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get("userid") || searchParams.get("userId") || "").trim();

  if (!userId) {
    return withCors(
      NextResponse.json(
      { error: "userid query parameter is required." },
      { status: 400 }
      )
    );
  }

  const response = await getUserActivityLogs(request, {
    params: Promise.resolve({ id: userId }),
  });
  return withCors(response);
}
