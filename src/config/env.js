require("dotenv").config();

const { DISCORD_BOT_TOKEN } = process.env;

if (!DISCORD_BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN 이 .env 에 설정되지 않았습니다.");
}

module.exports = {
  DISCORD_BOT_TOKEN,
};
