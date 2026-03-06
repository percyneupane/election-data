import { NextResponse } from "next/server";
import { getRawCacheData } from "@/lib/dataStore";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const dataset = await getRawCacheData();
  return NextResponse.json(dataset, {
    headers: {
      "cache-control": "no-store"
    }
  });
}
