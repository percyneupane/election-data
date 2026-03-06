"use client";

import { useState } from "react";
import { ConstituencyCard } from "@/components/ConstituencyCard";
import { ConstituencyResult } from "@/lib/types";

type PartyDetailView = "leading" | "won" | "second";

interface PartyConstituencyFiltersProps {
  leading: ConstituencyResult[];
  won: ConstituencyResult[];
  second: ConstituencyResult[];
}

export function PartyConstituencyFilters({
  leading,
  won,
  second
}: PartyConstituencyFiltersProps): React.JSX.Element {
  const defaultView: PartyDetailView =
    leading.length > 0 ? "leading" : won.length > 0 ? "won" : "second";
  const [view, setView] = useState<PartyDetailView>(defaultView);

  const activeList = view === "leading" ? leading : view === "won" ? won : second;

  return (
    <section className="party-section">
      <div className="party-filter-row">
        <button
          type="button"
          className={`party-tab ${view === "leading" ? "active" : ""}`}
          onClick={() => setView("leading")}
        >
          Leading ({leading.length})
        </button>
        <button
          type="button"
          className={`party-tab ${view === "won" ? "active" : ""}`}
          onClick={() => setView("won")}
        >
          Won ({won.length})
        </button>
        <button
          type="button"
          className={`party-tab ${view === "second" ? "active" : ""}`}
          onClick={() => setView("second")}
        >
          Second Place ({second.length})
        </button>
      </div>

      <div className="grid">
        {activeList.length > 0 ? (
          activeList.map((constituency) => (
            <ConstituencyCard key={`${view}-${constituency.constituencySlug}`} constituency={constituency} />
          ))
        ) : (
          <article className="constituency-card">No constituencies for this filter.</article>
        )}
      </div>
    </section>
  );
}

