"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { PartyConstituencyFilters } from "@/components/PartyConstituencyFilters";
import { filterExcludedDistricts } from "@/lib/districtFilters";
import { ConstituencyResult, ElectionDataset } from "@/lib/types";

interface PartyPageClientProps {
  partySlug: string;
  initialPartyName: string;
  initialLeading: ConstituencyResult[];
  initialWon: ConstituencyResult[];
  initialSecond: ConstituencyResult[];
}

function partySlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPartyData(allConstituencies: ConstituencyResult[], partySlug: string): {
  partyName: string;
  leading: ConstituencyResult[];
  won: ConstituencyResult[];
  second: ConstituencyResult[];
} {
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

  return { partyName, leading, won, second };
}

export function PartyPageClient({
  partySlug,
  initialPartyName,
  initialLeading,
  initialWon,
  initialSecond
}: PartyPageClientProps): React.JSX.Element {
  const [partyName, setPartyName] = useState(initialPartyName);
  const [leading, setLeading] = useState(initialLeading);
  const [won, setWon] = useState(initialWon);
  const [second, setSecond] = useState(initialSecond);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestPartyData(): Promise<void> {
      try {
        const response = await fetch("/api/results", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const dataset = (await response.json()) as ElectionDataset;
        const districts = filterExcludedDistricts(dataset.districts);
        const allConstituencies = districts.flatMap((district) => district.constituencies);
        const next = buildPartyData(allConstituencies, partySlug);
        const hasRows = next.leading.length + next.won.length + next.second.length > 0;
        if (!cancelled && hasRows) {
          setPartyName(next.partyName);
          setLeading(next.leading);
          setWon(next.won);
          setSecond(next.second);
        }
      } catch {
        // Keep initial SSR data when refresh fails.
      }
    }

    void loadLatestPartyData();
    return () => {
      cancelled = true;
    };
  }, [partySlug]);

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
