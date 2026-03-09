import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConstituencyCard } from "@/components/ConstituencyCard";
import { CountdownBar } from "@/components/CountdownBar";
import { LastUpdated } from "@/components/LastUpdated";
import { LiveBadge } from "@/components/LiveBadge";
import { AppLanguage, t } from "@/lib/i18n";
import { ConstituencyResult, DistrictResult, ElectionDataset } from "@/lib/types";

interface DistrictSlideProps {
  district: DistrictResult;
  dataset: ElectionDataset;
  elapsedMs: number;
  totalMs: number;
  districts: DistrictResult[];
  language: AppLanguage;
  onLanguageChange: (next: AppLanguage) => void;
  onJumpToDistrict: (districtSlug: string) => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
}

type ResultView = "constituency" | "party" | "geography" | "proportional" | "dashboard";
type PartyFilter = "all" | "leading" | "won";
type InsightKey = "seats" | "closest" | "highest" | "leader" | "competitive";
type SearchSuggestionKind = "party" | "geography" | "candidate";

interface PartySummary {
  partyName: string;
  partyLogoUrl?: string;
  leadingCount: number;
  wonCount: number;
  secondPlaceCount: number;
  totalLeadVotes: number;
  totalSecondPlaceVotes: number;
  totalVotes: number;
}

interface ProvinceGroup {
  province: string;
  districts: DistrictResult[];
  constituencyCount: number;
  partyStats: ProvincePartyStat[];
  districtStats: ProvinceDistrictStat[];
}

interface ProvincePartyStat {
  partyName: string;
  wonCount: number;
  leadingCount: number;
  secondPlaceCount: number;
  partyLogoUrl?: string;
}

interface ProvinceDistrictStat {
  districtSlug: string;
  districtName: string;
  constituencyCount: number;
  lead: number;
  won: number;
  second: number;
  topParty?: string;
}

interface ProportionalPartyRow {
  partyName: string;
  partyLogoUrl?: string;
  votes: number;
  voteShare: number;
}

interface ConstituencyInsight {
  districtName: string;
  constituencyName: string;
  margin: number;
  leadingParty: string;
  leadingCandidate: string;
}

interface RaceRow {
  district: string;
  constituency: string;
  constituencySlug: string;
  sourceUrl: string;
  leadCandidate: string;
  leadParty: string;
  margin: number;
}

interface ElectionInsights {
  seatsWon: number;
  seatsLeading: number;
  seatsWithResults: number;
  totalConstituencies: number;
  closestRace?: ConstituencyInsight;
  highestMargin?: ConstituencyInsight;
  topVoteLeader?: {
    districtName: string;
    constituencyName: string;
    candidateName: string;
    partyName: string;
    votes: number;
  };
  mostCompetitiveDistrict?: {
    districtName: string;
    avgMargin: number;
    racesCount: number;
  };
}

interface SeatDetailRow {
  district: string;
  constituency: string;
  constituencySlug: string;
  sourceUrl: string;
  party: string;
  candidate: string;
  votes: number;
  status: "leading" | "won";
}

interface LeaderRow {
  district: string;
  constituency: string;
  constituencySlug: string;
  sourceUrl: string;
  candidate: string;
  party: string;
  votes: number;
}

interface SearchSuggestion {
  key: string;
  kind: SearchSuggestionKind;
  label: string;
  value: string;
  context?: string;
}

function partySlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function provinceSlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveMargin(
  leadVotes: number | undefined,
  runnerVotes: number | undefined,
  declaredMargin: number | undefined
): number {
  if (typeof declaredMargin === "number" && declaredMargin >= 0) {
    return declaredMargin;
  }
  if (typeof leadVotes === "number" && typeof runnerVotes === "number") {
    return Math.max(leadVotes - runnerVotes, 0);
  }
  return Number.POSITIVE_INFINITY;
}

