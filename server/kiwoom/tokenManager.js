export function parseKiwoomExpiresDt(expiresdt) {
  if (!expiresdt) return 0;
  const value = String(expiresdt).trim();
  const normalized = value.length === 14
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+09:00`
    : value;

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function shouldReuseToken(cache, nowMs = Date.now(), leadTimeMs = 60_000) {
  return Boolean(cache?.token) && nowMs < Number(cache?.expiresAtMs || 0) - leadTimeMs;
}
