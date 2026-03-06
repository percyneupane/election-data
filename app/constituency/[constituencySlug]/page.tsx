import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { ConstituencyCard } from "@/components/ConstituencyCard";
import { getElectionData, startElectionRefreshScheduler } from "@/lib/dataStore";
import { filterExcludedDistricts } from "@/lib/districtFilters";

export const runtime = "nodejs";

startElectionRefreshScheduler();

interface ConstituencyPageProps {
  params: Promise<{ constituencySlug: string }>;
}

export default async function ConstituencyPage({
  params
}: ConstituencyPageProps): Promise<React.JSX.Element> {
  const { constituencySlug } = await params;
  const dataset = await getElectionData();
  const districts = filterExcludedDistricts(dataset.districts);
  const constituency = districts
    .flatMap((district) => district.constituencies)
    .find((item) => item.constituencySlug === constituencySlug);

  if (!constituency) {
    notFound();
  }

  return (
    <main className="slide-wrap">
      <div className="top-row">
        <div className="title-block">
          <div className="election-title">
            {constituency.districtName} - {constituency.constituencyName}
          </div>
          <div className="subtitle">Constituency Result Details</div>
        </div>
      </div>

      <div className="controls">
        <BackButton label="Back" fallbackHref="/" />
        <Link href="/" className="party-back-link">
          Back to Dashboard
        </Link>
      </div>

      <section className="grid">
        <ConstituencyCard constituency={constituency} />
      </section>
    </main>
  );
}
