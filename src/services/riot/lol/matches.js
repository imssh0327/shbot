const { riotGet } = require("../../../lib/riot");
const { getJsonWithCache } = require("../../../lib/matchCache");

const ASIA_API = "https://asia.api.riotgames.com";

const LOL_QUEUE_RANKED_SOLO = 420;
const LOL_QUEUE_RANKED_FLEX = 440;

const MATCH_CACHE_TTL_SEC = 60 * 60 * 24 * 7;

const SLEEP_ON_RIOT_FETCH_MS = 150;

async function getRecentLolMatchIds(puuid, count) {
  const url =
    `${ASIA_API}/lol/match/v5/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}` +
    `/ids?type=ranked&start=0&count=${encodeURIComponent(String(count))}`;
  return riotGet(url);
}

async function fetchMatchDtoFromRiot(matchId) {
  const url =
    `${ASIA_API}/lol/match/v5/matches/` + encodeURIComponent(matchId);
  return riotGet(url);
}

async function getMatchDtoCached(matchId) {
  return getJsonWithCache({
    prefix: "lol:match",
    id: matchId,
    ttlSec: MATCH_CACHE_TTL_SEC,
    fetcher: () => fetchMatchDtoFromRiot(matchId),
  });
}

async function getRecentRankedSummaries({ puuid, recentMatchIdCount, limit }) {
  const matchIds = await getRecentLolMatchIds(puuid, recentMatchIdCount);

  const out = [];
  if (!Array.isArray(matchIds) || matchIds.length === 0) return out;

  for (const matchId of matchIds) {
    const { data: matchDto, cacheHit } = await getMatchDtoCached(matchId);

    if (!isRankedSummonersRift(matchDto)) {
      if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
      continue;
    }

    const me = extractParticipant(matchDto, puuid);
    if (!me) {
      if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
      continue;
    }

    out.push({
      matchId,
      win: Boolean(me.win),
      champion: me.championName || "Unknown",
      kills: toNumberOrZero(me.kills),
      deaths: toNumberOrZero(me.deaths),
      assists: toNumberOrZero(me.assists),
      dateText: extractDateText(matchDto),
      queueId: matchDto && matchDto.info ? matchDto.info.queueId : undefined,
    });

    if (out.length >= limit) break;

    if (!cacheHit) await sleep(SLEEP_ON_RIOT_FETCH_MS);
  }

  console.log("────────────────────────────────────────");
  console.log("[LOL 캐시 조회 종료] 최근 랭크 경기 캐시 처리 완료");
  console.log("────────────────────────────────────────");
  return out;
}

function isRankedSummonersRift(matchDto) {
  const q = matchDto && matchDto.info ? matchDto.info.queueId : undefined;
  return q === LOL_QUEUE_RANKED_SOLO || q === LOL_QUEUE_RANKED_FLEX;
}

function extractParticipant(matchDto, puuid) {
  const participants = matchDto && matchDto.info ? matchDto.info.participants : null;
  if (!Array.isArray(participants)) return null;
  return participants.find((p) => p && p.puuid === puuid) || null;
}

function extractDateText(matchDto) {
  const ts = matchDto && matchDto.info ? matchDto.info.gameStartTimestamp : null;
  if (!ts) return "날짜 없음";

  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "날짜 없음";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNumberOrZero(v) {
  return typeof v === "number" ? v : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  getRecentRankedSummaries,
};
