const { resolvePuuidByRiotId } = require("../riot/account");
const { getLolRankedEntry } = require("./league");
const { getRecentRankedSummaries } = require("./matches");

const RECENT_MATCH_ID_COUNT = 30;
const RANKED_RESULT_LIMIT = 10;

async function runLolRecord({ gameName, tagLine }) {
  const puuid = await resolvePuuidByRiotId(gameName, tagLine);
  if (!puuid) return "PUUID를 가져오지 못했습니다. Riot ID를 확인해 주세요.";

  const rankedEntry = await getLolRankedEntry(puuid);

  const recent = await getRecentRankedSummaries({
    puuid,
    recentMatchIdCount: RECENT_MATCH_ID_COUNT,
    limit: RANKED_RESULT_LIMIT,
  });

  const summaryLine =
    recent.length > 0
      ? recent.map((r) => toResultMark(r.win)).join(" ")
      : "랭크 경기 기록이 확인되지 않습니다.";

  const detailLines =
    recent.length > 0
      ? recent.map((r, i) => formatOneGameLine(i + 1, r)).join("\n")
      : "";

  return formatOutput({
    gameName,
    tagLine,
    rankedEntry,
    summaryLine,
    detailLines,
  });
}

function formatOutput({ gameName, tagLine, rankedEntry, summaryLine, detailLines }) {
  const lines = [];
  lines.push(`${gameName}#${tagLine}`);
  lines.push(formatTierLine(rankedEntry));
  lines.push("최근 랭크 10경기");
  lines.push(String(summaryLine || ""));
  if (detailLines) {
    lines.push("");
    lines.push(detailLines);
  }
  lines.push("");
  return lines.join("\n");
}

function formatTierLine(entry) {
  if (!entry) return "티어: Unranked";

  const tier = entry.tier || "";
  const rank = entry.rank || "";
  const lp = typeof entry.leaguePoints === "number" ? entry.leaguePoints : null;
  const queueType = entry.queueType || "";

  const tierRank = `${tier} ${rank}`.trim();
  const lpText = lp == null ? "" : ` ${lp}LP`;
  const queueText = queueType === "RANKED_SOLO_5x5" ? " (솔랭)" : " (랭크)";

  return `티어: ${tierRank}${lpText}${queueText}`.trim();
}

function toResultMark(win) {
  return win ? "✅" : "❌";
}

function formatOneGameLine(idx, r) {
  const kdaText = `${r.kills}/${r.deaths}/${r.assists}`;
  const res = r.win ? "승" : "패";
  const date = r.dateText || "";
  return `${idx}. ${res} ${r.champion} ${kdaText} (${date})`;
}

module.exports = { runLolRecord };
