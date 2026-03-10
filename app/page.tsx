import { HomePageClient } from "@/components/HomePageClient";
import { getElectionData, startElectionRefreshScheduler } from "@/lib/dataStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

startElectionRefreshScheduler();

export default async function HomePage(): Promise<React.JSX.Element> {
  const initialData = await getElectionData();
  return <HomePageClient initialData={initialData} />;
}
