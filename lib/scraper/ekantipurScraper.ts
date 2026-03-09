import { load } from "cheerio";
import { provinceFromDistrictSlug, seedDistricts } from "@/lib/scraper/seedDistricts";
import {
  CandidateResult,
  ConstituencyResult,
  DistrictResult,
  ElectionDataset,
  ElectionStatus,
  ProportionalResults
} from "@/lib/types";

const BASE_URL = "https://election.ekantipur.com";
const HOME_URL = `${BASE_URL}/?lng=eng`;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_DISTRICT_PAGES = 120;
const MAX_CONCURRENCY = 8;

const PROVINCE_LABELS: Record<string, string> = {
  "1": "Koshi",
  "2": "Madhesh",
  "3": "Bagmati",
  "4": "Gandaki",
  "5": "Lumbini",
  "6": "Karnali",
  "7": "Sudurpashchim"
};

const PROVINCE_CODE_FROM_NAME: Record<string, string> = {
  Koshi: "1",
  Madhesh: "2",
  Bagmati: "3",
  Gandaki: "4",
  Lumbini: "5",
  Karnali: "6",
  Sudurpashchim: "7"
};

interface DistrictIndexEntry {
  districtSlug: string;
  districtName: string;
  provinceCode: string;
  province: string;
  constituencyCount: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeQueryAndHash(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/\/$/, "");
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return removeQueryAndHash(href);
  }
  if (href.startsWith("/")) {
    return removeQueryAndHash(`${BASE_URL}${href}`);
  }
  return removeQueryAndHash(`${BASE_URL}/${href}`);
}

function normalizeImageUrl(src: string | undefined): string | undefined {
  if (!src) {
    return undefined;
  }
  const trimmed = src.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("data:")) {
    return undefined;
  }
  return toAbsoluteUrl(trimmed);
}

function slugFromConstituencyUrl(url: string): string | null {
  const normalized = removeQueryAndHash(url);
  const newRouteMatch = normalized.match(
    /\/pradesh-\d+\/district-([a-z0-9-]+)\/constituency-(\d+)/i
  );
  if (newRouteMatch?.[1] && newRouteMatch[2]) {
    return `${newRouteMatch[1].toLowerCase()}-${newRouteMatch[2]}`;
  }

  const legacyMatch = normalized.match(/\/constituency\/([a-z0-9-]+)/i);
  return legacyMatch?.[1]?.toLowerCase() ?? null;
}

function districtFromConstituencySlug(constituencySlug: string): string {
  return constituencySlug.replace(/-\d+$/, "");
}

