import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { getElectionData, startElectionRefreshScheduler } from "@/lib/dataStore";
import { filterExcludedDistricts } from "@/lib/districtFilters";

export const runtime = "nodejs";

startElectionRefreshScheduler();

interface PartyDistrictBreakdown {
  districtSlug: string;
  districtName: string;
  won: string[];
  leading: string[];
  second: string[];
}

interface ProvincePartyPageProps {
  params: Promise<{ provinceSlug: string; partySlug: string }>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayNameFromSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ProvincePartyPage({
  params
}: ProvincePartyPageProps): Promise<React.JSX.Element> {
  const { provinceSlug, partySlug } = await params;

  const dataset = await getElectionData();
  const districts = filterExcludedDistricts(dataset.districts);

  const provinces = [...new Set(districts.map((district) => district.province || "Unknown Province"))];
  const provinceName = provinces.find((province) => slugify(province) === provinceSlug) ?? displayNameFromSlug(provinceSlug);

  const provinceDistricts = districts.filter((district) => (district.province || "Unknown Province") === provinceName);

  const breakdown: PartyDistrictBreakdown[] = provinceDistricts
    .map((district) => {
      const won: string[] = [];
      const leading: string[] = [];
      const second: string[] = [];

      for (const constituency of district.constituencies) {
        const lead = constituency.leadingCandidate;
        const runner = constituency.runnerUp;
        if (lead?.partyName && slugify(lead.partyName) === partySlug && lead.votes > 0) {
          if (lead.status === "won") {
            won.push(constituency.constituencyName);
          } else {
            leading.push(constituency.constituencyName);
          }
        }
        if (runner?.partyName && slugify(runner.partyName) === partySlug && runner.votes > 0) {
          second.push(constituency.constituencyName);
        }
      }

      return {
        districtSlug: district.districtSlug,
        districtName: district.districtName,
        won,
        leading,
        second
      };
    })
    .filter((item) => item.won.length + item.leading.length + item.second.length > 0)
    .sort((a, b) => {
      const aScore = a.leading.length * 1000 + a.won.length * 100 + a.second.length;
      const bScore = b.leading.length * 1000 + b.won.length * 100 + b.second.length;
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return a.districtName.localeCompare(b.districtName);
    });

  const partyName =
    provinceDistricts
      .flatMap((district) => district.constituencies)
      .find(
        (constituency) =>
          (constituency.leadingCandidate?.partyName &&
            slugify(constituency.leadingCandidate.partyName) === partySlug) ||
          (constituency.runnerUp?.partyName && slugify(constituency.runnerUp.partyName) === partySlug)
      )
      ?.leadingCandidate?.partyName ??
    displayNameFromSlug(partySlug);

  return (
    <main className="slide-wrap">
      <div className="top-row">
        <div className="title-block">
          <div className="election-title">{partyName}</div>
          <div className="subtitle">{provinceName} - District Breakdown</div>
        </div>
      </div>

      <div className="controls">
        <BackButton label="Back" fallbackHref={`/province/${provinceSlug}`} />
        <Link href={`/province/${provinceSlug}`} className="party-back-link">
          Back to Province
        </Link>
      </div>

      <section className="district-detail-grid">
        {breakdown.length > 0 ? (
          breakdown.map((item) => (
            <article key={item.districtSlug} className="district-detail-card">
              <h3>{item.districtName}</h3>
              <div className="district-detail-stats">
                <span>Won: {item.won.length}</span>
                <span>Leading: {item.leading.length}</span>
                <span>Second: {item.second.length}</span>
              </div>
              <div className="district-detail-list-wrap">
                <h4>Won</h4>
                {item.won.length > 0 ? (
                  <ul className="district-detail-list">
                    {item.won.map((name) => (
                      <li key={`won-${item.districtSlug}-${name}`}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
              <div className="district-detail-list-wrap">
                <h4>Leading</h4>
                {item.leading.length > 0 ? (
                  <ul className="district-detail-list">
                    {item.leading.map((name) => (
                      <li key={`leading-${item.districtSlug}-${name}`}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
              <div className="district-detail-list-wrap">
                <h4>Second Place</h4>
                {item.second.length > 0 ? (
                  <ul className="district-detail-list">
                    {item.second.map((name) => (
                      <li key={`second-${item.districtSlug}-${name}`}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
            </article>
          ))
        ) : (
          <article className="constituency-card">No district-level data available for this party in this province.</article>
        )}
      </section>
    </main>
  );
}
