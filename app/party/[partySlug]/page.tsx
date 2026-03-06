import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { PartyConstituencyFilters } from "@/components/PartyConstituencyFilters";
import { getRawCacheData, startElectionRefreshScheduler } from "@/lib/dataStore";
import { filterExcludedDistricts } from "@/lib/districtFilters";
import { ConstituencyResult } from "@/lib/types";

export const runtime = "nodejs";

startElectionRefreshScheduler();

function partySlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface PartyPageProps {
  params: Promise<{ partySlug: string }>;
}

export default async function PartyPage({ params }: PartyPageProps): Promise<React.JSX.Element> {
  const { partySlug } = await params;
  const dataset = await getRawCacheData();
  const districts = filterExcludedDistricts(dataset.districts);

  const allConstituencies: ConstituencyResult[] = districts.flatMap((district) => district.constituencies);

  const leadingAndWonByParty: ConstituencyResult[] = allConstituencies.filter((constituency) =>
    constituency.leadingCandidate?.partyName
      ? partySlugify(constituency.leadingCandidate.partyName) === partySlug
      : false
  );
  const secondByParty: ConstituencyResult[] = allConstituencies.filter((constituency) =>
    constituency.runnerUp?.partyName ? partySlugify(constituency.runnerUp.partyName) === partySlug : false
  );

  const partyName =
    leadingAndWonByParty[0]?.leadingCandidate?.partyName ??
    secondByParty[0]?.runnerUp?.partyName ??
    partySlug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const won = leadingAndWonByParty.filter(
    (item) => item.leadingCandidate?.status === "won" && (item.leadingCandidate?.votes ?? 0) > 0
  );
  const leading = leadingAndWonByParty.filter(
    (item) => item.leadingCandidate?.status !== "won" && (item.leadingCandidate?.votes ?? 0) > 0
  );
  const second = secondByParty.filter((item) => (item.runnerUp?.votes ?? 0) > 0);

  return (
    <main className="slide-wrap">
      <div className="top-row">
        <div className="title-block">
          <div className="election-title">{partyName}</div>
          <div className="subtitle">Party Constituency Details</div>
        </div>
      </div>

      <div className="controls">
        <BackButton label="Back" fallbackHref="/" />
        <Link href="/" className="party-back-link">
          Back to Dashboard
        </Link>
      </div>

      <PartyConstituencyFilters leading={leading} won={won} second={second} />
    </main>
  );
}
