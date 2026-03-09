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

interface DistrictPartyTable {
  districtSlug: string;
  districtName: string;
  constituencyCount: number;
  partyStats: ProvincePartyStat[];
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

  const districtPartyTables: DistrictPartyTable[] = provinceDistricts
    .map((district) => {
      const districtPartyMap = new Map<string, ProvincePartyStat>();

      for (const constituency of district.constituencies) {
        const lead = constituency.leadingCandidate;
        if (lead && lead.votes > 0) {
          const partyName = lead.partyName || "Independent/Unknown";
          const stat = districtPartyMap.get(partyName) ?? {
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
          districtPartyMap.set(partyName, stat);
        }

        const runner = constituency.runnerUp;
        if (runner && runner.votes > 0) {
          const partyName = runner.partyName || "Independent/Unknown";
          const stat = districtPartyMap.get(partyName) ?? {
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
          districtPartyMap.set(partyName, stat);
        }
      }

      const districtPartyStats = [...districtPartyMap.values()]
        .filter((item) => item.wonCount + item.leadingCount + item.secondPlaceCount > 0)
        .sort((a, b) => {
          const aScore = a.leadingCount * 1000 + a.wonCount * 100 + a.secondPlaceCount;
          const bScore = b.leadingCount * 1000 + b.wonCount * 100 + b.secondPlaceCount;
          if (bScore !== aScore) {
            return bScore - aScore;
          }
          return a.partyName.localeCompare(b.partyName);
        });

      return {
        districtSlug: district.districtSlug,
        districtName: district.districtName,
        constituencyCount: district.constituencies.length,
        partyStats: districtPartyStats
      };
    })
    .sort((a, b) => a.districtName.localeCompare(b.districtName));

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

      <section className="province-party-table-panel">
        <h2>District Party Table</h2>
        <div className="district-detail-grid">
          {districtPartyTables.length > 0 ? (
            districtPartyTables.map((districtTable) => (
              <article key={`district-party-${districtTable.districtSlug}`} className="district-detail-card">
                <h3>
                  {districtTable.districtName} <span>({districtTable.constituencyCount} constituencies)</span>
                </h3>
                <div className="province-party-summary">
                  <div className="province-party-head">
                    <span>Party</span>
                    <span>Lead</span>
                    <span>Won</span>
                    <span>Second</span>
                  </div>
                  {districtTable.partyStats.length > 0 ? (
                    districtTable.partyStats.map((party) => (
                      <div
                        key={`${districtTable.districtSlug}-party-row-${party.partyName}`}
                        className="province-party-row"
                      >
                        <span>{party.partyName}</span>
                        <span>{party.leadingCount}</span>
                        <span>{party.wonCount}</span>
                        <span>{party.secondPlaceCount}</span>
                      </div>
                    ))
                  ) : (
                    <div className="province-party-empty">No party standings for this district yet.</div>
                  )}
                </div>
              </article>
            ))
          ) : (
            <article className="constituency-card">No district-level data available for this province.</article>
          )}
        </div>
      </section>

    </main>
  );
}
