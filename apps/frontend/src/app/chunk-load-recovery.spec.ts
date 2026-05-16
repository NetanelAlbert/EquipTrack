import {
  CHUNK_RECOVERY_FLAG_KEY,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from './chunk-load-recovery';

describe('isChunkLoadError', () => {
  const chunkMessages = [
    'Loading chunk 42 failed',
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
  ];

  it.each(chunkMessages)('returns true for message: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error(message), {}))).toBe(true);
  });

  it('returns true when name is ChunkLoadError', () => {
    expect(
      isChunkLoadError(
        Object.assign(new Error('x'), { name: 'ChunkLoadError' })
      )
    ).toBe(true);
  });

  it.each([
    ['plain Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
  ])('returns false for %s', (_label, value) => {
    expect(isChunkLoadError(value)).toBe(false);
  });

  it('returns true when the error is a matching string message', () => {
    expect(isChunkLoadError('Loading chunk 99 failed')).toBe(true);
  });

  it('returns false for number and empty object', () => {
    expect(isChunkLoadError(42)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });

  it('unwraps { rejection: inner }', () => {
    const inner = new Error('Loading chunk 7 failed');
    expect(isChunkLoadError({ rejection: inner })).toBe(true);
  });

  it('unwraps { reason: inner }', () => {
    const inner = Object.assign(new Error('x'), {
      name: 'ChunkLoadError' as const,
    });
    expect(isChunkLoadError({ reason: inner })).toBe(true);
  });
});

describe('recoverFromChunkLoadError', () => {
  const reloadGuardWindowMs = 60_000;

  function createStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => {
        map.clear();
      },
      key: (index: number) => Array.from(map.keys())[index] ?? null,
      get length() {
        return map.size;
      },
    } as Storage;
  }

  it('on first call writes flag, unregisters SWs, clears caches, replaces location, returns recovering', async () => {
    const storage = createStorage();
    const replace = jest.fn();
    const unregisterA = jest.fn().mockResolvedValue(true);
    const unregisterB = jest.fn().mockResolvedValue(true);
    const getRegistrations = jest.fn().mockResolvedValue([
      { unregister: unregisterA },
      { unregister: unregisterB },
    ]);
    const cacheDelete = jest.fn().mockResolvedValue(true);
    const caches = {
      keys: jest.fn().mockResolvedValue(['a', 'b']),
      delete: cacheDelete,
    } as unknown as CacheStorage;

    const fixedNow = 1_704_000_000_000;
    const outcome = await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => fixedNow,
      storage,
      location: {
        href: 'https://app.example.org/inventory?foo=1',
        replace,
      },
      navigator: { serviceWorker: { getRegistrations } } as Pick<
        Navigator,
        'serviceWorker'
      >,
      caches,
    });

    expect(outcome).toBe('recovering');
    expect(storage.getItem(CHUNK_RECOVERY_FLAG_KEY)).toBe(String(fixedNow));
    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
    expect(caches.keys).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledWith('a');
    expect(cacheDelete).toHaveBeenCalledWith('b');
    expect(replace).toHaveBeenCalledTimes(1);
    const replaced = replace.mock.calls[0][0] as string;
    const url = new URL(replaced);
    expect(url.searchParams.get('_v')).toBe(String(fixedNow));
    expect(url.pathname).toBe('/inventory');
    expect(url.searchParams.get('foo')).toBe('1');
  });

  it('on second call within guard window returns gave-up without side effects', async () => {
    const storage = createStorage();
    const replace = jest.fn();
    const getRegistrations = jest.fn();
    const caches = {
      keys: jest.fn(),
      delete: jest.fn(),
    } as unknown as CacheStorage;

    const t0 = 5_000;
    await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => t0,
      storage,
      location: { href: 'https://x/', replace },
      navigator: {
        serviceWorker: { getRegistrations },
      } as Pick<Navigator, 'serviceWorker'>,
      caches,
    });

    replace.mockClear();
    getRegistrations.mockClear();
    (caches.keys as jest.Mock).mockClear();
    (caches.delete as jest.Mock).mockClear();

    const outcome = await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => t0 + 1000,
      storage,
      location: { href: 'https://x/', replace },
      navigator: {
        serviceWorker: { getRegistrations },
      } as Pick<Navigator, 'serviceWorker'>,
      caches,
    });

    expect(outcome).toBe('gave-up');
    expect(replace).toHaveBeenCalledTimes(0);
    expect(getRegistrations).toHaveBeenCalledTimes(0);
    expect(caches.keys).toHaveBeenCalledTimes(0);
  });

  it('on second call after guard window expires recovers again', async () => {
    const storage = createStorage();
    const replace = jest.fn();
    const t0 = 10_000;
    await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => t0,
      storage,
      location: { href: 'https://x/y', replace },
      navigator: undefined,
      caches: undefined,
    });
    replace.mockClear();

    const t1 = t0 + reloadGuardWindowMs + 1;
    const outcome = await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => t1,
      storage,
      location: { href: 'https://x/y', replace },
      navigator: undefined,
      caches: undefined,
    });

    expect(outcome).toBe('recovering');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(new URL(replace.mock.calls[0][0] as string).searchParams.get('_v')).toBe(
      String(t1)
    );
  });

  it('when navigator.serviceWorker is undefined still replaces', async () => {
    const replace = jest.fn();
    await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => 123,
      storage: createStorage(),
      location: { href: 'https://z/', replace },
      navigator: undefined,
      caches: undefined,
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('when caches is undefined still replaces', async () => {
    const replace = jest.fn();
    await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => 456,
      storage: createStorage(),
      location: { href: 'https://z/', replace },
      navigator: { serviceWorker: undefined } as Pick<
        Navigator,
        'serviceWorker'
      >,
      caches: undefined,
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('when caches.delete rejects for one key recovery still proceeds', async () => {
    const replace = jest.fn();
    const cacheDelete = jest
      .fn()
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockResolvedValueOnce(true);
    const caches = {
      keys: jest.fn().mockResolvedValue(['bad', 'good']),
      delete: cacheDelete,
    } as unknown as CacheStorage;

    await recoverFromChunkLoadError({
      reloadGuardWindowMs,
      now: () => 999,
      storage: createStorage(),
      location: { href: 'https://z/', replace },
      navigator: undefined,
      caches,
    });

    expect(replace).toHaveBeenCalledTimes(1);
  });
});
