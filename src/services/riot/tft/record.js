const { resolvePuuidByRiotId } = require("../account");
const { getTftRankedEntry } = require("./league");
const { getRecentTftMatchIds, collectRecentRankedPlacements } = require("./matches");

const RECENT_MATCH_ID_COUNT = 30;
const RANKED_RESULT_LIMIT = 10;

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

async function runTftRecord({ gameName, tagLine }) {
  const puuid = await resolvePuuidByRiotId(gameName, tagLine);
  if (!puuid) return "PUUID를 가져오지 못했습니다. Riot ID를 확인해 주세요.";

  const rankedEntry = await getTftRankedEntry(puuid);
  const matchIds = await getRecentTftMatchIds(puuid, RECENT_MATCH_ID_COUNT);
  const recent = await collectRecentRankedPlacements({
    puuid,
    matchIds,
    limit: RANKED_RESULT_LIMIT,
  });

  const summaryLine =
    recent.length > 0
      ? recent.map((r) => placementToEmoji(r.placement)).join(" ")
      : "랭크 경기 기록이 확인되지 않습니다.";

  // ❌ detailLines 제거
  return formatOutput({
    gameName,
    tagLine,
    rankedEntry,
    summaryLine,
  });
}

function formatOutput({ gameName, tagLine, rankedEntry, summaryLine }) {
  const lines = [];
  lines.push(`${gameName}#${tagLine}`);
  lines.push(formatTierLine(rankedEntry));
  lines.push("최근 랭크 10경기");
  lines.push(String(summaryLine || ""));
  lines.push("");
  return lines.join("\n");
}

function formatTierLine(entry) {
  if (!entry) return "티어: Unranked";

  const tier = entry.tier || "";
  const rank = entry.rank || "";
  const lp = typeof entry.leaguePoints === "number" ? entry.leaguePoints : null;

  const tierRank = `${tier} ${rank}`.trim();
  const lpText = lp == null ? "" : ` ${lp}LP`;

  return `티어: ${tierRank}${lpText}`.trim();
}

function placementToEmoji(n) {
  return PLACEMENT_EMOJI[n] || "▫️";
}

module.exports = { runTftRecord };
