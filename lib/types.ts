export type ElectionStatus = "leading" | "won" | "trailing" | "unknown";

export interface CandidateResult {
  candidateName: string;
  partyName: string;
  partyLogoUrl?: string;
  votes: number;
  status: ElectionStatus;
  deltaFromLeader?: number;
}

export interface ConstituencyResult {
  constituencySlug: string;
  constituencyName: string;
  districtSlug: string;
  districtName: string;
  province: string;
  topCandidates: CandidateResult[];
  leadingCandidate?: CandidateResult;
  runnerUp?: CandidateResult;
  leadMargin?: number;
  updatedAtIso: string;
  sourceUrl: string;
}

export interface DistrictResult {
  districtSlug: string;
  districtName: string;
  province: string;
  constituencies: ConstituencyResult[];
  updatedAtIso: string;
}

export interface ProportionalPartyResult {
  partyName: string;
  partyLogoUrl?: string;
  votes: number;
  partyUrl?: string;
}

export interface ProportionalResults {
  title: string;
  sourceUrl: string;
  updatedAtIso: string;
  parties: ProportionalPartyResult[];
}

export interface ElectionDataset {
  source: string;
  sourceLabel: string;
  fetchedAtIso: string;
  districts: DistrictResult[];
  proportionalResults?: ProportionalResults;
  scrapeErrors: string[];
  stale: boolean;
  fallbackUsed: boolean;
}
