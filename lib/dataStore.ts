import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fallbackResults } from "@/data/fallback-results";
import { scrapeEkantipurElectionData } from "@/lib/scraper/ekantipurScraper";
import { ElectionDataset } from "@/lib/types";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "results-cache.json");

const SCRAPE_INTERVAL_MS = Number(process.env.SCRAPE_INTERVAL_MS ?? "120000");
const STALE_AFTER_MS = Number(process.env.STALE_AFTER_MS ?? "300000");

let inFlightRefresh: Promise<ElectionDataset> | null = null;
let schedulerStarted = false;

async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function readCache(): Promise<ElectionDataset | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as ElectionDataset;
  } catch {
    return null;
  }
}

async function writeCache(dataset: ElectionDataset): Promise<void> {
  await ensureCacheDir();
  await writeFile(CACHE_FILE, JSON.stringify(dataset, null, 2), "utf8");
}

function withStale(dataset: ElectionDataset): ElectionDataset {
  const age = Date.now() - Date.parse(dataset.fetchedAtIso);
  const stale = Number.isFinite(age) ? age > STALE_AFTER_MS : true;
  return { ...dataset, stale };
}

export async function refreshElectionData(): Promise<ElectionDataset> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const scraped = await scrapeEkantipurElectionData();
      const normalized = withStale(scraped);

      if (normalized.districts.length > 0) {
        await writeCache(normalized);
        return normalized;
      }

      const cached = await readCache();
      if (cached) {
        return {
          ...withStale(cached),
          scrapeErrors: [...cached.scrapeErrors, "Scrape returned no districts. Using cached dataset."]
        };
      }

      return {
        ...fallbackResults,
        fetchedAtIso: new Date().toISOString(),
        scrapeErrors: [...fallbackResults.scrapeErrors, "Scrape returned no districts. Using fallback."]
      };
    } catch (error) {
      const cached = await readCache();
      if (cached) {
        return {
          ...withStale(cached),
          scrapeErrors: [
            ...cached.scrapeErrors,
            `Scrape failed. Using cached dataset: ${error instanceof Error ? error.message : String(error)}`
          ]
        };
      }

      return {
        ...fallbackResults,
        fetchedAtIso: new Date().toISOString(),
        scrapeErrors: [
          ...fallbackResults.scrapeErrors,
          `Scrape failed. Using fallback dataset: ${error instanceof Error ? error.message : String(error)}`
        ]
      };
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export async function getElectionData(): Promise<ElectionDataset> {
  const cached = await readCache();

  if (!cached) {
    return refreshElectionData();
  }

  const normalized = withStale(cached);
  const age = Date.now() - Date.parse(normalized.fetchedAtIso);
  const looksIncomplete = normalized.districts.length < 70;
  const hasGenericDistrictLabel = normalized.districts.some(
    (district) => district.districtName.trim().toLowerCase() === "federal parliament"
  );

  // If cache is fallback/incomplete, wait for a fresh scrape instead of serving stale mock data.
  if (normalized.fallbackUsed || looksIncomplete || hasGenericDistrictLabel) {
    return refreshElectionData();
  }

  if (age > SCRAPE_INTERVAL_MS) {
    void refreshElectionData();
  }

  return normalized;
}

export async function getRawCacheData(): Promise<ElectionDataset> {
  const cached = await readCache();
  if (cached) {
    return withStale(cached);
  }
  return fallbackResults;
}

export function startElectionRefreshScheduler(): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  void refreshElectionData();

  setInterval(() => {
    void refreshElectionData();
  }, SCRAPE_INTERVAL_MS).unref();
}
