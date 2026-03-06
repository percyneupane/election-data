import { NextResponse } from "next/server";
import { getElectionData, startElectionRefreshScheduler } from "@/lib/dataStore";

export const runtime = "nodejs";

startElectionRefreshScheduler();

export async function GET(): Promise<NextResponse> {
  const dataset = await getElectionData();

  const statusCode = dataset.districts.length > 0 ? 200 : 503;
  return NextResponse.json(dataset, {
    status: statusCode,
    headers: {
      "cache-control": "no-store"
    }
  });
}
