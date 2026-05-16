export const CHUNK_RECOVERY_FLAG_KEY = 'equip-track-chunk-recovered-at';

const CHUNK_MESSAGE_PATTERNS: readonly RegExp[] = [
  /Loading chunk [^ ]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

function getErrorName(error: unknown): string | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return undefined;
}

function messageMatchesChunkFailure(message: string): boolean {
  return CHUNK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function matchesChunkLoadSignature(error: unknown): boolean {
  if (getErrorName(error) === 'ChunkLoadError') {
    return true;
  }
  const message = getErrorMessage(error);
  return message !== undefined && messageMatchesChunkFailure(message);
}

function unwrapRejectionOrReason(error: unknown): unknown {
  if (error === null || typeof error !== 'object') {
    return error;
  }
  const record = error as Record<string, unknown>;
  if ('rejection' in record && record['rejection'] !== undefined) {
    return record['rejection'];
  }
  if ('reason' in record && record['reason'] !== undefined) {
    return record['reason'];
  }
  return error;
}

export function isChunkLoadError(error: unknown): boolean {
  if (matchesChunkLoadSignature(error)) {
    return true;
  }
  const inner = unwrapRejectionOrReason(error);
  if (inner !== error) {
    return matchesChunkLoadSignature(inner);
  }
  return false;
}

export interface ChunkLoadRecoveryDeps {
  reloadGuardWindowMs?: number;
  now?: () => number;
  storage?: Storage;
  location?: Pick<Location, 'href' | 'replace'>;
  navigator?: Pick<Navigator, 'serviceWorker'>;
  caches?: CacheStorage;
}

const DEFAULT_RELOAD_GUARD_MS = 60_000;

function readSessionStorage(): Storage | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function readLocation(): Pick<Location, 'href' | 'replace'> | undefined {
  if (typeof globalThis === 'undefined' || !('location' in globalThis)) {
    return undefined;
  }
  return globalThis.location as Pick<Location, 'href' | 'replace'>;
}

function readNavigator(): Pick<Navigator, 'serviceWorker'> | undefined {
  if (typeof globalThis === 'undefined' || !('navigator' in globalThis)) {
    return undefined;
  }
  return globalThis.navigator as Pick<Navigator, 'serviceWorker'>;
}

function readCaches(): CacheStorage | undefined {
  if (typeof globalThis === 'undefined' || !('caches' in globalThis)) {
    return undefined;
  }
  const c = (globalThis as { caches?: CacheStorage }).caches;
  return c;
}

export async function recoverFromChunkLoadError(
  deps?: ChunkLoadRecoveryDeps
): Promise<'recovering' | 'gave-up'> {
  const reloadGuardWindowMs =
    deps?.reloadGuardWindowMs ?? DEFAULT_RELOAD_GUARD_MS;
  const now = deps?.now ?? Date.now;
  const storage = deps?.storage ?? readSessionStorage();
  const locationRef = deps?.location ?? readLocation();
  const navigatorRef = deps?.navigator ?? readNavigator();
  const cachesRef = deps?.caches ?? readCaches();

  const t = now();

  if (storage) {
    const raw = storage.getItem(CHUNK_RECOVERY_FLAG_KEY);
    if (raw !== null && raw !== '') {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isNaN(parsed) && t - parsed < reloadGuardWindowMs) {
        return 'gave-up';
      }
    }
    storage.setItem(CHUNK_RECOVERY_FLAG_KEY, String(t));
  }

  if (
    navigatorRef &&
    'serviceWorker' in navigatorRef &&
    navigatorRef.serviceWorker
  ) {
    try {
      const registrations =
        await navigatorRef.serviceWorker.getRegistrations();
      await Promise.allSettled(
        registrations.map((registration) => registration.unregister())
      );
    } catch {
      /* ignore */
    }
  }

  if (cachesRef) {
    try {
      const keys = await cachesRef.keys();
      await Promise.allSettled(keys.map((key) => cachesRef.delete(key)));
    } catch {
      /* ignore */
    }
  }

  if (locationRef) {
    const url = new URL(locationRef.href);
    url.searchParams.set('_v', String(t));
    locationRef.replace(url.toString());
  }

  return 'recovering';
}