function districtNameFromSlug(districtSlug: string): string {
  return districtSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function inferStatusFromText(raw: string): ElectionStatus {
  const value = raw.toLowerCase();
  if (value.includes("won") || value.includes("elected")) {
    return "won";
  }
  if (value.includes("lead") || value.includes("leading")) {
    return "leading";
  }
  if (value.includes("trail") || value.includes("behind")) {
    return "trailing";
  }
  return "unknown";
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while requesting ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  mapper: (value: T, index: number) => Promise<R>,
  concurrency = MAX_CONCURRENCY
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let current = 0;

  const workers = new Array(Math.min(concurrency, values.length)).fill(0).map(async () => {
    while (current < values.length) {
      const index = current;
      current += 1;
      results[index] = await mapper(values[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function extractDistrictIndexFromScripts(html: string): DistrictIndexEntry[] {
  const districtMeta = new Map<
    string,
    { districtName: string; provinceCode: string; province: string; constituencyCount: number }
  >();

  const districtOptionRegex =
    /pradeshdistricts\['(\d+)'\]\s*\+=\s*'<option value="([a-z0-9-]+)">([^<]+)<\/option>'/gi;
  let districtMatch = districtOptionRegex.exec(html);
  while (districtMatch) {
    const [, provinceCode, districtSlugRaw, districtNameRaw] = districtMatch;
    const districtSlug = districtSlugRaw.toLowerCase();
    districtMeta.set(districtSlug, {
      districtName: normalizeWhitespace(districtNameRaw),
      provinceCode,
      province: PROVINCE_LABELS[provinceCode] ?? "Unknown Province",
      constituencyCount: 0
    });
    districtMatch = districtOptionRegex.exec(html);
  }

  const constituencyCountRegex = /regions\['([a-z0-9-]+)'\]\s*=\s*(\d+)/gi;
  let countMatch = constituencyCountRegex.exec(html);
  while (countMatch) {
    const [, districtSlugRaw, countRaw] = countMatch;
    const districtSlug = districtSlugRaw.toLowerCase();
    const existing = districtMeta.get(districtSlug);
    const constituencyCount = Number(countRaw);
    if (existing) {
      existing.constituencyCount = constituencyCount;
      districtMeta.set(districtSlug, existing);
    } else {
      districtMeta.set(districtSlug, {
        districtName: districtNameFromSlug(districtSlug),
        provinceCode: "",
        province: provinceFromDistrictSlug.get(districtSlug) ?? "Unknown Province",
        constituencyCount
      });
    }
    countMatch = constituencyCountRegex.exec(html);
  }

  for (const district of seedDistricts) {
    if (!districtMeta.has(district.districtSlug)) {
      districtMeta.set(district.districtSlug, {
        districtName: district.districtName,
        provinceCode: PROVINCE_CODE_FROM_NAME[district.province] ?? "",
        province: district.province,
        constituencyCount: 0
      });
    }
  }

  return [...districtMeta.entries()]
    .map(([districtSlug, value]) => ({ districtSlug, ...value }))
    .sort((a, b) => a.districtName.localeCompare(b.districtName));
}

function extractDistrictSlugsAndConstituencies(homeHtml: string): {
  districtIndex: DistrictIndexEntry[];
  districtSlugs: Set<string>;
  constituencyUrls: Set<string>;
} {
  const districtIndex = extractDistrictIndexFromScripts(homeHtml);
  const districtSlugs = new Set<string>(districtIndex.map((entry) => entry.districtSlug));
  const constituencyUrls = new Set<string>();
  const $ = load(homeHtml);

  $("a[href]").each((_, element) => {
    const href = String($(element).attr("href") ?? "");
    if (!href) {
      return;
    }

    const absolute = toAbsoluteUrl(href);

    const districtMatch = absolute.match(/\/district-([a-z0-9-]+)/i);
    if (districtMatch?.[1]) {
      districtSlugs.add(districtMatch[1].toLowerCase());
    }

    if (absolute.includes("/constituency-") || absolute.includes("/constituency/")) {
      constituencyUrls.add(absolute);
    }
  });

  const legacyRouteMatches =
    homeHtml.match(/\/(district|constituency)\/([a-z0-9-]+)(?:\?lng=[a-z]+)?/gi) ?? [];
  for (const match of legacyRouteMatches) {
    const normalized = match.toLowerCase();
    if (normalized.startsWith("/district/")) {
      districtSlugs.add(normalized.replace("/district/", "").replace(/\?lng=[a-z]+$/, ""));
    }
    if (normalized.startsWith("/constituency/")) {
      constituencyUrls.add(toAbsoluteUrl(normalized));
    }
  }

  const modernRouteMatches =
    homeHtml.match(/\/pradesh-\d+\/district-[a-z0-9-]+\/constituency-\d+(?:\?lng=[a-z]+)?/gi) ?? [];
  for (const match of modernRouteMatches) {
    constituencyUrls.add(toAbsoluteUrl(match.toLowerCase()));
  }

  for (const district of districtIndex) {
    if (district.constituencyCount <= 0 || !district.provinceCode) {
      continue;
    }
    for (let index = 1; index <= district.constituencyCount; index += 1) {
      constituencyUrls.add(
        `${BASE_URL}/pradesh-${district.provinceCode}/district-${district.districtSlug}/constituency-${index}`
      );
    }
  }

  return { districtIndex, districtSlugs, constituencyUrls };
}

function extractConstituencyUrlsFromDistrictPage(
  html: string,
  districtSlug?: string,
  provinceCode?: string
): { urls: string[]; constituencyCount?: number } {
  const $ = load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = String($(element).attr("href") ?? "");
    if (!href.includes("/constituency/")) {
      return;
    }
    urls.add(toAbsoluteUrl(href));
  });

  const regexMatches = html.match(/\/constituency\/([a-z0-9-]+)/gi) ?? [];
  for (const match of regexMatches) {
    urls.add(toAbsoluteUrl(match.toLowerCase()));
  }

  const modernRouteMatches =
    html.match(/\/pradesh-\d+\/district-[a-z0-9-]+\/constituency-\d+(?:\?lng=[a-z]+)?/gi) ?? [];
  for (const match of modernRouteMatches) {
    urls.add(toAbsoluteUrl(match.toLowerCase()));
  }

  let constituencyCount: number | undefined;
  if (districtSlug) {
    const escaped = districtSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const countRegex = new RegExp(`regions\\['${escaped}'\\]\\s*=\\s*(\\d+)`, "i");
    const match = html.match(countRegex);
    if (match?.[1]) {
      constituencyCount = Number(match[1]);
    }
  }

  if (districtSlug && provinceCode && constituencyCount && constituencyCount > 0) {
    for (let index = 1; index <= constituencyCount; index += 1) {
      urls.add(`${BASE_URL}/pradesh-${provinceCode}/district-${districtSlug}/constituency-${index}`);
    }
  }

  return { urls: [...urls], constituencyCount };
}

function parseCandidates($: ReturnType<typeof load>): CandidateResult[] {
  const tableCandidates: CandidateResult[] = [];

  $("table tbody tr").each((_, element) => {
    const row = $(element);
    const candidateName = normalizeWhitespace(
      row.find(".candidate-name-link span").first().text() ||
        row.find("td").first().find("span").last().text()
    );
    const partyName = normalizeWhitespace(
      row.find(".party-name").first().text() || row.find("td").eq(1).find("span").last().text()
    );
    const partyLogoUrl = normalizeImageUrl(row.find("td").eq(1).find("img").first().attr("src"));

    const voteContainer = row.find(".votecount").first();
    const voteText = normalizeWhitespace(voteContainer.find("p").first().text());
    const deltaText = normalizeWhitespace(voteContainer.find("span").first().text());
    const votes = /\d/.test(voteText) ? parseNumber(voteText) : parseNumber(deltaText);
    const deltaFromLeader = /\d/.test(deltaText) ? parseNumber(deltaText) : undefined;
    const status = inferStatusFromText(`${voteContainer.attr("class") ?? ""} ${voteContainer.text()}`);

    if (!candidateName) {
      return;
    }

    tableCandidates.push({
      candidateName,
      partyName: partyName || "Independent/Unknown",
      partyLogoUrl,
      votes,
      status,
      deltaFromLeader
    });
  });

  if (tableCandidates.length > 0) {
    return tableCandidates;
  }

  const candidates: CandidateResult[] = [];

  $("li, tr, .candidate, .candidate-list-item").each((_, element) => {
    const root = $(element);

    const candidateName = normalizeWhitespace(
      root.find(".candidate-name, h6, h5, h4, .name, .cand-name").first().text()
    );

    const partyName = normalizeWhitespace(
      root.find(".candidate-party-name, .party-name, p, .party").first().text()
    );
    const partyLogoUrl = normalizeImageUrl(root.find(".party-image img, .party img, img").first().attr("src"));

    const numericNodes = root
      .find(".candidate-vote, .vote, .vote-count, h6, .count")
      .map((_, node) => normalizeWhitespace($(node).text()))
      .get()
      .filter((text) => /\d/.test(text));

    if (!candidateName || !numericNodes.length) {
      return;
    }

    const votes = parseNumber(numericNodes[0]);
    const deltaFromLeader = numericNodes[1] ? parseNumber(numericNodes[1]) : undefined;

    const status = inferStatusFromText(root.text());

    candidates.push({
      candidateName,
      partyName: partyName || "Independent/Unknown",
      partyLogoUrl,
      votes,
      status,
      deltaFromLeader
    });
  });

  if (candidates.length > 0) {
    return candidates;
  }

  // Fallback parser for tightly packed candidate rows.
  const rawText = $("body").text();
  const chunks = rawText.split(/\n+/).map(normalizeWhitespace).filter(Boolean);
  const compact: CandidateResult[] = [];

  for (let index = 0; index < chunks.length - 2; index += 1) {
    const name = chunks[index];
    const party = chunks[index + 1];
    const maybeVote = chunks[index + 2];
    if (!name || !party || !/^[\d,]+$/.test(maybeVote)) {
      continue;
    }

    compact.push({
      candidateName: name,
      partyName: party,
      votes: parseNumber(maybeVote),
      status: "unknown"
    });
  }

  return compact;
}

function parseProportionalResults(homeHtml: string): ProportionalResults | undefined {
  const $ = load(homeHtml);
  const title = normalizeWhitespace($("#samanupatikTitle").first().text()).replace(/\s+/g, " ");
  if (!title) {
    return undefined;
  }

  const container = $("#samanupatikTitle").closest(".content-inside-wrap").find(".party-result");
  const parties = container
    .map((_, element) => {
      const root = $(element);
      const partyName = normalizeWhitespace(root.find(".vote-count p").first().text());
      const votesText = normalizeWhitespace(root.find(".vote-count span").first().text());
      const votes = parseNumber(votesText);
      if (!partyName || votes <= 0) {
        return null;
      }

      const partyLogoUrl = normalizeImageUrl(root.find("img").first().attr("src"));
      const href = String(root.attr("href") ?? "").trim();
      const partyUrl = href ? toAbsoluteUrl(href) : undefined;

      return {
        partyName,
        partyLogoUrl,
        votes,
        partyUrl
      };
    })
    .get()
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.votes - a.votes);

  if (parties.length === 0) {
    return undefined;
  }

  return {
    title,
    sourceUrl: HOME_URL,
    updatedAtIso: new Date().toISOString(),
    parties
  };
}

function parseConstituencyPage(
  html: string,
  sourceUrl: string,
  districtIndexBySlug: Map<string, DistrictIndexEntry>
): ConstituencyResult | null {
  const $ = load(html);
  const slug = slugFromConstituencyUrl(sourceUrl);
  if (!slug) {
    return null;
  }

  const districtSlug = districtFromConstituencySlug(slug);
  const districtMeta = districtIndexBySlug.get(districtSlug);
  const pageText = $("body").text();

  const breadcrumbItems = $(".breadcrumb li")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter(Boolean);

  const headingCandidates = [
    normalizeWhitespace($("h1").first().text()),
    normalizeWhitespace($("h2").first().text()),
    normalizeWhitespace($("h3").first().text()),
    normalizeWhitespace($(".constituency-title, .page-title, .table-head").first().text())
  ].filter(Boolean);

  const explicitConstituency =
    breadcrumbItems.find((item) => /\d/.test(item) && !item.includes("/")) ??
    pageText.match(/Constituency\s*[:\-]?\s*([A-Za-z\-\s\d]+)/i)?.[1] ??
    headingCandidates[0] ??
    slug;

  const constituencyNumber = slug.match(/-(\d+)$/)?.[1];
  const constituencyName = normalizeWhitespace(explicitConstituency || slug)
    .replace(/\s*Results?$/i, "")
    .replace(/\s*\/\s*$/, "");

  const districtNameFromBreadcrumb = normalizeWhitespace(
    $(".breadcrumb li a")
      .first()
      .text()
      .replace("/", "")
  );
  const breadcrumbLooksGeneric =
    districtNameFromBreadcrumb.toLowerCase() === "federal parliament" ||
    districtNameFromBreadcrumb.toLowerCase() === "federal";
  const districtName =
    (!breadcrumbLooksGeneric ? districtNameFromBreadcrumb : "") ||
    districtMeta?.districtName ||
    (constituencyName.includes("-") ? normalizeWhitespace(constituencyName.split("-")[0]) : districtNameFromSlug(districtSlug));

  const provinceNumber =
    pageText.match(/Province\s*(\d+)/i)?.[1] ||
    pageText.match(/\bProvince\s*[:\-]?\s*(\d+)\b/i)?.[1] ||
    sourceUrl.match(/\/pradesh-(\d+)\//i)?.[1] ||
    districtMeta?.provinceCode;
  const provinceText =
    (provinceNumber ? PROVINCE_LABELS[provinceNumber] : undefined) ||
    districtMeta?.province ||
    provinceFromDistrictSlug.get(districtSlug) ||
    "Unknown Province";

  const candidates = parseCandidates($).sort((a, b) => b.votes - a.votes);

  if (candidates.length === 0) {
    return null;
  }

  const top = candidates[0];
  const runnerUp = candidates[1];
  const leadMargin =
    top.deltaFromLeader && top.deltaFromLeader > 0
      ? top.deltaFromLeader
      : runnerUp
        ? Math.max(top.votes - runnerUp.votes, 0)
        : undefined;

  const normalizedCandidates = candidates.map((candidate, index): CandidateResult => {
    if (candidate.status !== "unknown") {
      return candidate;
    }

    if (index === 0) {
      const status: ElectionStatus = leadMargin && leadMargin > 0 ? "leading" : "unknown";
      return { ...candidate, status };
    }

    return { ...candidate, status: "trailing" };
  });

  const topResolved = normalizedCandidates[0];
  const runnerResolved = normalizedCandidates[1];

  const normalizedConstituencyName =
    constituencyName && constituencyName !== slug
      ? constituencyName
      : constituencyNumber
        ? `${districtName} - ${constituencyNumber}`
        : slug;

  return {
    constituencySlug: slug,
    constituencyName: normalizedConstituencyName,
    districtSlug,
    districtName,
    province: normalizeWhitespace(provinceText),
    topCandidates: normalizedCandidates,
    leadingCandidate: topResolved,
    runnerUp: runnerResolved,
    leadMargin,
    updatedAtIso: new Date().toISOString(),
    sourceUrl
  };
}

function groupDistricts(results: ConstituencyResult[], districtIndex: DistrictIndexEntry[]): DistrictResult[] {
  const grouped = new Map<string, DistrictResult>();

  for (const district of districtIndex) {
    grouped.set(district.districtSlug, {
      districtSlug: district.districtSlug,
      districtName: district.districtName,
      province: district.province,
      constituencies: [],
      updatedAtIso: new Date().toISOString()
    });
  }

  for (const constituency of results) {
    if (!grouped.has(constituency.districtSlug)) {
      grouped.set(constituency.districtSlug, {
        districtSlug: constituency.districtSlug,
        districtName: constituency.districtName,
        province: constituency.province,
        constituencies: [],
        updatedAtIso: constituency.updatedAtIso
      });
    }

    const district = grouped.get(constituency.districtSlug);
    if (!district) {
      continue;
    }

    district.constituencies.push(constituency);
    district.updatedAtIso = constituency.updatedAtIso;

    if (!district.province || district.province === "Unknown Province") {
      district.province = constituency.province;
    }
  }

  return [...grouped.values()]
    .map((district) => ({
      ...district,
      constituencies: district.constituencies.sort((a, b) =>
        a.constituencyName.localeCompare(b.constituencyName)
      )
    }))
    .sort((a, b) => a.districtName.localeCompare(b.districtName));
}

export async function scrapeEkantipurElectionData(): Promise<ElectionDataset> {
  const scrapeErrors: string[] = [];
  const fetchedAtIso = new Date().toISOString();

  const homeHtml = await fetchHtml(HOME_URL);
  const proportionalResults = parseProportionalResults(homeHtml);
  const { districtIndex, districtSlugs, constituencyUrls } = extractDistrictSlugsAndConstituencies(homeHtml);
  const districtIndexBySlug = new Map(districtIndex.map((entry) => [entry.districtSlug, entry]));

  const districtSlugList = [...districtSlugs].slice(0, MAX_DISTRICT_PAGES);

  // Crawl district pages to discover constituency links beyond homepage visibility.
  const districtPages = await mapWithConcurrency(
    districtSlugList,
    async (districtSlug) => {
      const districtMeta = districtIndexBySlug.get(districtSlug);
      const modernDistrictUrl =
        districtMeta?.provinceCode && districtMeta.provinceCode !== ""
          ? `${BASE_URL}/pradesh-${districtMeta.provinceCode}/district-${districtSlug}?lng=eng`
          : null;
      const legacyDistrictUrl = `${BASE_URL}/district/${districtSlug}?lng=eng`;
      try {
        const html = await fetchHtml(modernDistrictUrl ?? legacyDistrictUrl);
        return extractConstituencyUrlsFromDistrictPage(html, districtSlug, districtMeta?.provinceCode);
      } catch (error) {
        if (modernDistrictUrl) {
          try {
            const html = await fetchHtml(legacyDistrictUrl);
            return extractConstituencyUrlsFromDistrictPage(html, districtSlug, districtMeta?.provinceCode);
          } catch (legacyError) {
            scrapeErrors.push(
              `District page failed (${districtSlug}): ${legacyError instanceof Error ? legacyError.message : String(legacyError)}`
            );
            return { urls: [], constituencyCount: undefined };
          }
        }
        scrapeErrors.push(
          `District page failed (${districtSlug}): ${error instanceof Error ? error.message : String(error)}`
        );
        return { urls: [], constituencyCount: undefined };
      }
    },
    6
  );

  districtPages.forEach((result, index) => {
    const districtSlug = districtSlugList[index];
    if (!districtSlug) {
      return;
    }
    const meta = districtIndexBySlug.get(districtSlug);
    if (meta && typeof result.constituencyCount === "number" && result.constituencyCount > 0) {
      meta.constituencyCount = result.constituencyCount;
      districtIndexBySlug.set(districtSlug, meta);
    }
  });

  for (const result of districtPages) {
    for (const url of result.urls) {
      constituencyUrls.add(url);
    }
  }

  for (const district of districtIndexBySlug.values()) {
    if (district.constituencyCount <= 0 || !district.provinceCode) {
      continue;
    }
    for (let index = 1; index <= district.constituencyCount; index += 1) {
      constituencyUrls.add(
        `${BASE_URL}/pradesh-${district.provinceCode}/district-${district.districtSlug}/constituency-${index}`
      );
    }
  }

  const constituencyList = [...constituencyUrls]
    .map((url) => removeQueryAndHash(url))
    .filter(
      (url) =>
        /\/constituency\/[a-z0-9-]+$/i.test(url) ||
        /\/pradesh-\d+\/district-[a-z0-9-]+\/constituency-\d+$/i.test(url)
    );

  // Constituency pages carry the final candidate rows and vote counts.
  const constituencyResults = await mapWithConcurrency(
    constituencyList,
    async (url) => {
      try {
        const html = await fetchHtml(`${url}?lng=eng`);
        return parseConstituencyPage(html, url, districtIndexBySlug);
      } catch (error) {
        scrapeErrors.push(
          `Constituency page failed (${url}): ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    },
    MAX_CONCURRENCY
  );

  const validConstituencies = constituencyResults.filter(
    (item): item is ConstituencyResult => Boolean(item)
  );

  const districts = groupDistricts(validConstituencies, [...districtIndexBySlug.values()]);

  return {
    source: HOME_URL,
    sourceLabel: "Ekantipur Election",
    fetchedAtIso,
    districts,
    proportionalResults,
    scrapeErrors,
    stale: false,
    fallbackUsed: false
  };
}
