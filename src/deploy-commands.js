const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const { DISCORD_BOT_TOKEN, CLIENT_ID, GUILD_ID } = require("./config/env");

/**
 * 커맨드 파일을 모두 읽어서 Discord에 등록
 * - 개발 중엔 Guild Commands로 등록하면 즉시 반영됨
 */
function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");

  if (!fs.existsSync(commandsPath)) return commands;

  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.toJSON) {
      commands.push(command.data.toJSON());
    }
  }

  return commands;
}

(async () => {
  const commands = loadCommands();
  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log(`✅ 슬래시 커맨드 등록 완료: ${commands.length}개`);
})();