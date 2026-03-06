import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { getElectionData, startElectionRefreshScheduler } from "@/lib/dataStore";
import { filterExcludedDistricts } from "@/lib/districtFilters";

export const runtime = "nodejs";

startElectionRefreshScheduler();

interface ProvincePartyStat {
  partyName: string;
  partyLogoUrl?: string;
  wonCount: number;
  leadingCount: number;
  secondPlaceCount: number;
}

interface ProvincePageProps {
  params: Promise<{ provinceSlug: string }>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function ProvincePage({ params }: ProvincePageProps): Promise<React.JSX.Element> {
  const { provinceSlug } = await params;
  const dataset = await getElectionData();
  const districts = filterExcludedDistricts(dataset.districts);

  const provinces = [...new Set(districts.map((district) => district.province || "Unknown Province"))];
  const provinceName = provinces.find((province) => slugify(province) === provinceSlug) ?? provinceSlug;

  const provinceDistricts = districts.filter((district) => (district.province || "Unknown Province") === provinceName);
  const districtCount = provinceDistricts.length;
  const constituencyCount = provinceDistricts.reduce((sum, district) => sum + district.constituencies.length, 0);
  const partyMap = new Map<string, ProvincePartyStat>();

  for (const district of provinceDistricts) {
    for (const constituency of district.constituencies) {
      const lead = constituency.leadingCandidate;
      if (lead && lead.votes > 0) {
        const partyName = lead.partyName || "Independent/Unknown";
        const stat = partyMap.get(partyName) ?? {
          partyName,
          partyLogoUrl: lead.partyLogoUrl,
          wonCount: 0,
          leadingCount: 0,
          secondPlaceCount: 0
        };
        if (!stat.partyLogoUrl && lead.partyLogoUrl) {
          stat.partyLogoUrl = lead.partyLogoUrl;
        }
        if (lead.status === "won") {
          stat.wonCount += 1;
        } else {
          stat.leadingCount += 1;
        }
        partyMap.set(partyName, stat);
      }

      const runner = constituency.runnerUp;
      if (runner && runner.votes > 0) {
        const partyName = runner.partyName || "Independent/Unknown";
        const stat = partyMap.get(partyName) ?? {
          partyName,
          partyLogoUrl: runner.partyLogoUrl,
          wonCount: 0,
          leadingCount: 0,
          secondPlaceCount: 0
        };
        if (!stat.partyLogoUrl && runner.partyLogoUrl) {
          stat.partyLogoUrl = runner.partyLogoUrl;
        }
        stat.secondPlaceCount += 1;
        partyMap.set(partyName, stat);
      }
    }
  }

  const partyStats = [...partyMap.values()]
    .filter((item) => item.wonCount + item.leadingCount + item.secondPlaceCount > 0)
    .sort((a, b) => {
      const aScore = a.leadingCount * 1000 + a.wonCount * 100 + a.secondPlaceCount;
      const bScore = b.leadingCount * 1000 + b.wonCount * 100 + b.secondPlaceCount;
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return a.partyName.localeCompare(b.partyName);
    });

  return (
    <main className="slide-wrap">
      <div className="top-row">
        <div className="title-block">
          <div className="election-title">{provinceName}</div>
          <div className="subtitle">
            {districtCount} districts, {constituencyCount} constituencies
          </div>
          <div className="subtitle">Province Party Seat Standings</div>
        </div>
      </div>

      <div className="controls">
        <BackButton label="Back" fallbackHref="/" />
        <Link href="/" className="party-back-link">
          Back to Dashboard
        </Link>
      </div>

      <section className="province-party-table-panel">
        <h2>Party Table</h2>
        <div className="province-party-summary">
          <div className="province-party-head">
            <span>Party</span>
            <span>Lead</span>
            <span>Won</span>
            <span>Second</span>
          </div>
          {partyStats.length > 0 ? (
            partyStats.map((party) => (
              <div key={`table-${party.partyName}`} className="province-party-row">
                <span>{party.partyName}</span>
                <span>{party.leadingCount}</span>
                <span>{party.wonCount}</span>
                <span>{party.secondPlaceCount}</span>
              </div>
            ))
          ) : (
            <div className="province-party-empty">No party standings available for this province.</div>
          )}
        </div>
      </section>

      <section className="province-party-page-grid">
        {partyStats.length > 0 ? (
          partyStats.map((party) => (
            <Link
              key={party.partyName}
              href={`/province/${provinceSlug}/party/${slugify(party.partyName)}`}
              className="party-summary-link"
            >
              <article className="party-summary-card party-summary-button">
                <div className="party-card-header">
                  <h3>{party.partyName}</h3>
                  {party.partyLogoUrl ? (
                    <img className="party-logo" src={party.partyLogoUrl} alt={`${party.partyName} logo`} />
                  ) : null}
                </div>
                <div className="party-stats">
                  <span>Won seats: {party.wonCount}</span>
                  <span>Leading seats: {party.leadingCount}</span>
                  <span>Second place seats: {party.secondPlaceCount}</span>
                </div>
              </article>
            </Link>
          ))
        ) : (
          <article className="constituency-card">No party standings available for this province.</article>
        )}
      </section>

    </main>
  );
}
