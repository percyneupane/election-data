"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DistrictSlide } from "@/components/DistrictSlide";
import { LanguagePrompt } from "@/components/LanguagePrompt";
import { fallbackResults } from "@/data/fallback-results";
import { AppLanguage, t } from "@/lib/i18n";
import { filterExcludedDistricts } from "@/lib/districtFilters";
import { DistrictResult, ElectionDataset } from "@/lib/types";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const DISPLAY_MS = 10_000;
const POLL_MS = 60_000;

function pickRandomIndex(
  districts: DistrictResult[],
  currentIndex: number,
  seenSlugs: Set<string>
): number {
  if (districts.length <= 1) {
    return 0;
  }

  const unseen = districts
    .map((district, index) => ({ district, index }))
    .filter(({ district, index }) => index !== currentIndex && !seenSlugs.has(district.districtSlug));

  if (unseen.length > 0) {
    const pick = unseen[Math.floor(Math.random() * unseen.length)];
    return pick.index;
  }

  seenSlugs.clear();

  const candidates = districts
    .map((district, index) => ({ district, index }))
    .filter(({ index }) => index !== currentIndex);

  const random = candidates[Math.floor(Math.random() * candidates.length)];
  return random.index;
}

function buildTicker(districts: DistrictResult[], language: AppLanguage): string {
  const rows = districts
    .flatMap((district) =>
      district.constituencies.slice(0, 1).map((constituency) => {
        const lead = constituency.leadingCandidate;
        if (!lead || lead.votes <= 0) {
          return null;
        }

        return `${district.districtName} - ${constituency.constituencyName}: ${lead.partyName} ${t(language, "leading").toLowerCase()} (${lead.votes.toLocaleString("en-US")})`;
      })
    )
    .filter((row): row is string => Boolean(row))
    .slice(0, 18);

  if (rows.length === 0) {
    return t(language, "pending");
  }

  return rows.join("  |  ");
}

export default function HomePage(): React.JSX.Element {
  const { language, isReady, hasSelection, setLanguagePreference } = useLanguagePreference();
  const [dataset, setDataset] = useState<ElectionDataset>(fallbackResults);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(Date.now());
  const seenDistrictsRef = useRef(new Set<string>());

  const filteredDataset = useMemo(
    () => ({ ...dataset, districts: filterExcludedDistricts(dataset.districts) }),
    [dataset]
  );
  const districts = useMemo(() => {
    if (filteredDataset.districts.length > 0) {
      return filteredDataset.districts;
    }
    if (dataset.districts.length > 0) {
      return dataset.districts;
    }
    return fallbackResults.districts;
  }, [dataset.districts, filteredDataset.districts]);
  const displayDataset = useMemo(() => ({ ...filteredDataset, districts }), [districts, filteredDataset]);

  const currentDistrict = useMemo(() => {
    if (districts.length === 0) {
      return null;
    }
    return districts[Math.min(currentIndex, districts.length - 1)];
  }, [currentIndex, districts]);

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch("/api/results", { cache: "no-store" });
      const nextData = (await response.json()) as ElectionDataset;

      if (nextData.districts.length > 0) {
        setDataset(nextData);
        setCurrentIndex((prev) => Math.min(prev, nextData.districts.length - 1));
      }

      if (!response.ok) {
        setError(`Data source temporarily unavailable (${response.status}). Showing last available data.`);
      } else {
        setError(null);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unknown fetch error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const jumpToDistrict = useCallback(
    (districtSlug: string) => {
      const index = districts.findIndex((district) => district.districtSlug === districtSlug);
      if (index >= 0) {
        setCurrentIndex(index);
        startedAtRef.current = Date.now();
        setElapsedMs(0);
        seenDistrictsRef.current.add(districtSlug);
      }
    },
    [districts]
  );

  useEffect(() => {
    void fetchResults();
    const pollId = setInterval(() => void fetchResults(), POLL_MS);
    return () => clearInterval(pollId);
  }, [fetchResults]);

  useEffect(() => {
    if (!autoPlay) {
      setElapsedMs(0);
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(Math.min(elapsed, DISPLAY_MS));

      if (elapsed < DISPLAY_MS || districts.length === 0) {
        return;
      }

      setCurrentIndex((prev) => {
        const active = districts[Math.min(prev, districts.length - 1)];
        if (active) {
          seenDistrictsRef.current.add(active.districtSlug);
        }

        return pickRandomIndex(districts, prev, seenDistrictsRef.current);
      });

      startedAtRef.current = Date.now();
      setElapsedMs(0);
    }, 100);

    return () => clearInterval(timer);
  }, [autoPlay, districts]);

  if (isLoading && districts.length === 0) {
    return <div className="loading">Loading election results...</div>;
  }

  if (!currentDistrict) {
    return <div className="loading">Loading election results...</div>;
  }

  return (
    <div className="app-shell">
      <DistrictSlide
        district={currentDistrict}
        dataset={displayDataset}
        elapsedMs={elapsedMs}
        totalMs={DISPLAY_MS}
        districts={districts}
        language={language}
        onLanguageChange={setLanguagePreference}
        onJumpToDistrict={jumpToDistrict}
        autoPlay={autoPlay}
        onToggleAutoPlay={() => {
          setAutoPlay((prev) => {
            const next = !prev;
            if (next) {
              startedAtRef.current = Date.now();
              setElapsedMs(0);
            }
            return next;
          });
        }}
      />

      <div className="ticker" aria-label="Major party lead ticker">
        <div className="ticker-track">{buildTicker(districts, language)}</div>
      </div>
      {isReady && !hasSelection ? <LanguagePrompt language={language} onChoose={setLanguagePreference} /> : null}
    </div>
  );
}
