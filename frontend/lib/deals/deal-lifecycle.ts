"use client";

export type CompanyProfile = {
  id: string;
  companyName: string;
  sector?: string;
  subSector?: string;
  hqRegion?: string;
  currency?: string;
  fiscalYearEnd?: string;
  uploadedAt?: string;
};

export type ArchivedDeal = {
  id: string;
  companyName: string;
  closeValue: string;
  closedAt: string;
  archivedAt: string;
};

export type DeletedDeal = {
  id: string;
  companyName: string;
  deletedAt: string;
  purgeAt: string;
  source: "active" | "archived";
  closeValue?: string;
  closedAt?: string;
};

const PROFILES_KEY = "tam-company-profiles";
const ARCHIVED_KEY = "tam-archived-deals";
const DELETED_KEY = "tam-deleted-deals";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCompanyProfiles() {
  return readJson<CompanyProfile[]>(PROFILES_KEY, []);
}

export function setCompanyProfiles(next: CompanyProfile[]) {
  writeJson(PROFILES_KEY, next);
}

export function getArchivedDeals() {
  return readJson<ArchivedDeal[]>(ARCHIVED_KEY, []);
}

export function setArchivedDeals(next: ArchivedDeal[]) {
  writeJson(ARCHIVED_KEY, next);
}

export function getDeletedDeals() {
  return readJson<DeletedDeal[]>(DELETED_KEY, []);
}

export function setDeletedDeals(next: DeletedDeal[]) {
  writeJson(DELETED_KEY, next);
}

export function purgeExpiredDeletedDeals() {
  const now = Date.now();
  const kept = getDeletedDeals().filter((deal) => new Date(deal.purgeAt).getTime() > now);
  setDeletedDeals(kept);
  return kept;
}

export function closeDeal(companyName: string, closeValue: string) {
  const normalized = companyName.trim().toLowerCase();
  const profiles = getCompanyProfiles();
  const match = profiles.find((p) => p.companyName.trim().toLowerCase() === normalized);
  const remainingProfiles = profiles.filter((p) => p.companyName.trim().toLowerCase() !== normalized);
  setCompanyProfiles(remainingProfiles);

  const archived = getArchivedDeals();
  const nextArchived: ArchivedDeal = {
    id: `arc-${Date.now()}`,
    companyName: match?.companyName ?? companyName,
    closeValue,
    closedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
  };
  const deduped = archived.filter((d) => d.companyName.trim().toLowerCase() !== normalized);
  setArchivedDeals([nextArchived, ...deduped]);
}

export function deleteActiveDeal(companyName: string) {
  const normalized = companyName.trim().toLowerCase();
  const profiles = getCompanyProfiles();
  const match = profiles.find((p) => p.companyName.trim().toLowerCase() === normalized);
  setCompanyProfiles(profiles.filter((p) => p.companyName.trim().toLowerCase() !== normalized));

  const deleted = getDeletedDeals();
  const now = Date.now();
  const next: DeletedDeal = {
    id: `del-${now}`,
    companyName: match?.companyName ?? companyName,
    source: "active",
    deletedAt: new Date(now).toISOString(),
    purgeAt: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
  };
  setDeletedDeals([next, ...deleted.filter((d) => d.companyName.trim().toLowerCase() !== normalized)]);
}

export function deleteArchivedDeal(archivedId: string) {
  const archived = getArchivedDeals();
  const target = archived.find((d) => d.id === archivedId);
  if (!target) return;
  setArchivedDeals(archived.filter((d) => d.id !== archivedId));

  const deleted = getDeletedDeals();
  const now = Date.now();
  const next: DeletedDeal = {
    id: `del-${now}`,
    companyName: target.companyName,
    source: "archived",
    closeValue: target.closeValue,
    closedAt: target.closedAt,
    deletedAt: new Date(now).toISOString(),
    purgeAt: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
  };
  setDeletedDeals([next, ...deleted]);
}

export function restoreDeletedDeal(deletedId: string) {
  const deleted = getDeletedDeals();
  const target = deleted.find((d) => d.id === deletedId);
  if (!target) return;

  if (target.source === "archived") {
    const archived = getArchivedDeals();
    setArchivedDeals([
      {
        id: `arc-${Date.now()}`,
        companyName: target.companyName,
        closeValue: target.closeValue ?? "Undisclosed",
        closedAt: target.closedAt ?? new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      },
      ...archived,
    ]);
  } else {
    const profiles = getCompanyProfiles();
    setCompanyProfiles([
      {
        id: `cmp-${Date.now()}`,
        companyName: target.companyName,
        uploadedAt: new Date().toISOString(),
      },
      ...profiles,
    ]);
  }

  setDeletedDeals(deleted.filter((d) => d.id !== deletedId));
}

export function permanentlyDeleteFromRecentlyDeleted(deletedId: string) {
  setDeletedDeals(getDeletedDeals().filter((d) => d.id !== deletedId));
}

