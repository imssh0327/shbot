const { SlashCommandBuilder } = require("discord.js");
const { riotGet, handleRiotError } = require("../../lib/riot");
const { redis, ensureRedis } = require("../../lib/redis");

/*
 * loltochess.js
 * - /tft 전적검색: Riot ID 기반 TFT 티어 및 최근 랭크 10경기 등수 조회
 * - Redis 캐시: matchDto 단위로 캐싱
 */

/* =========================
 * Constants
 * ========================= */

const ASIA_API = "https://asia.api.riotgames.com";
const KR_API = "https://kr.api.riotgames.com";

const TFT_RANKED_QUEUE_ID = 1100;

// matchDto 캐시 TTL: 7일
const MATCH_CACHE_TTL_SEC = 60 * 60 * 24 * 7;

// 최근 matchId 조회 개수 (랭크 10개를 찾기 위한 후보 풀)
const RECENT_MATCH_ID_COUNT = 30;

// 랭크 결과 목표 개수
const RANKED_RESULT_LIMIT = 10;

// 429 방지 완화 딜레이
const SLEEP_NON_RANKED_MS = 120;
const SLEEP_EACH_MATCH_MS = 150;

// 낙타 고정 소환사
const NAKTA_GAME_NAME = "롤체는너무어려워";
const NAKTA_TAG = "운빨게임";

const PLACEMENT_EMOJI = {
  1: "1️⃣",
  2: "2️⃣",
  3: "3️⃣",
  4: "4️⃣",
  5: "5️⃣",
  6: "6️⃣",
  7: "7️⃣",
  8: "8️⃣",
};

/* =========================
 * Discord Command
 * ========================= */

module.exports = {
  data: buildCommand(),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const sub = interaction.options.getSubcommand();

      if (sub === "record") {
        const gameName = interaction.options.getString("game", true).trim();
        const tagLine = interaction.options.getString("tag", true).trim();

        const out = await runTftRecord({ gameName, tagLine });
        await interaction.editReply(out);
        return;
      }

      if (sub === "camel") {
        const out = await runTftRecord({
          gameName: NAKTA_GAME_NAME,
          tagLine: NAKTA_TAG,
        });
        await interaction.editReply(out);
        return;
      }

      await interaction.editReply("지원하지 않는 명령어입니다.");
    } catch (e) {
      const handled = await handleRiotError(interaction, e);
      if (handled) return;

      console.error("tft 커맨드 에러:", e);
      await interaction.editReply("전적 조회 중 오류가 발생했습니다. 서버 로그를 확인해 주세요.");
    }
  },
};

function buildCommand() {
  return new SlashCommandBuilder()
    .setName("tft")
    .setDescription("롤토체스 관련 기능")
    .addSubcommand((sub) =>
      sub
        .setName("record")
        .setDescription("롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다.")
        .setNameLocalizations({ ko: "전적검색" })
        .setDescriptionLocalizations({
          ko: "롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다.",
        })
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("Riot ID 게임 닉네임")
            .setRequired(true)
            .setNameLocalizations({ ko: "닉네임" })
            .setDescriptionLocalizations({ ko: "Riot ID 게임 닉네임" })
        )
        .addStringOption((opt) =>
          opt
            .setName("tag")
            .setDescription("Riot ID 태그 (예: KR1)")
            .setRequired(true)
            .setNameLocalizations({ ko: "태그" })
            .setDescriptionLocalizations({ ko: "Riot ID 태그 (예: KR1)" })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("camel")
        .setDescription("롤체는너무어려워#운빨게임 전적을 조회합니다.")
        .setNameLocalizations({ ko: "낙타" })
        .setDescriptionLocalizations({
          ko: "롤체는너무어려워#운빨게임 전적을 자동 조회합니다.",
        })
    );
}

/* =========================
 * Core Flow
 * ========================= */

