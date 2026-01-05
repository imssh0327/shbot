const dotenv = require("dotenv");
dotenv.config();

const { DISCORD_BOT_TOKEN, CLIENT_ID, GUILD_ID, YOUTUBE_API_KEY, RIOT_API_KEY } = process.env;

if (!DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN 이 .env 에 설정되지 않았습니다.");
if (!CLIENT_ID) throw new Error("CLIENT_ID 이 .env 에 설정되지 않았습니다.");
if (!GUILD_ID) throw new Error("GUILD_ID 이 .env 에 설정되지 않았습니다.");
if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY 이 .env 에 설정되지 않았습니다.");
if (!RIOT_API_KEY) throw new Error("RIOT_API_KEY 이 .env 에 설정되지 않았습니다.");

module.exports = {
  DISCORD_BOT_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  YOUTUBE_API_KEY,
  RIOT_API_KEY
};
