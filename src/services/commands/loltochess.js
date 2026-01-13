const { SlashCommandBuilder } = require("discord.js");
const { riotGet, handleRiotError } = require("../../lib/riot");
const { redis, ensureRedis } = require("../../lib/redis");

const ASIA_API = "https://asia.api.riotgames.com";
const KR_API = "https://kr.api.riotgames.com";
const TFT_RANKED_QUEUE_ID = 1100;
// matchDto 캐시 TTL (초) - 7일
const MATCH_CACHE_TTL_SEC = 60 * 60 * 24 * 7;
const NAKTA_GAME_NAME = "롤체는너무어려워";
const NAKTA_TAG = "운빨게임";


module.exports = {
  data: new SlashCommandBuilder()
    .setName("tft")
    .setDescription("롤토체스 관련 기능")
    .addSubcommand((sub) =>
      sub
        .setName("record")
        .setDescription("롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다.")
        .setNameLocalizations({ ko: "전적검색" })
        .setDescriptionLocalizations({ ko: "롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다." })
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
        .setDescriptionLocalizations({ ko: "롤체는너무어려워#운빨게임 전적을 자동 조회합니다." })
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const sub = interaction.options.getSubcommand();

      // /tft 전적검색 <닉네임><태그>
      if (sub === "record") {
        const gameName = interaction.options.getString("game", true).trim();
        const tagLine = interaction.options.getString("tag", true).trim();

        const out = await runTftRecord({ gameName, tagLine });
        await interaction.editReply(out);
        return;
      }

      // /tft 낙타
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

async function runTftRecord({ gameName, tagLine }) {
  // 1) Riot ID -> PUUID
  const account = await getAccountByRiotId(gameName, tagLine);
  const puuid = account?.puuid;

  if (!puuid) {
    return "PUUID를 가져오지 못했습니다. Riot ID를 확인해 주세요.";
  }

  // 2) 티어 및 LP: PUUID 기반 조회
  let rankedEntry = null;
  try {
    const leagueData = await getTftLeagueByPuuid(puuid);
    rankedEntry = normalizeRankedEntry(leagueData);
  } catch (e) {
    // 랭크 기록이 없으면 404가 날 수 있으므로 Unranked로 처리
    if (e?.status === 404) {
      rankedEntry = null;
    } else {
      throw e;
    }
  }

  // 3) 최근 매치 IDs를 가져온 뒤, match 상세에서 랭크만 10개 선별
  const matchIds = await getRecentTftMatchIds(puuid, 30);

  const rankedResults = await collectRecentRankedPlacements({
    puuid,
    matchIds,
    limit: 10,
  });

  if (rankedResults.length === 0) {
    const out = formatOutput({
      gameName,
      tagLine,
      rankedEntry,
      emojiLine: "랭크 경기 기록이 확인되지 않습니다.",
      rankedResults,
    });
    return out;
  }

  const emojiLine = rankedResults
    .map((r) => placementToEmoji(r.placement))
    .join(" ");

  const out = formatOutput({
    gameName,
    tagLine,
    rankedEntry,
    emojiLine,
    rankedResults,
  });

  return out;
}

async function getAccountByRiotId(gameName, tagLine) {
  const url =
    `${ASIA_API}/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(gameName)}/` +
    `${encodeURIComponent(tagLine)}`;

  return riotGet(url);
}

// 티어 및 LP 조회: PUUID 기반
async function getTftLeagueByPuuid(puuid) {
  const url = `${KR_API}/tft/league/v1/by-puuid/` + encodeURIComponent(puuid);
  return riotGet(url);
}

// by-puuid 응답 형태가 단일 객체인 경우가 일반적이므로 단일을 기본으로 처리
// 만약 배열로 오는 환경도 대비
function normalizeRankedEntry(leagueData) {
  if (!leagueData) return null;

  if (Array.isArray(leagueData)) {
    // 혹시 배열로 내려오면 RANKED_TFT 우선
    return leagueData.find((e) => e?.queueType === "RANKED_TFT") || leagueData[0] || null;
  }

  // 단일 객체라면 그대로 사용
  return leagueData;
}

async function getRecentTftMatchIds(puuid, count = 30) {
  const url =
    `${ASIA_API}/tft/match/v1/matches/by-puuid/` +
    `${encodeURIComponent(puuid)}` +
    `/ids?count=${encodeURIComponent(String(count))}`;

  return riotGet(url);
}

// matchDto Redis 캐시 적용
async function getMatchDto(matchId) {
  const key = matchCacheKey(matchId);

  // 1) Redis에서 조회
  try {
    await ensureRedis();

    const redisGetStart = nowMs();
    const cached = await redis.get(key);
    const redisGetEnd = nowMs();

    if (cached) {
      const redisHitMs = redisGetEnd - redisGetStart;

      perf.redisHit.count += 1;
      perf.redisHit.totalMs += redisHitMs;

      printFinalPerfOnce();

      return JSON.parse(cached);
    }

    console.log("[cache miss]", matchId);
  } catch (e) {
    console.error("[redis get failed]", e?.message || e);
  }

  // 2) 캐시가 없으면 Riot API 호출
  const url = `${ASIA_API}/tft/match/v1/matches/${encodeURIComponent(matchId)}`;

  const riotStart = nowMs();
  const matchDto = await riotGet(url);
  const riotEnd = nowMs();

  const riotMs = riotEnd - riotStart;
  perf.riot.count += 1;
  perf.riot.totalMs += riotMs;

  printFinalPerfOnce();

  // 3) Redis에 저장
  try {
    await ensureRedis();
    await redis.set(key, JSON.stringify(matchDto), { EX: MATCH_CACHE_TTL_SEC });
    console.log("[redis set ok]", matchId);
  } catch (e) {
    console.error("[redis set failed]", e?.message || e);
  }

  return matchDto;
}


function isRankedTftMatch(matchDto) {
  return matchDto?.info?.queue_id === TFT_RANKED_QUEUE_ID;
}

function extractPlacement(matchDto, puuid) {
  const participants = matchDto?.info?.participants;
  if (!Array.isArray(participants)) return null;

  const me = participants.find((p) => p.puuid === puuid);
  return me?.placement ?? null;
}

function extractDateText(matchDto) {
  const ts = matchDto?.info?.game_datetime;
  if (!ts) return "날짜 없음";

  try {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "날짜 없음";
  }
}

async function collectRecentRankedPlacements({ puuid, matchIds, limit }) {
  const out = [];
  if (!Array.isArray(matchIds) || matchIds.length === 0) return out;

  for (let i = 0; i < matchIds.length; i += 1) {
    const matchId = matchIds[i];
    const matchDto = await getMatchDto(matchId);

    if (!isRankedTftMatch(matchDto)) {
      await sleep(120);
      continue;
    }

    const placement = extractPlacement(matchDto, puuid);
    const dateText = extractDateText(matchDto);

    if (placement != null) {
      out.push({ placement, dateText, matchId });
    }

    if (out.length >= limit) break;

    // 429 방지
    await sleep(150);
  }

  return out;
}

function placementToEmoji(n) {
  switch (n) {
    case 1:
      return "1️⃣";
    case 2:
      return "2️⃣";
    case 3:
      return "3️⃣";
    case 4:
      return "4️⃣";
    case 5:
      return "5️⃣";
    case 6:
      return "6️⃣";
    case 7:
      return "7️⃣";
    case 8:
      return "8️⃣";
    default:
      return "▫️";
  }
}

function formatTierLine(rankedEntry) {
  if (!rankedEntry) return "티어: Unranked";

  const tier = rankedEntry.tier || "";
  const rank = rankedEntry.rank || "";
  const lp =
    typeof rankedEntry.leaguePoints === "number" ? rankedEntry.leaguePoints : null;

  // 마스터 이상은 rank가 없을 수 있어 tier만 찍히는 경우도 방어
  const tierRank = `${tier} ${rank}`.trim();
  const lpText = lp == null ? "" : ` ${lp}LP`;

  return `티어: ${tierRank}${lpText}`.trim();
}

function formatOutput({ gameName, tagLine, rankedEntry, emojiLine, rankedResults }) {
  const lines = [];
  lines.push(`${gameName}#${tagLine}`);
  lines.push(formatTierLine(rankedEntry));
  lines.push(`최근 랭크 10경기`);
  lines.push(`${emojiLine}`);
  lines.push("");
  return lines.join("\n");
}

function matchCacheKey(matchId) {
  return `tft:match:${matchId}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const perf = {
  riot: { count: 0, totalMs: 0 },
  redisHit: { count: 0, totalMs: 0 },
  printed: false,
};

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

const MIN_RIOT_SAMPLES = 10;
const MIN_REDIS_HIT_SAMPLES = 10;

function printFinalPerfOnce() {
  if (perf.printed) return;
  if (perf.riot.count < MIN_RIOT_SAMPLES) return;
  if (perf.redisHit.count < MIN_REDIS_HIT_SAMPLES) return;

  perf.printed = true;

  const riotAvg = Math.round(perf.riot.totalMs / perf.riot.count);
  const redisAvg = Math.round(perf.redisHit.totalMs / perf.redisHit.count);

  const improvement = redisAvg > 0 ? Math.round(riotAvg / redisAvg) : 0;
  const saved = riotAvg - redisAvg;

  console.log(`
================ Cache Performance =================
Riot API 직접 호출 평균: ${riotAvg}ms
Redis 캐시 hit 평균:     ${redisAvg}ms

→ 약 ${improvement}배 성능 개선
→ 약 ${saved}ms 단축
===================================================
`);
}