async function runTftRecord({ gameName, tagLine }) {
  resetPerf();

  try {
    const puuid = await resolvePuuidByRiotId(gameName, tagLine);
    if (!puuid) return "PUUID를 가져오지 못했습니다. Riot ID를 확인해 주세요.";

    const rankedEntry = await safeGetRankedEntry(puuid);

    const matchIds = await getRecentTftMatchIds(puuid, RECENT_MATCH_ID_COUNT);
    const rankedResults = await collectRecentRankedPlacements({
      puuid,
      matchIds,
      limit: RANKED_RESULT_LIMIT,
    });

    const emojiLine =
      rankedResults.length > 0
        ? rankedResults.map((r) => placementToEmoji(r.placement)).join(" ")
        : "랭크 경기 기록이 확인되지 않습니다.";

    return formatOutput({ gameName, tagLine, rankedEntry, emojiLine });
  } finally {
    printFinalPerf();
  }
}

async function resolvePuuidByRiotId(gameName, tagLine) {
  const account = await getAccountByRiotId(gameName, tagLine);
  return account?.puuid || null;
}

async function safeGetRankedEntry(puuid) {
  try {
    const leagueData = await getTftLeagueByPuuid(puuid);
    return normalizeRankedEntry(leagueData);
  } catch (e) {
    // 랭크 기록이 없으면 404가 날 수 있으므로 Unranked 처리
    if (e?.status === 404) return null;
    throw e;
  }
}

/* =========================
 * Riot API
 * ========================= */

async function getAccountByRiotId(gameName, tagLine) {
  const url =
    `${ASIA_API}/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(gameName)}/` +
    `${encodeURIComponent(tagLine)}`;

  return riotGet(url);
}

async function getTftLeagueByPuuid(puuid) {
  const url = `${KR_API}/tft/league/v1/by-puuid/` + encodeURIComponent(puuid);
  return riotGet(url);
}

async function getRecentTftMatchIds(puuid, count) {
  const url =
    `${ASIA_API}/tft/match/v1/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}` +
    `/ids?count=${encodeURIComponent(String(count))}`;

  return riotGet(url);
}

/* =========================
 * League Data Normalize
 * ========================= */

function normalizeRankedEntry(leagueData) {
  if (!leagueData) return null;

  // 혹시 배열로 내려오는 환경 대비: RANKED_TFT 우선
  if (Array.isArray(leagueData)) {
    return (
      leagueData.find((e) => e?.queueType === "RANKED_TFT") ||
      leagueData[0] ||
      null
    );
  }

  // 단일 객체라면 그대로 사용
  return leagueData;
}

/* =========================
 * Match DTO Cache + Fetch
 * ========================= */

async function getMatchDto(matchId) {
  const key = matchCacheKey(matchId);

  const cached = await tryGetCachedMatchDto(key, matchId);
  if (cached) return cached;

  const matchDto = await fetchMatchDtoFromRiot(matchId);

  // 캐시 저장은 실패해도 본 흐름은 진행
  await trySetCachedMatchDto(key, matchId, matchDto);

  return matchDto;
}