function buildElectionInsights(dataset: ElectionDataset): ElectionInsights {
  const constituencies = dataset.districts.flatMap((district) => district.constituencies);
  const totalConstituencies = constituencies.length;
  const seatsWon = constituencies.filter((item) => item.leadingCandidate?.status === "won").length;
  const seatsLeading = constituencies.filter((item) => item.leadingCandidate?.status === "leading").length;
  const seatsWithResults = constituencies.filter((item) => (item.leadingCandidate?.votes ?? 0) > 0).length;

  const raceCandidates = constituencies
    .map((item) => {
      const lead = item.leadingCandidate;
      const runner = item.runnerUp;
      if (!lead || !runner || lead.votes <= 0 || runner.votes <= 0) {
        return null;
      }

      return {
        districtName: item.districtName,
        constituencyName: item.constituencyName,
        margin: resolveMargin(lead.votes, runner.votes, item.leadMargin),
        leadingParty: lead.partyName,
        leadingCandidate: lead.candidateName
      } satisfies ConstituencyInsight;
    })
    .filter((item): item is ConstituencyInsight => Boolean(item));

  const closestRace = [...raceCandidates].sort((a, b) => a.margin - b.margin)[0];
  const highestMargin = [...raceCandidates].sort((a, b) => b.margin - a.margin)[0];

  const topVoteLeader = constituencies
    .map((item) => {
      const lead = item.leadingCandidate;
      if (!lead || lead.votes <= 0) {
        return null;
      }
      return {
        districtName: item.districtName,
        constituencyName: item.constituencyName,
        candidateName: lead.candidateName,
        partyName: lead.partyName,
        votes: lead.votes
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.votes - a.votes)[0];

  const districtAverages = dataset.districts
    .map((district) => {
      const margins = district.constituencies
        .map((item) =>
          resolveMargin(item.leadingCandidate?.votes, item.runnerUp?.votes, item.leadMargin)
        )
        .filter((value) => Number.isFinite(value));
      if (margins.length === 0) {
        return null;
      }
      const avgMargin = margins.reduce((sum, value) => sum + value, 0) / margins.length;
      return { districtName: district.districtName, avgMargin, racesCount: margins.length };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.avgMargin - b.avgMargin)[0];

  return {
    seatsWon,
    seatsLeading,
    seatsWithResults,
    totalConstituencies,
    closestRace,
    highestMargin,
    topVoteLeader,
    mostCompetitiveDistrict: districtAverages
  };
}

function buildPartySummaries(dataset: ElectionDataset): PartySummary[] {
  const byParty = new Map<string, PartySummary>();

  for (const district of dataset.districts) {
    for (const constituency of district.constituencies) {
      const lead = constituency.leadingCandidate;
      if (!lead) {
        continue;
      }

      const partyName = lead.partyName || "Independent/Unknown";
      const existing = byParty.get(partyName) ?? {
        partyName,
        partyLogoUrl: lead.partyLogoUrl,
        leadingCount: 0,
        wonCount: 0,
        secondPlaceCount: 0,
        totalLeadVotes: 0,
        totalSecondPlaceVotes: 0,
        totalVotes: 0
      };
      if (!existing.partyLogoUrl && lead.partyLogoUrl) {
        existing.partyLogoUrl = lead.partyLogoUrl;
      }

      const hasPositiveLeadVotes = lead.votes > 0;
      if (hasPositiveLeadVotes) {
        if (lead.status === "won") {
          existing.wonCount += 1;
        } else {
          existing.leadingCount += 1;
        }
        existing.totalLeadVotes += lead.votes;
      }
      byParty.set(partyName, existing);

      const runner = constituency.runnerUp;
      if (runner && runner.votes > 0) {
        const runnerPartyName = runner.partyName || "Independent/Unknown";
        const runnerExisting = byParty.get(runnerPartyName) ?? {
          partyName: runnerPartyName,
          partyLogoUrl: runner.partyLogoUrl,
          leadingCount: 0,
          wonCount: 0,
          secondPlaceCount: 0,
          totalLeadVotes: 0,
          totalSecondPlaceVotes: 0,
          totalVotes: 0
        };
        if (!runnerExisting.partyLogoUrl && runner.partyLogoUrl) {
          runnerExisting.partyLogoUrl = runner.partyLogoUrl;
        }
        runnerExisting.secondPlaceCount += 1;
        runnerExisting.totalSecondPlaceVotes += runner.votes;
        byParty.set(runnerPartyName, runnerExisting);
      }

      for (const candidate of constituency.topCandidates) {
        const candidatePartyName = candidate.partyName || "Independent/Unknown";
        const candidateParty = byParty.get(candidatePartyName) ?? {
          partyName: candidatePartyName,
          partyLogoUrl: candidate.partyLogoUrl,
          leadingCount: 0,
          wonCount: 0,
          secondPlaceCount: 0,
          totalLeadVotes: 0,
          totalSecondPlaceVotes: 0,
          totalVotes: 0
        };
        if (!candidateParty.partyLogoUrl && candidate.partyLogoUrl) {
          candidateParty.partyLogoUrl = candidate.partyLogoUrl;
        }
        candidateParty.totalVotes += candidate.votes;
        byParty.set(candidatePartyName, candidateParty);
      }
    }
  }

  return [...byParty.values()].sort((a, b) => {
    const aScore = a.leadingCount * 1000 + a.wonCount * 100 + a.secondPlaceCount;
    const bScore = b.leadingCount * 1000 + b.wonCount * 100 + b.secondPlaceCount;
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    return b.totalLeadVotes - a.totalLeadVotes;
  });
}

function buildProvinceGroups(districts: DistrictResult[]): ProvinceGroup[] {
  const byProvince = new Map<string, DistrictResult[]>();

  for (const district of districts) {
    const province = district.province || "Unknown Province";
    const rows = byProvince.get(province) ?? [];
    rows.push(district);
    byProvince.set(province, rows);
  }

  const provinceOrder = [
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
    "Unknown Province"
  ];

  return [...byProvince.entries()]
    .map(([province, provinceDistricts]) => {
      const sortedDistricts = [...provinceDistricts].sort((a, b) => a.districtName.localeCompare(b.districtName));
      const partyMap = new Map<string, ProvincePartyStat>();

      for (const district of sortedDistricts) {
        for (const constituency of district.constituencies) {
          const lead = constituency.leadingCandidate;
          if (lead && lead.votes > 0) {
            const partyName = lead.partyName || "Independent/Unknown";
            const stat = partyMap.get(partyName) ?? {
              partyName,
              wonCount: 0,
              leadingCount: 0,
              secondPlaceCount: 0
            };
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
              wonCount: 0,
              leadingCount: 0,
              secondPlaceCount: 0
            };
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

      const districtStats: ProvinceDistrictStat[] = sortedDistricts
        .map((district) => {
          let lead = 0;
          let won = 0;
          let second = 0;
          const partyTally = new Map<string, number>();

          for (const constituency of district.constituencies) {
            const leader = constituency.leadingCandidate;
            if (leader && leader.votes > 0) {
              const leaderParty = leader.partyName || "Independent/Unknown";
              if (leader.status === "won") {
                won += 1;
              } else {
                lead += 1;
              }
              partyTally.set(leaderParty, (partyTally.get(leaderParty) ?? 0) + 1);
            }

            const runner = constituency.runnerUp;
            if (runner && runner.votes > 0) {
              second += 1;
            }
          }

          const topParty =
            [...partyTally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
            undefined;

          return {
            districtSlug: district.districtSlug,
            districtName: district.districtName,
            constituencyCount: district.constituencies.length,
            lead,
            won,
            second,
            topParty
          };
        })
        .sort((a, b) => {
          const aScore = a.lead * 1000 + a.won * 100 + a.second;
          const bScore = b.lead * 1000 + b.won * 100 + b.second;
          if (bScore !== aScore) {
            return bScore - aScore;
          }
          return a.districtName.localeCompare(b.districtName);
        });

      return {
        province,
        districts: sortedDistricts,
        constituencyCount: sortedDistricts.reduce((sum, item) => sum + item.constituencies.length, 0),
        partyStats,
        districtStats
      };
    })
    .sort((a, b) => {
      const ai = provinceOrder.indexOf(a.province);
      const bi = provinceOrder.indexOf(b.province);
      if (ai >= 0 && bi >= 0) {
        return ai - bi;
      }
      if (ai >= 0) {
        return -1;
      }
      if (bi >= 0) {
        return 1;
      }
      return a.province.localeCompare(b.province);
    });
}

function buildRaceRows(districts: DistrictResult[]): RaceRow[] {
  return districts
    .flatMap((district) =>
      district.constituencies.map((constituency) => {
        const lead = constituency.leadingCandidate;
        const runner = constituency.runnerUp;
        if (!lead || !runner || lead.votes <= 0 || runner.votes <= 0) {
          return null;
        }
        const margin = resolveMargin(lead.votes, runner.votes, constituency.leadMargin);
        if (!Number.isFinite(margin)) {
          return null;
        }
        return {
          district: constituency.districtName,
          constituency: constituency.constituencyName,
          constituencySlug: constituency.constituencySlug,
          sourceUrl: constituency.sourceUrl,
          leadCandidate: lead.candidateName,
          leadParty: lead.partyName,
          margin
        } satisfies RaceRow;
      })
    )
    .filter((row): row is RaceRow => Boolean(row))
    .sort((a, b) => a.margin - b.margin);
}

function buildProportionalRows(
  districts: DistrictResult[],
  importedNational?: { partyName: string; partyLogoUrl?: string; votes: number }[]
): {
  national: ProportionalPartyRow[];
  byProvince: Record<string, ProportionalPartyRow[]>;
} {
  const national = new Map<string, { partyName: string; partyLogoUrl?: string; votes: number }>();
  const provincial = new Map<string, Map<string, { partyName: string; partyLogoUrl?: string; votes: number }>>();

  for (const district of districts) {
    const province = district.province || "Unknown Province";
    const provinceMap = provincial.get(province) ?? new Map<string, { partyName: string; partyLogoUrl?: string; votes: number }>();

    for (const constituency of district.constituencies) {
      for (const candidate of constituency.topCandidates) {
        if (candidate.votes <= 0) {
          continue;
        }

        const partyName = candidate.partyName || "Independent/Unknown";
        const nationalRow = national.get(partyName) ?? { partyName, partyLogoUrl: candidate.partyLogoUrl, votes: 0 };
        nationalRow.votes += candidate.votes;
        if (!nationalRow.partyLogoUrl && candidate.partyLogoUrl) {
          nationalRow.partyLogoUrl = candidate.partyLogoUrl;
        }
        national.set(partyName, nationalRow);

        const provinceRow = provinceMap.get(partyName) ?? { partyName, partyLogoUrl: candidate.partyLogoUrl, votes: 0 };
        provinceRow.votes += candidate.votes;
        if (!provinceRow.partyLogoUrl && candidate.partyLogoUrl) {
          provinceRow.partyLogoUrl = candidate.partyLogoUrl;
        }
        provinceMap.set(partyName, provinceRow);
      }
    }

    provincial.set(province, provinceMap);
  }

  const toRows = (entries: { partyName: string; partyLogoUrl?: string; votes: number }[]): ProportionalPartyRow[] => {
    const totalVotes = entries.reduce((sum, row) => sum + row.votes, 0);
    return entries
      .filter((row) => row.votes > 0)
      .map((row) => ({
        partyName: row.partyName,
        partyLogoUrl: row.partyLogoUrl,
        votes: row.votes,
        voteShare: totalVotes > 0 ? (row.votes / totalVotes) * 100 : 0
      }))
      .sort((a, b) => b.votes - a.votes || a.partyName.localeCompare(b.partyName));
  };

  const nationalRows =
    importedNational && importedNational.length > 0
      ? toRows(importedNational)
      : toRows([...national.values()]);
  const provincialRows: Record<string, ProportionalPartyRow[]> = {};
  for (const [province, partyMap] of provincial.entries()) {
    provincialRows[province] = toRows([...partyMap.values()]);
  }

  return {
    national: nationalRows,
    byProvince: provincialRows
  };
}

export function DistrictSlide({
  district,
  dataset,
  elapsedMs,
  totalMs,
  districts,
  language,
  onLanguageChange,
  onJumpToDistrict,
  autoPlay: _autoPlay,
  onToggleAutoPlay: _onToggleAutoPlay
}: DistrictSlideProps): React.JSX.Element {
  void _autoPlay;
  void _onToggleAutoPlay;
  const [resultView, setResultView] = useState<ResultView>("dashboard");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [selectedInsight, setSelectedInsight] = useState<InsightKey | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [districtSearchTerm, setDistrictSearchTerm] = useState("");

  const partySummaries = useMemo(() => buildPartySummaries(dataset), [dataset]);
  const provinceGroups = useMemo(() => buildProvinceGroups(districts), [districts]);
  const proportionalData = useMemo(
    () => buildProportionalRows(districts, dataset.proportionalResults?.parties),
    [dataset.proportionalResults?.parties, districts]
  );
  const raceRows = useMemo(() => buildRaceRows(districts), [districts]);
  const closestRaces = useMemo(() => raceRows.slice(0, 20), [raceRows]);
  const highestMarginRaces = useMemo(() => [...raceRows].sort((a, b) => b.margin - a.margin).slice(0, 20), [raceRows]);
  const insights = useMemo(() => buildElectionInsights(dataset), [dataset]);
  const seatDetails = useMemo(() => {
    const rows: SeatDetailRow[] = [];
    for (const districtItem of districts) {
      for (const constituency of districtItem.constituencies) {
        const lead = constituency.leadingCandidate;
        if (!lead || lead.votes <= 0 || (lead.status !== "leading" && lead.status !== "won")) {
          continue;
        }
        rows.push({
          district: constituency.districtName,
          constituency: constituency.constituencyName,
          constituencySlug: constituency.constituencySlug,
          sourceUrl: constituency.sourceUrl,
          party: lead.partyName,
          candidate: lead.candidateName,
          votes: lead.votes,
          status: lead.status
        });
      }
    }
    return rows.sort((a, b) => b.votes - a.votes);
  }, [districts]);
  const topLeaders = useMemo(() => {
    const rows: LeaderRow[] = [];
    for (const districtItem of districts) {
      for (const constituency of districtItem.constituencies) {
        const lead = constituency.leadingCandidate;
        if (!lead || lead.votes <= 0) {
          continue;
        }
        rows.push({
          district: constituency.districtName,
          constituency: constituency.constituencyName,
          constituencySlug: constituency.constituencySlug,
          sourceUrl: constituency.sourceUrl,
          candidate: lead.candidateName,
          party: lead.partyName,
          votes: lead.votes
        });
      }
    }
    return rows.sort((a, b) => b.votes - a.votes).slice(0, 20);
  }, [districts]);
  const competitiveDistrictRaces = useMemo(() => {
    if (!insights.mostCompetitiveDistrict) {
      return [] as RaceRow[];
    }
    return raceRows
      .filter((race) => race.district === insights.mostCompetitiveDistrict?.districtName)
      .sort((a, b) => a.margin - b.margin);
  }, [insights.mostCompetitiveDistrict, raceRows]);
  const sortedConstituencies = useMemo(() => {
    return [...district.constituencies].sort((a, b) => {
      const statusPriority = (status?: string): number => {
        if (status === "leading") {
          return 0;
        }
        if (status === "won") {
          return 1;
        }
        if (status === "trailing") {
          return 2;
        }
        return 3;
      };
      const p = statusPriority(a.leadingCandidate?.status) - statusPriority(b.leadingCandidate?.status);
      if (p !== 0) {
        return p;
      }
      const voteDelta = (b.leadingCandidate?.votes ?? 0) - (a.leadingCandidate?.votes ?? 0);
      if (voteDelta !== 0) {
        return voteDelta;
      }
      return a.constituencyName.localeCompare(b.constituencyName);
    });
  }, [district.constituencies]);
  const filteredPartySummaries = useMemo(() => {
    if (partyFilter === "leading") {
      return partySummaries.filter((party) => party.leadingCount > 0);
    }
    if (partyFilter === "won") {
      return partySummaries.filter((party) => party.wonCount > 0);
    }
    return partySummaries;
  }, [partyFilter, partySummaries]);
  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const searchableConstituencies = useMemo(
    () => districts.flatMap((districtItem) => districtItem.constituencies),
    [districts]
  );
  const candidateMatchedPartyNames = useMemo(() => {
    if (!normalizedSearch) {
      return new Set<string>();
    }
    const names = new Set<string>();
    for (const constituency of searchableConstituencies) {
      for (const candidate of constituency.topCandidates) {
        if (candidate.candidateName.toLowerCase().includes(normalizedSearch)) {
          names.add((candidate.partyName || "Independent/Unknown").toLowerCase());
        }
      }
    }
    return names;
  }, [normalizedSearch, searchableConstituencies]);
  const matchesConstituencySearch = useMemo(
    () => (constituency: DistrictResult["constituencies"][number]) => {
      if (!normalizedSearch) {
        return true;
      }
      if (
        constituency.districtName.toLowerCase().includes(normalizedSearch) ||
        constituency.constituencyName.toLowerCase().includes(normalizedSearch) ||
        constituency.province.toLowerCase().includes(normalizedSearch)
      ) {
        return true;
      }
      return constituency.topCandidates.some(
        (candidate) =>
          candidate.candidateName.toLowerCase().includes(normalizedSearch) ||
          candidate.partyName.toLowerCase().includes(normalizedSearch)
      );
    },
    [normalizedSearch]
  );
  const searchedConstituencies = useMemo(
    () => sortedConstituencies.filter((constituency) => matchesConstituencySearch(constituency)),
    [matchesConstituencySearch, sortedConstituencies]
  );
  const searchedConstituenciesGlobal = useMemo(() => {
    const statusPriority = (status?: string): number => {
      if (status === "leading") {
        return 0;
      }
      if (status === "won") {
        return 1;
      }
      if (status === "trailing") {
        return 2;
      }
      return 3;
    };

    return searchableConstituencies
      .filter((constituency) => matchesConstituencySearch(constituency))
      .sort((a, b) => {
        const p = statusPriority(a.leadingCandidate?.status) - statusPriority(b.leadingCandidate?.status);
        if (p !== 0) {
          return p;
        }
        const voteDelta = (b.leadingCandidate?.votes ?? 0) - (a.leadingCandidate?.votes ?? 0);
        if (voteDelta !== 0) {
          return voteDelta;
        }
        const districtDelta = a.districtName.localeCompare(b.districtName);
        if (districtDelta !== 0) {
          return districtDelta;
        }
        return a.constituencyName.localeCompare(b.constituencyName);
      });
  }, [matchesConstituencySearch, searchableConstituencies]);
  const displayedConstituencies = useMemo(
    () => (normalizedSearch ? searchedConstituenciesGlobal : searchedConstituencies),
    [normalizedSearch, searchedConstituencies, searchedConstituenciesGlobal]
  );
  const searchedPartySummaries = useMemo(() => {
    if (!normalizedSearch) {
      return filteredPartySummaries;
    }
    return filteredPartySummaries.filter(
      (party) =>
        party.partyName.toLowerCase().includes(normalizedSearch) ||
        candidateMatchedPartyNames.has(party.partyName.toLowerCase())
    );
  }, [candidateMatchedPartyNames, filteredPartySummaries, normalizedSearch]);
  const dashboardStandingParties = useMemo(
    () => partySummaries.filter((party) => party.leadingCount > 0 || party.wonCount > 0 || party.secondPlaceCount > 0),
    [partySummaries]
  );
  const searchedDashboardStandingParties = useMemo(() => {
    if (!normalizedSearch) {
      return dashboardStandingParties;
    }
    return dashboardStandingParties.filter(
      (party) =>
        party.partyName.toLowerCase().includes(normalizedSearch) ||
        candidateMatchedPartyNames.has(party.partyName.toLowerCase())
    );
  }, [candidateMatchedPartyNames, dashboardStandingParties, normalizedSearch]);
  const searchedProvinceGroups = useMemo(() => {
    if (!normalizedSearch) {
      return provinceGroups;
    }
    return provinceGroups.filter((group) => {
      if (group.province.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (group.districts.some((districtItem) => districtItem.districtName.toLowerCase().includes(normalizedSearch))) {
        return true;
      }
      if (group.partyStats.some((party) => party.partyName.toLowerCase().includes(normalizedSearch))) {
        return true;
      }
      return group.districts.some((districtItem) =>
        districtItem.constituencies.some((constituency) =>
          constituency.topCandidates.some(
            (candidate) =>
              candidate.candidateName.toLowerCase().includes(normalizedSearch) ||
              candidate.partyName.toLowerCase().includes(normalizedSearch)
          )
        )
      );
    });
  }, [normalizedSearch, provinceGroups]);
  const searchedNationalProportionalRows = useMemo(() => {
    if (!normalizedSearch) {
      return proportionalData.national.slice(0, 20);
    }
    return proportionalData.national
      .filter((row) => row.partyName.toLowerCase().includes(normalizedSearch))
      .slice(0, 20);
  }, [normalizedSearch, proportionalData.national]);
  const searchedClosestRaces = useMemo(() => {
    if (!normalizedSearch) {
      return closestRaces;
    }
    return closestRaces.filter(
      (race) =>
        race.district.toLowerCase().includes(normalizedSearch) ||
        race.constituency.toLowerCase().includes(normalizedSearch) ||
        race.leadParty.toLowerCase().includes(normalizedSearch) ||
        race.leadCandidate.toLowerCase().includes(normalizedSearch)
    );
  }, [closestRaces, normalizedSearch]);
  const normalizedDistrictSearch = useMemo(() => districtSearchTerm.trim().toLowerCase(), [districtSearchTerm]);
  const filteredDistricts = useMemo(() => {
    if (!normalizedDistrictSearch) {
      return districts;
    }
    return districts.filter((item) => item.districtName.toLowerCase().includes(normalizedDistrictSearch));
  }, [districts, normalizedDistrictSearch]);
  const randomEligibleConstituencies = useMemo(
    () =>
      searchableConstituencies.filter(
        (constituency) =>
          (constituency.leadingCandidate?.votes ?? 0) > 0 ||
          constituency.topCandidates.some((candidate) => candidate.votes > 0)
      ),
    [searchableConstituencies]
  );
  const [randomConstituencies, setRandomConstituencies] = useState<ConstituencyResult[]>([]);
  const [randomCycleProgress, setRandomCycleProgress] = useState(0);
  const searchSuggestions = useMemo(() => {
    if (!normalizedSearch) {
      return [] as SearchSuggestion[];
    }

    const suggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();

    const pushSuggestion = (suggestion: SearchSuggestion): void => {
      if (seen.has(suggestion.key)) {
        return;
      }
      seen.add(suggestion.key);
      suggestions.push(suggestion);
    };

    for (const party of partySummaries) {
      if (party.partyName.toLowerCase().includes(normalizedSearch)) {
        pushSuggestion({
          key: `party-${party.partyName.toLowerCase()}`,
          kind: "party",
          label: party.partyName,
          value: party.partyName,
          context: "Party"
        });
      }
    }

    const provinceSet = new Set<string>();
    for (const districtItem of districts) {
      const province = districtItem.province || "Unknown Province";
      if (province.toLowerCase().includes(normalizedSearch) && !provinceSet.has(province.toLowerCase())) {
        provinceSet.add(province.toLowerCase());
        pushSuggestion({
          key: `province-${province.toLowerCase()}`,
          kind: "geography",
          label: province,
          value: province,
          context: "Province"
        });
      }
      if (districtItem.districtName.toLowerCase().includes(normalizedSearch)) {
        pushSuggestion({
          key: `district-${districtItem.districtSlug}`,
          kind: "geography",
          label: districtItem.districtName,
          value: districtItem.districtName,
          context: province
        });
      }
    }

    const candidateSeen = new Set<string>();
    for (const constituency of searchableConstituencies) {
      for (const candidate of constituency.topCandidates) {
        const key = candidate.candidateName.toLowerCase();
        if (!key.includes(normalizedSearch) || candidateSeen.has(key)) {
          continue;
        }
        candidateSeen.add(key);
        pushSuggestion({
          key: `candidate-${key}`,
          kind: "candidate",
          label: candidate.candidateName,
          value: candidate.candidateName,
          context: candidate.partyName
        });
      }
    }

    return suggestions
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(normalizedSearch) ? 0 : 1;
        if (aStarts !== bStarts) {
          return aStarts - bStarts;
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, 10);
  }, [districts, normalizedSearch, partySummaries, searchableConstituencies]);
  useEffect(() => {
    if (resultView !== "dashboard" || randomEligibleConstituencies.length === 0) {
      return;
    }

    let cycleStartedAt = Date.now();
    const pickRandomConstituencies = (): void => {
      const shuffled = [...randomEligibleConstituencies].sort(() => Math.random() - 0.5);
      setRandomConstituencies(shuffled.slice(0, Math.min(3, shuffled.length)));
      cycleStartedAt = Date.now();
      setRandomCycleProgress(0);
    };

    pickRandomConstituencies();
    const timerId = window.setInterval(() => {
      const elapsed = Date.now() - cycleStartedAt;
      if (elapsed >= 10_000) {
        pickRandomConstituencies();
        return;
      }
      setRandomCycleProgress(Math.min(elapsed / 10_000, 1));
    }, 100);
    return () => window.clearInterval(timerId);
  }, [randomEligibleConstituencies, resultView]);
  const applySuggestion = (suggestion: SearchSuggestion): void => {
    setSearchTerm(suggestion.value);
    if (suggestion.kind === "party") {
      setResultView("party");
    } else if (suggestion.kind === "geography") {
      setResultView("geography");
    } else {
      setResultView("constituency");
    }
    setSearchFocused(false);
  };

  return (
    <main className="slide-wrap">
      <div className="top-row">
        <div className="language-corner-toggle">
          <button
            type="button"
            className={language === "en" ? "active" : ""}
            onClick={() => onLanguageChange("en")}
            aria-label={t(language, "english")}
          >
            EN
          </button>
          <button
            type="button"
            className={language === "ne" ? "active" : ""}
            onClick={() => onLanguageChange("ne")}
            aria-label={t(language, "nepali")}
          >
            ने
          </button>
        </div>
        <div className="title-block">
          <div className="election-title">{t(language, "federalParliamentElection2082")}</div>
        </div>
      </div>
      <div className="search-wrap">
        <div className="search-box">
          <input
            type="search"
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchSuggestions.length > 0) {
                event.preventDefault();
                applySuggestion(searchSuggestions[0]);
              }
            }}
            placeholder={t(language, "searchPlaceholder")}
            aria-label={t(language, "searchAria")}
          />
          {searchFocused && normalizedSearch && searchSuggestions.length > 0 ? (
            <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className="search-suggestion-item"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                >
                  <span className="search-suggestion-label">{suggestion.label}</span>
                  <span className="search-suggestion-meta">
                    {suggestion.kind}
                    {suggestion.context ? ` · ${suggestion.context}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="live-row">
        <div className="live-controls">
          <button
            type="button"
            className={resultView === "dashboard" ? "active" : ""}
            onClick={() => setResultView("dashboard")}
          >
            {t(language, "dashboardView")}
          </button>
          <button
            type="button"
            className={resultView === "constituency" ? "active" : ""}
            onClick={() => setResultView("constituency")}
          >
            {t(language, "constituencyView")}
          </button>
          <button
            type="button"
            className={resultView === "party" ? "active" : ""}
            onClick={() => setResultView("party")}
          >
            {t(language, "partyView")}
          </button>
          <button
            type="button"
            className={resultView === "geography" ? "active" : ""}
            onClick={() => setResultView("geography")}
          >
            {t(language, "geographyView")}
          </button>
          <button
            type="button"
            className={resultView === "proportional" ? "active" : ""}
            onClick={() => setResultView("proportional")}
          >
            {t(language, "proportionalView")}
          </button>
          {resultView === "party" ? (
            <label className="party-filter">
              {t(language, "filter")}:
              <select
                value={partyFilter}
                onChange={(event) => setPartyFilter(event.target.value as PartyFilter)}
              >
                <option value="all">{t(language, "allParties")}</option>
                <option value="leading">{t(language, "onLead")}</option>
                <option value="won">{t(language, "wins")}</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="badge-row">
          <LiveBadge />
        </div>
      </div>

      <div className="controls">
        <LastUpdated fetchedAtIso={dataset.fetchedAtIso} />
      </div>

      {resultView === "dashboard" ? (
        <>
          <section className="insights-board" aria-label={t(language, "seatSnapshot")}>
            <button
              type="button"
              className={`insight-card insight-button ${selectedInsight === "seats" ? "active" : ""}`}
              onClick={() => setSelectedInsight((prev) => (prev === "seats" ? null : "seats"))}
            >
              <span className="insight-label">{t(language, "seatSnapshot")}</span>
              <strong className="insight-value">
                {insights.seatsLeading} {t(language, "counting").toLowerCase()} · {insights.seatsWon}{" "}
                {t(language, "declared").toLowerCase()}
              </strong>
              <span className="insight-sub">
                {insights.seatsWithResults}/{insights.totalConstituencies} {t(language, "constituenciesWithResults")}
              </span>
            </button>

            <button
              type="button"
              className={`insight-card insight-button ${selectedInsight === "closest" ? "active" : ""}`}
              onClick={() => setSelectedInsight((prev) => (prev === "closest" ? null : "closest"))}
            >
              <span className="insight-label">{t(language, "closestRace")}</span>
              <strong className="insight-value">
                {insights.closestRace
                  ? `${insights.closestRace.margin.toLocaleString("en-US")} ${t(language, "votes")}`
                  : t(language, "pending")}
              </strong>
              <span className="insight-sub">
                {insights.closestRace
                  ? `${insights.closestRace.districtName} - ${insights.closestRace.constituencyName}`
                  : t(language, "noComparableRaceYet")}
              </span>
            </button>

            <button
              type="button"
              className={`insight-card insight-button ${selectedInsight === "highest" ? "active" : ""}`}
              onClick={() => setSelectedInsight((prev) => (prev === "highest" ? null : "highest"))}
            >
              <span className="insight-label">{t(language, "highestMargin")}</span>
              <strong className="insight-value">
                {insights.highestMargin
                  ? `${insights.highestMargin.margin.toLocaleString("en-US")} ${t(language, "votes")}`
                  : t(language, "pending")}
              </strong>
              <span className="insight-sub">
                {insights.highestMargin
                  ? `${insights.highestMargin.districtName} - ${insights.highestMargin.constituencyName}`
                  : t(language, "noResolvedMarginYet")}
              </span>
            </button>

            <button
              type="button"
              className={`insight-card insight-button ${selectedInsight === "leader" ? "active" : ""}`}
              onClick={() => setSelectedInsight((prev) => (prev === "leader" ? null : "leader"))}
            >
              <span className="insight-label">{t(language, "topVoteLeader")}</span>
              <strong className="insight-value">
                {insights.topVoteLeader ? insights.topVoteLeader.votes.toLocaleString("en-US") : t(language, "pending")}
              </strong>
              <span className="insight-sub">
                {insights.topVoteLeader
                  ? `${insights.topVoteLeader.candidateName} (${insights.topVoteLeader.partyName})`
                  : t(language, "noLeaderDataYet")}
              </span>
            </button>

            <button
              type="button"
              className={`insight-card insight-button ${selectedInsight === "competitive" ? "active" : ""}`}
              onClick={() => setSelectedInsight((prev) => (prev === "competitive" ? null : "competitive"))}
            >
              <span className="insight-label">{t(language, "mostCompetitiveDistrict")}</span>
              <strong className="insight-value">
                {insights.mostCompetitiveDistrict
                  ? `${Math.round(insights.mostCompetitiveDistrict.avgMargin).toLocaleString("en-US")} avg margin`
                  : t(language, "pending")}
              </strong>
              <span className="insight-sub">
                {insights.mostCompetitiveDistrict
                  ? `${insights.mostCompetitiveDistrict.districtName} (${insights.mostCompetitiveDistrict.racesCount} races)`
                  : t(language, "noDistrictComparisonYet")}
              </span>
            </button>
          </section>

          {selectedInsight === "seats" ? (
            <section className="party-section">
              <h2>{t(language, "seatSnapshotDetails")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "constituency")}</span>
                  <span>{t(language, "status")}</span>
                  <span>{t(language, "party")}</span>
                  <span>{t(language, "votes")}</span>
                </div>
                {seatDetails
                  .filter(
                    (row) =>
                      !normalizedSearch ||
                      row.district.toLowerCase().includes(normalizedSearch) ||
                      row.constituency.toLowerCase().includes(normalizedSearch) ||
                      row.party.toLowerCase().includes(normalizedSearch) ||
                      row.candidate.toLowerCase().includes(normalizedSearch)
                  )
                  .slice(0, 20)
                  .map((row) => (
                  <Link key={row.constituencySlug} href={`/constituency/${row.constituencySlug}`} className="province-party-row">
                    <span>
                      {row.district} - {row.constituency}
                    </span>
                    <span>{row.status === "won" ? t(language, "declared") : t(language, "counting")}</span>
                    <span>{row.party}</span>
                    <span>{row.votes.toLocaleString("en-US")}</span>
                  </Link>
                  ))}
              </div>
            </section>
          ) : null}

          {selectedInsight === "closest" ? (
            <section className="party-section">
              <h2>{t(language, "closestRaceDetails")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "constituency")}</span>
                  <span>{t(language, "margin")}</span>
                  <span>{t(language, "leadParty")}</span>
                  <span>{t(language, "candidate")}</span>
                </div>
                {searchedClosestRaces.map((race) => (
                  <Link
                    key={race.constituencySlug}
                    href={`/constituency/${race.constituencySlug}`}
                    className="province-party-row"
                  >
                    <span>
                      {race.district} - {race.constituency}
                    </span>
                    <span>{race.margin.toLocaleString("en-US")}</span>
                    <span>{race.leadParty}</span>
                    <span>{race.leadCandidate}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {selectedInsight === "highest" ? (
            <section className="party-section">
              <h2>{t(language, "highestMarginDetails")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "constituency")}</span>
                  <span>{t(language, "margin")}</span>
                  <span>{t(language, "leadParty")}</span>
                  <span>{t(language, "candidate")}</span>
                </div>
                {highestMarginRaces
                  .filter(
                    (race) =>
                      !normalizedSearch ||
                      race.district.toLowerCase().includes(normalizedSearch) ||
                      race.constituency.toLowerCase().includes(normalizedSearch) ||
                      race.leadParty.toLowerCase().includes(normalizedSearch) ||
                      race.leadCandidate.toLowerCase().includes(normalizedSearch)
                  )
                  .map((race) => (
                  <Link
                    key={`high-${race.constituencySlug}`}
                    href={`/constituency/${race.constituencySlug}`}
                    className="province-party-row"
                  >
                    <span>
                      {race.district} - {race.constituency}
                    </span>
                    <span>{race.margin.toLocaleString("en-US")}</span>
                    <span>{race.leadParty}</span>
                    <span>{race.leadCandidate}</span>
                  </Link>
                  ))}
              </div>
            </section>
          ) : null}

          {selectedInsight === "leader" ? (
            <section className="party-section">
              <h2>{t(language, "topVoteLeaderDetails")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "constituency")}</span>
                  <span>{t(language, "candidate")}</span>
                  <span>{t(language, "party")}</span>
                  <span>{t(language, "votes")}</span>
                </div>
                {topLeaders
                  .filter(
                    (row) =>
                      !normalizedSearch ||
                      row.district.toLowerCase().includes(normalizedSearch) ||
                      row.constituency.toLowerCase().includes(normalizedSearch) ||
                      row.party.toLowerCase().includes(normalizedSearch) ||
                      row.candidate.toLowerCase().includes(normalizedSearch)
                  )
                  .map((row) => (
                  <Link
                    key={`leader-${row.constituencySlug}`}
                    href={`/constituency/${row.constituencySlug}`}
                    className="province-party-row"
                  >
                    <span>
                      {row.district} - {row.constituency}
                    </span>
                    <span>{row.candidate}</span>
                    <span>{row.party}</span>
                    <span>{row.votes.toLocaleString("en-US")}</span>
                  </Link>
                  ))}
              </div>
            </section>
          ) : null}

          {selectedInsight === "competitive" ? (
            <section className="party-section">
              <h2>{t(language, "mostCompetitiveDistrictDetails")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "constituency")}</span>
                  <span>{t(language, "margin")}</span>
                  <span>{t(language, "leadParty")}</span>
                  <span>{t(language, "candidate")}</span>
                </div>
                {competitiveDistrictRaces.length > 0 ? (
                  competitiveDistrictRaces
                    .filter(
                      (race) =>
                        !normalizedSearch ||
                        race.district.toLowerCase().includes(normalizedSearch) ||
                        race.constituency.toLowerCase().includes(normalizedSearch) ||
                        race.leadParty.toLowerCase().includes(normalizedSearch) ||
                        race.leadCandidate.toLowerCase().includes(normalizedSearch)
                    )
                    .map((race) => (
                    <Link
                      key={`comp-${race.constituencySlug}`}
                      href={`/constituency/${race.constituencySlug}`}
                      className="province-party-row"
                    >
                      <span>
                        {race.district} - {race.constituency}
                      </span>
                      <span>{race.margin.toLocaleString("en-US")}</span>
                      <span>{race.leadParty}</span>
                      <span>{race.leadCandidate}</span>
                    </Link>
                    ))
                ) : (
                  <div className="province-party-empty">{t(language, "noCompetitiveDistrictDetails")}</div>
                )}
              </div>
            </section>
          ) : null}

          <section className="random-constituency-section" aria-label="Random constituency spotlight">
            <h2>{t(language, "randomConstituencySpotlight")}</h2>
            <div className="random-constituency-grid">
              {randomConstituencies.map((constituency) => (
                <Link
                  key={`random-${constituency.constituencySlug}`}
                  href={`/constituency/${constituency.constituencySlug}`}
                  className="random-constituency-card"
                >
                  <div className="random-constituency-title">
                    {constituency.districtName} - {constituency.constituencyName}
                  </div>
                  {(constituency.topCandidates ?? []).slice(0, 3).map((candidate, index) => (
                    <div
                      key={`${constituency.constituencySlug}-${candidate.candidateName}-${index}`}
                      className="random-constituency-row"
                    >
                      <span>
                        {index + 1}. {candidate.candidateName}
                        {candidate.status === "won" ? <span className="winner-check" aria-label="Won constituency"> ✓</span> : null}{" "}
                        ({candidate.partyName})
                      </span>
                      <span className="random-candidate-right">
                        {candidate.partyLogoUrl ? (
                          <img
                            className="random-candidate-logo"
                            src={candidate.partyLogoUrl}
                            alt={`${candidate.partyName} logo`}
                          />
                        ) : null}
                        <span>{candidate.votes.toLocaleString("en-US")}</span>
                      </span>
                    </div>
                  ))}
                  <div className="random-load-track" aria-hidden="true">
                    <div className="random-load-fill" style={{ width: `${Math.round(randomCycleProgress * 100)}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <CountdownBar elapsedMs={elapsedMs} totalMs={totalMs} />

      <div className={`content-layout ${resultView !== "constituency" || normalizedSearch ? "party-no-sidebar" : ""}`}>
        {resultView === "constituency" && !normalizedSearch ? (
          <aside className="district-sidebar" aria-label="Manual district navigation">
            <div className="sidebar-title">{t(language, "districts")}</div>
            <input
              type="search"
              className="district-search-input"
              value={districtSearchTerm}
              onChange={(event) => setDistrictSearchTerm(event.target.value)}
              placeholder={t(language, "districtSearchPlaceholder")}
              aria-label={t(language, "districtSearchPlaceholder")}
            />
            <div className="district-list">
              {filteredDistricts.length > 0 ? (
                filteredDistricts.map((item) => (
                  <button
                    key={item.districtSlug}
                    type="button"
                    className={`district-item ${item.districtSlug === district.districtSlug ? "active" : ""}`}
                    onClick={() => onJumpToDistrict(item.districtSlug)}
                  >
                    {item.districtName}
                  </button>
                ))
              ) : (
                <div className="district-empty">{t(language, "noDistrictsMatchSearch")}</div>
              )}
            </div>
          </aside>
        ) : null}

        {resultView === "constituency" ? (
          <section className="grid">
            {displayedConstituencies.length > 0 ? (
              displayedConstituencies.map((constituency) => (
                <ConstituencyCard key={constituency.constituencySlug} constituency={constituency} />
              ))
            ) : (
              <article className="constituency-card">{t(language, "noConstituencyLevelResult")}</article>
            )}
          </section>
        ) : resultView === "party" ? (
          <section className="party-grid">
            {searchedPartySummaries.length > 0 ? (
              searchedPartySummaries.map((party) => (
                <Link
                  key={party.partyName}
                  href={`/party/${partySlugify(party.partyName)}`}
                  prefetch={false}
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
                      <span>{t(language, "leading")}: {party.leadingCount}</span>
                      <span>{t(language, "wins")}: {party.wonCount}</span>
                      <span>{t(language, "secondPlace")}: {party.secondPlaceCount}</span>
                      <span>{t(language, "totalVotes")}: {party.totalVotes.toLocaleString("en-US")}</span>
                      <span>{t(language, "leadVotes")}: {party.totalLeadVotes.toLocaleString("en-US")}</span>
                    </div>
                  </article>
                </Link>
              ))
            ) : (
              <article className="constituency-card">{t(language, "noPartiesMatchFilter")}</article>
            )}
          </section>
        ) : resultView === "geography" ? (
          <section className="geography-grid">
            {searchedProvinceGroups.map((provinceGroup) => (
              <article key={provinceGroup.province} className="province-card">
                <h3>
                  {provinceGroup.province}{" "}
                  <span>
                    ({provinceGroup.districts.length} districts, {provinceGroup.constituencyCount} constituencies)
                  </span>
                </h3>
                <div className="province-party-summary">
                  <div className="province-party-head">
                    <span>Party</span>
                    <span>Lead</span>
                    <span>Won</span>
                    <span>Second</span>
                  </div>
                  {provinceGroup.partyStats.length > 0 ? (
                    provinceGroup.partyStats.slice(0, 12).map((party) => (
                      <div key={`${provinceGroup.province}-${party.partyName}`} className="province-party-row">
                        <span>{party.partyName}</span>
                        <span>{party.leadingCount}</span>
                        <span>{party.wonCount}</span>
                        <span>{party.secondPlaceCount}</span>
                      </div>
                    ))
                  ) : (
                    <div className="province-party-empty">{t(language, "noPartyStandingsProvince")}</div>
                  )}
                </div>
                <Link href={`/province/${provinceSlugify(provinceGroup.province)}`} className="province-open-link">
                  {t(language, "openProvinceDetails")}
                </Link>
              </article>
            ))}
          </section>
        ) : resultView === "proportional" ? (
          <section className="party-grid">
            <article className="party-section">
              <h2>{t(language, "proportionalStandings")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "party")}</span>
                  <span>{t(language, "votes")}</span>
                  <span>{t(language, "voteShare")}</span>
                </div>
                {searchedNationalProportionalRows.length > 0 ? (
                  searchedNationalProportionalRows.map((row) => (
                    <div key={`pr-national-${row.partyName}`} className="province-party-row">
                      <span className="dashboard-party-cell">
                        {row.partyLogoUrl ? (
                          <img className="dashboard-party-logo" src={row.partyLogoUrl} alt={`${row.partyName} logo`} />
                        ) : null}
                        <span>{row.partyName}</span>
                      </span>
                      <span>{row.votes.toLocaleString("en-US")}</span>
                      <span>{row.voteShare.toFixed(2)}%</span>
                    </div>
                  ))
                ) : (
                  <div className="province-party-empty">{t(language, "noProportionalData")}</div>
                )}
              </div>
            </article>
          </section>
        ) : (
          <section className="party-grid">
            <article className="party-section">
              <h2>{t(language, "partyStandings")}</h2>
              <div className="province-party-summary wide-table dashboard-table">
                <div className="province-party-head">
                  <span>{t(language, "party")}</span>
                  <span>{t(language, "leading")}</span>
                  <span>{t(language, "wins")}</span>
                  <span>{t(language, "secondPlace")}</span>
                </div>
                {searchedDashboardStandingParties.map((party) => (
                  <Link
                    key={party.partyName}
                    href={`/party/${partySlugify(party.partyName)}`}
                    prefetch={false}
                    className="province-party-row"
                  >
                    <span className="dashboard-party-cell">
                      {party.partyLogoUrl ? (
                        <img className="dashboard-party-logo" src={party.partyLogoUrl} alt={`${party.partyName} logo`} />
                      ) : null}
                      <span>{party.partyName}</span>
                    </span>
                    <span>{party.leadingCount}</span>
                    <span>{party.wonCount}</span>
                    <span>{party.secondPlaceCount}</span>
                  </Link>
                ))}
              </div>
            </article>

            <article className="party-section">
              <h2>{t(language, "closestRace")}</h2>
              <div className="province-party-summary wide-table closest-races-table">
                <div className="province-party-head closest-races-head">
                  <span>{t(language, "race")}</span>
                  <span>{t(language, "margin")}</span>
                  <span>{t(language, "leadParty")}</span>
                  <span>{t(language, "candidate")}</span>
                </div>
                {searchedClosestRaces.map((race) => (
                  <Link
                    key={`${race.district}-${race.constituency}`}
                    href={`/constituency/${race.constituencySlug}`}
                    className="province-party-row closest-races-row"
                  >
                    <span>
                      {race.district} - {race.constituency}
                    </span>
                    <span>{race.margin.toLocaleString("en-US")}</span>
                    <span>{race.leadParty}</span>
                    <span>{race.leadCandidate}</span>
                  </Link>
                ))}
              </div>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
