const { riotGet } = require("../../../lib/riot");
const { getJsonWithCache } = require("../../../lib/matchCache");

const ASIA_API = "https://asia.api.riotgames.com";

const TFT_RANKED_QUEUE_ID = 1100;

const MATCH_CACHE_TTL_SEC = 604800;
const SLEEP_ON_RIOT_FETCH_MS = 150;

async function getRecentTftMatchIds(puuid, count) {
  const url =
    `${ASIA_API}/tft/match/v1/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}` +
    `/ids?count=${encodeURIComponent(String(count))}`;

  return riotGet(url);
}

async function fetchMatchDtoFromRiot(matchId) {
  const url = `${ASIA_API}/tft/match/v1/matches/${encodeURIComponent(matchId)}`;
  return riotGet(url);
}

async function getMatchDtoCached(matchId) {
  return getJsonWithCache({
    prefix: "tft:match",
    id: matchId,
    ttlSec: MATCH_CACHE_TTL_SEC,
    fetcher: () => fetchMatchDtoFromRiot(matchId),
  });
}

async function collectRecentRankedPlacements({ puuid, matchIds, limit }) {
  const out = [];
  if (!Array.isArray(matchIds) || matchIds.length === 0) return out;

  for (const matchId of matchIds) {
    const { data: matchDto, cacheHit } = await getMatchDtoCached(matchId);

    if (!isRankedTftMatch(matchDto)) {
      if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
      continue;
    }

    const placement = extractPlacement(matchDto, puuid);
    if (placement == null) {
      if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
      continue;
    }

    out.push({
      matchId,
      placement,
      dateText: extractDateText(matchDto),
    });

    if (out.length >= limit) break;
    if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
  }

  console.log("────────────────────────────────────────");
  console.log("[TFT 캐시 조회 종료] 최근 랭크 경기 캐시 처리 완료");
  console.log("────────────────────────────────────────");
  return out;
}

function isRankedTftMatch(matchDto) {
  const q = matchDto && matchDto.info ? matchDto.info.queue_id : undefined;
  return q === TFT_RANKED_QUEUE_ID;
}

function extractPlacement(matchDto, puuid) {
  const participants = matchDto && matchDto.info ? matchDto.info.participants : null;
  if (!Array.isArray(participants)) return null;
  const me = participants.find((p) => p && p.puuid === puuid) || null;
  return me && me.placement != null ? me.placement : null;
}

function extractDateText(matchDto) {
  const ts = matchDto && matchDto.info ? matchDto.info.game_datetime : null;
  if (!ts) return "날짜 없음";

  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "날짜 없음";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  getRecentTftMatchIds,
  collectRecentRankedPlacements,
};