async function tryGetCachedMatchDto(key, matchId) {
  try {
    await ensureRedis();

    const start = nowMs();
    const cachedText = await redis.get(key);
    const end = nowMs();

    if (!cachedText) {
      console.log("[cache miss]", matchId);
      return null;
    }

    const hitMs = end - start;
    perf.redisHit.count += 1;
    perf.redisHit.totalMs += hitMs;

    const parsed = safeJsonParse(cachedText);
    if (!parsed) {
      // 캐시가 깨졌으면 무시하고 Riot에서 다시 받도록 처리
      console.warn("[cache parse failed]", matchId);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error("[redis get failed]", e?.message || e);
    return null;
  }
}

async function fetchMatchDtoFromRiot(matchId) {
  const url = `${ASIA_API}/tft/match/v1/matches/${encodeURIComponent(matchId)}`;

  const start = nowMs();
  const dto = await riotGet(url);
  const end = nowMs();

  perf.riot.count += 1;
  perf.riot.totalMs += end - start;

  return dto;
}

async function trySetCachedMatchDto(key, matchId, matchDto) {
  try {
    await ensureRedis();
    await redis.set(key, JSON.stringify(matchDto), { EX: MATCH_CACHE_TTL_SEC });
    console.log("[redis set ok]", matchId);
  } catch (e) {
    console.error("[redis set failed]", e?.message || e);
  }
}

/* =========================
 * Ranked Result Collect
 * ========================= */

async function collectRecentRankedPlacements({ puuid, matchIds, limit }) {
  const out = [];
  if (!Array.isArray(matchIds) || matchIds.length === 0) return out;

  for (const matchId of matchIds) {
    const matchDto = await getMatchDto(matchId);

    if (!isRankedTftMatch(matchDto)) {
      await sleep(SLEEP_NON_RANKED_MS);
      continue;
    }

    const placement = extractPlacement(matchDto, puuid);
    if (placement == null) {
      await sleep(SLEEP_EACH_MATCH_MS);
      continue;
    }

    out.push({
      placement,
      dateText: extractDateText(matchDto),
      matchId,
    });

    if (out.length >= limit) break;

    await sleep(SLEEP_EACH_MATCH_MS);
  }

  return out;
}

function isRankedTftMatch(matchDto) {
  return matchDto?.info?.queue_id === TFT_RANKED_QUEUE_ID;
}

function extractPlacement(matchDto, puuid) {
  const participants = matchDto?.info?.participants;
  if (!Array.isArray(participants)) return null;

  const me = participants.find((p) => p?.puuid === puuid);
  return me?.placement ?? null;
}

function extractDateText(matchDto) {
  const ts = matchDto?.info?.game_datetime;
  if (!ts) return "날짜 없음";

  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "날짜 없음";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =========================
 * Output Format
 * ========================= */

function formatOutput({ gameName, tagLine, rankedEntry, emojiLine }) {
  const lines = [];
  lines.push(`${gameName}#${tagLine}`);
  lines.push(formatTierLine(rankedEntry));
  lines.push("최근 랭크 10경기");
  lines.push(String(emojiLine || ""));
  lines.push("");
  return lines.join("\n");
}

function formatTierLine(rankedEntry) {
  if (!rankedEntry) return "티어: Unranked";

  const tier = rankedEntry.tier || "";
  const rank = rankedEntry.rank || "";
  const lp =
    typeof rankedEntry.leaguePoints === "number" ? rankedEntry.leaguePoints : null;

  const tierRank = `${tier} ${rank}`.trim();
  const lpText = lp == null ? "" : ` ${lp}LP`;

  return `티어: ${tierRank}${lpText}`.trim();
}

function placementToEmoji(n) {
  return PLACEMENT_EMOJI[n] || "▫️";
}

/* =========================
 * Small Utilities
 * ========================= */

function matchCacheKey(matchId) {
  return `tft:match:${matchId}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* =========================
 * Perf Summary
 * ========================= */

const perf = {
  riot: { count: 0, totalMs: 0 },
  redisHit: { count: 0, totalMs: 0 },
};

const MIN_RIOT_SAMPLES = 30;
const MIN_REDIS_HIT_SAMPLES = 30;

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function resetPerf() {
  perf.riot.count = 0;
  perf.riot.totalMs = 0;
  perf.redisHit.count = 0;
  perf.redisHit.totalMs = 0;
}

function printFinalPerf() {
  if (perf.riot.count === 0 && perf.redisHit.count === 0) {
    console.log("Cache Performance: 측정된 호출이 없습니다.");
    return;
  }

  const riotAvg =
    perf.riot.count > 0 ? Math.round(perf.riot.totalMs / perf.riot.count) : 0;

  const redisAvg =
    perf.redisHit.count > 0
      ? Math.round(perf.redisHit.totalMs / perf.redisHit.count)
      : 0;

  const isSampleEnough =
    perf.riot.count >= MIN_RIOT_SAMPLES &&
    perf.redisHit.count >= MIN_REDIS_HIT_SAMPLES;

  console.log(`
================ Cache Performance =================
Riot API 평균:  ${riotAvg}ms (${perf.riot.count}건)
Redis Hit 평균: ${redisAvg}ms (${perf.redisHit.count}건)
${isSampleEnough ? "→ 유의미한 비교 가능" : "→ 표본 수 부족 (참고용)"}
===================================================
`);
}

