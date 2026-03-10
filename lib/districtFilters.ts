import { DistrictResult } from "@/lib/types";

const EXCLUDED_DISTRICT_KEYS = new Set([
  "ilam",
  "rautahat",
]);

function normalizeDistrictKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function isExcludedDistrict(district: Pick<DistrictResult, "districtSlug" | "districtName">): boolean {
  const slugKey = normalizeDistrictKey(district.districtSlug);
  const nameKey = normalizeDistrictKey(district.districtName);
  return EXCLUDED_DISTRICT_KEYS.has(slugKey) || EXCLUDED_DISTRICT_KEYS.has(nameKey);
}

export function filterExcludedDistricts(districts: DistrictResult[]): DistrictResult[] {
  return districts.filter((district) => !isExcludedDistrict(district));
}
