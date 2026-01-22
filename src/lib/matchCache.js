const { redis, ensureRedis } = require("./redis");

function buildCacheKey(prefix, id) {
  return `${prefix}:${id}`;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getJsonWithCache({ prefix, id, ttlSec, fetcher }) {
  const key = buildCacheKey(prefix, id);

  const t0 = Date.now();
  const cached = await tryGet(key);
  const t1 = Date.now();

  if (cached) {
    console.log(
      `[캐시 사용] ${key} (Redis 조회 ${t1 - t0}ms)`
    );
    return { data: cached, cacheHit: true };
  }

  console.log(
    `[캐시 미사용] ${key} → Redis에 데이터 없음`
  );

  const t2 = Date.now();
  const data = await fetcher();
  const t3 = Date.now();

  console.log(
    `[Riot API 호출] ${key} (응답 ${t3 - t2}ms)`
  );

  await trySet(key, data, ttlSec);

  console.log(
    `[캐시 저장] ${key} (TTL ${ttlSec}s)`
  );

  return { data, cacheHit: false };
}

async function tryGet(key) {
  try {
    await ensureRedis();
    const text = await redis.get(key);
    if (!text) return null;
    const parsed = safeJsonParse(text);
    return parsed || null;
  } catch (e) {
    console.error("[redis get failed]", e && e.message ? e.message : e);
    return null;
  }
}

async function trySet(key, value, ttlSec) {
  try {
    await ensureRedis();
    await redis.set(key, JSON.stringify(value), { EX: ttlSec });
  } catch (e) {
    console.error("[redis set failed]", e && e.message ? e.message : e);
  }
}

module.exports = {
  getJsonWithCache,
};
