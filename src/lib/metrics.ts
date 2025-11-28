type ApiMetric = {
  durationMs: number;
  cacheHit?: boolean;
  meta?: Record<string, unknown>;
};

const cacheCounters = new Map<string, { hits: number; misses: number }>();

export const recordApiMetric = (route: string, metric: ApiMetric) => {
  const payload = {
    route,
    ...metric,
    timestamp: new Date().toISOString(),
  };
  console.log('[metrics]', JSON.stringify(payload));
};

export const recordCacheMetric = (cacheName: string, hit: boolean) => {
  const counter = cacheCounters.get(cacheName) || { hits: 0, misses: 0 };
  if (hit) {
    counter.hits += 1;
  } else {
    counter.misses += 1;
  }
  cacheCounters.set(cacheName, counter);
  console.log(
    '[metrics]',
    JSON.stringify({
      cache: cacheName,
      hits: counter.hits,
      misses: counter.misses,
      timestamp: new Date().toISOString(),
    }),
  );
};


