import { ElectionDataset } from "@/lib/types";

export const fallbackResults: ElectionDataset = {
  source: "https://election.ekantipur.com/?lng=eng",
  sourceLabel: "Ekantipur Election (Fallback Mock Data)",
  fetchedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
  stale: true,
  fallbackUsed: true,
  scrapeErrors: ["Live source unavailable. Showing fallback development data."],
  districts: [
    {
      districtSlug: "kathmandu",
      districtName: "Kathmandu",
      province: "Bagmati",
      updatedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
      constituencies: [
        {
          constituencySlug: "kathmandu-1",
          constituencyName: "Kathmandu - 1",
          districtSlug: "kathmandu",
          districtName: "Kathmandu",
          province: "Bagmati",
          sourceUrl: "https://election.ekantipur.com/constituency/kathmandu-1",
          updatedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
          leadMargin: 1684,
          topCandidates: [
            {
              candidateName: "Candidate A",
              partyName: "Party X",
              votes: 28412,
              status: "leading"
            },
            {
              candidateName: "Candidate B",
              partyName: "Party Y",
              votes: 26728,
              status: "trailing"
            }
          ],
          leadingCandidate: {
            candidateName: "Candidate A",
            partyName: "Party X",
            votes: 28412,
            status: "leading"
          },
          runnerUp: {
            candidateName: "Candidate B",
            partyName: "Party Y",
            votes: 26728,
            status: "trailing"
          }
        },
        {
          constituencySlug: "kathmandu-2",
          constituencyName: "Kathmandu - 2",
          districtSlug: "kathmandu",
          districtName: "Kathmandu",
          province: "Bagmati",
          sourceUrl: "https://election.ekantipur.com/constituency/kathmandu-2",
          updatedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
          leadMargin: 935,
          topCandidates: [
            {
              candidateName: "Candidate C",
              partyName: "Party Z",
              votes: 31106,
              status: "won"
            },
            {
              candidateName: "Candidate D",
              partyName: "Party X",
              votes: 30171,
              status: "trailing"
            }
          ],
          leadingCandidate: {
            candidateName: "Candidate C",
            partyName: "Party Z",
            votes: 31106,
            status: "won"
          },
          runnerUp: {
            candidateName: "Candidate D",
            partyName: "Party X",
            votes: 30171,
            status: "trailing"
          }
        }
      ]
    },
    {
      districtSlug: "jhapa",
      districtName: "Jhapa",
      province: "Koshi",
      updatedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
      constituencies: [
        {
          constituencySlug: "jhapa-5",
          constituencyName: "Jhapa - 5",
          districtSlug: "jhapa",
          districtName: "Jhapa",
          province: "Koshi",
          sourceUrl: "https://election.ekantipur.com/constituency/jhapa-5",
          updatedAtIso: new Date("2026-03-05T12:00:00.000Z").toISOString(),
          leadMargin: 254,
          topCandidates: [
            {
              candidateName: "Top Candidate",
              partyName: "Party A",
              votes: 23344,
              status: "leading"
            },
            {
              candidateName: "Second Candidate",
              partyName: "Party B",
              votes: 23090,
              status: "trailing"
            }
          ],
          leadingCandidate: {
            candidateName: "Top Candidate",
            partyName: "Party A",
            votes: 23344,
            status: "leading"
          },
          runnerUp: {
            candidateName: "Second Candidate",
            partyName: "Party B",
            votes: 23090,
            status: "trailing"
          }
        }
      ]
    }
  ]
};
