const { riotGet } = require("../../lib/riot");

const ASIA_API = "https://asia.api.riotgames.com";

async function getAccountByRiotId(gameName, tagLine) {
  const url =
    `${ASIA_API}/riot/account/v1/accounts/by-riot-id/` +
    `${encodeURIComponent(gameName)}/` +
    `${encodeURIComponent(tagLine)}`;
  return riotGet(url);
}

async function resolvePuuidByRiotId(gameName, tagLine) {
  const account = await getAccountByRiotId(gameName, tagLine);
  return account && account.puuid ? account.puuid : null;
}

module.exports = {
  getAccountByRiotId,
  resolvePuuidByRiotId,
};
