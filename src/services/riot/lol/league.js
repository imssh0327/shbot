const { riotGet } = require("../../../lib/riot");

const KR_API = "https://kr.api.riotgames.com";

async function getLolLeagueEntriesByPuuid(puuid) {
  const url =
    `${KR_API}/lol/league/v4/entries/by-puuid/` + encodeURIComponent(puuid);
  return riotGet(url);
}

function normalizeLolRankedEntry(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  return (
    entries.find((e) => e && e.queueType === "RANKED_SOLO_5x5") ||
    entries.find((e) => e && e.queueType === "RANKED_FLEX_SR") ||
    entries[0] ||
    null
  );
}

async function safeGetLolLeagueEntriesByPuuid(puuid) {
  try {
    const entries = await getLolLeagueEntriesByPuuid(puuid);
    return Array.isArray(entries) ? entries : [];
  } catch (e) {
    if (e && e.status === 404) return [];
    throw e;
  }
}

async function getLolRankedEntry(puuid) {
  const entries = await safeGetLolLeagueEntriesByPuuid(puuid);
  return normalizeLolRankedEntry(entries);
}

module.exports = {
  getLolRankedEntry,
  safeGetLolLeagueEntriesByPuuid,
  normalizeLolRankedEntry,
};
