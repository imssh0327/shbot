const { riotGet } = require("../../../lib/riot");

const KR_API = "https://kr.api.riotgames.com";

async function getTftLeagueByPuuid(puuid) {
  const url = `${KR_API}/tft/league/v1/by-puuid/` + encodeURIComponent(puuid);
  return riotGet(url);
}

function normalizeTftRankedEntry(leagueData) {
  if (!leagueData) return null;

  if (Array.isArray(leagueData)) {
    return leagueData.find((e) => e && e.queueType === "RANKED_TFT") || leagueData[0] || null;
  }

  return leagueData;
}

async function getTftRankedEntry(puuid) {
  try {
    const leagueData = await getTftLeagueByPuuid(puuid);
    return normalizeTftRankedEntry(leagueData);
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

module.exports = {
  getTftRankedEntry,
  normalizeTftRankedEntry,
};
