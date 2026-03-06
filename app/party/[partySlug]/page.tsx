import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { PartyConstituencyFilters } from "@/components/PartyConstituencyFilters";
import { getElectionData, getRawCacheData, startElectionRefreshScheduler } from "@/lib/dataStore";
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

function getPartyBuckets(
  constituencies: ConstituencyResult[],
  partySlug: string
): {
  leadingAndWonByParty: ConstituencyResult[];
  secondByParty: ConstituencyResult[];
} {
  const leadingAndWonByParty: ConstituencyResult[] = constituencies.filter((constituency) =>
    constituency.leadingCandidate?.partyName
      ? partySlugify(constituency.leadingCandidate.partyName) === partySlug
      : false
  );
  const secondByParty: ConstituencyResult[] = constituencies.filter((constituency) =>
    constituency.runnerUp?.partyName ? partySlugify(constituency.runnerUp.partyName) === partySlug : false
  );

  return { leadingAndWonByParty, secondByParty };
}

export default async function PartyPage({ params }: PartyPageProps): Promise<React.JSX.Element> {
  const { partySlug } = await params;
  const cachedDataset = await getRawCacheData();
  const cachedDistricts = filterExcludedDistricts(cachedDataset.districts);
  let allConstituencies: ConstituencyResult[] = cachedDistricts.flatMap((district) => district.constituencies);
  let { leadingAndWonByParty, secondByParty } = getPartyBuckets(allConstituencies, partySlug);

  // If cache is out of sync with the live dashboard list, retry with current dataset.
  if (leadingAndWonByParty.length === 0 && secondByParty.length === 0) {
    const liveDataset = await getElectionData();
    const liveDistricts = filterExcludedDistricts(liveDataset.districts);
    allConstituencies = liveDistricts.flatMap((district) => district.constituencies);
    ({ leadingAndWonByParty, secondByParty } = getPartyBuckets(allConstituencies, partySlug));
  }

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
