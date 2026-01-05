const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const { DISCORD_BOT_TOKEN } = require("./config/env");
const fs = require("node:fs");
const path = require("node:path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // 서버 관련
    GatewayIntentBits.GuildMessages, // 메시지
    GatewayIntentBits.MessageContent, // 내용
    GatewayIntentBits.GuildVoiceStates, // 음성 채널
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "services", "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.name && typeof command.execute === "function") {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once("ready", () => {
  console.log(`✅ 봇 로그인 완료: ${client.user.tag}`);
  console.log(`📊 봇이 ${client.guilds.cache.size}개의 서버에 있습니다.`);
});

/**
 * 슬래시 커맨드 처리
 * - 사용자가 /검색 실행하면 interactionCreate 이벤트로 들어옴
 * - commandName으로 해당 커맨드를 찾아 execute 실행
 */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error("❌ 커맨드 실행 에러:", error);

    const msg = "❌ 실행 중 오류가 발생했습니다.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// 에러 핸들링
client.on("error", (error) => {
  console.error("❌ Discord 클라이언트 에러:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ 처리되지 않은 Promise 거부:", error);

  // Intent 관련 에러인 경우 명확한 안내 메시지
  if (error.message && error.message.includes("disallowed intents")) {
    console.error("\n⚠️  Intent 활성화가 필요합니다!");
    console.error("📝 Discord Developer Portal에서 다음 단계를 수행하세요:");
    console.error("   1. https://discord.com/developers/applications 접속");
    console.error("   2. 봇 애플리케이션 선택");
    console.error("   3. 'Bot' 메뉴로 이동");
    console.error("   4. 'Privileged Gateway Intents' 섹션에서");
    console.error("      ✅ 'MESSAGE CONTENT INTENT' 활성화");
    console.error("   5. 변경사항 저장");
    console.error("   6. 봇을 서버에서 제거 후 재초대 (필요시)\n");
  }
});

client.login(DISCORD_BOT_TOKEN);
