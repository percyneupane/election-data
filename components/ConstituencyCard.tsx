import { ConstituencyResult } from "@/lib/types";
import { AnimatedNumber } from "@/components/AnimatedNumber";

interface ConstituencyCardProps {
  constituency: ConstituencyResult;
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

export function ConstituencyCard({ constituency }: ConstituencyCardProps): React.JSX.Element {
  const lead = constituency.leadingCandidate;
  const isWonSeat = lead?.status === "won";
  const candidates = constituency.topCandidates ?? [];
  const numberFromName = constituency.constituencyName.match(/(\d+)\s*$/)?.[1];
  const numberFromSlug = constituency.constituencySlug.match(/-(\d+)$/)?.[1];
  const constituencyNumber = numberFromName ?? numberFromSlug;
  const cardConstituencyLabel = constituencyNumber ? constituencyNumber : constituency.constituencyName;

  return (
    <article className="constituency-card">
      <div className="card-title-row">
        <h3 className="card-title">
          <span className="card-district-name">{constituency.districtName}</span>
          <span className="card-separator"> - </span>
          <span className="card-constituency-name">{cardConstituencyLabel}</span>
        </h3>
        {typeof constituency.leadMargin === "number" ? (
          <span className="margin">Lead margin: {constituency.leadMargin.toLocaleString("en-US")}</span>
        ) : (
          <span className="margin">Lead margin: pending</span>
        )}
      </div>

      {lead ? (
        <div className="lead-row">
          <span className="candidate-main">
            <span className="candidate-face" aria-hidden="true">
              {initialsFromName(lead.candidateName)}
            </span>
            <span>
              <strong>
                {lead.candidateName}
                {isWonSeat ? <span className="winner-check" aria-label="Won constituency"> ✓</span> : null}
              </strong>{" "}
              ({lead.partyName})
            </span>
          </span>
          <span className="candidate-right">
            {lead.partyLogoUrl ? (
              <img className="candidate-party-logo" src={lead.partyLogoUrl} alt={`${lead.partyName} logo`} />
            ) : null}
            <strong>
              <AnimatedNumber value={lead.votes} />
            </strong>
          </span>
        </div>
      ) : (
        <div className="runner-row">Result is pending.</div>
      )}

      {candidates.length > 0 ? (
        <div className="candidate-list">
          {candidates.map((candidate, index) => (
            <div key={`${constituency.constituencySlug}-${candidate.candidateName}-${index}`} className="candidate-row">
              <span className="candidate-main">
                <span className="candidate-rank">{index + 1}.</span>
                <span className="candidate-face" aria-hidden="true">
                  {initialsFromName(candidate.candidateName)}
                </span>
                <span>
                  <strong>{candidate.candidateName}</strong> ({candidate.partyName})
                </span>
              </span>
              <span className="candidate-right">
                {candidate.partyLogoUrl ? (
                  <img className="candidate-party-logo" src={candidate.partyLogoUrl} alt={`${candidate.partyName} logo`} />
                ) : null}
                <span>
                  <AnimatedNumber value={candidate.votes} />
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="runner-row">Candidate list unavailable.</div>
      )}

    </article>
  );
}
