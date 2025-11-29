// src/bot.js
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { DISCORD_BOT_TOKEN } = require("./config/env");
const { extractNumbersFromImage } = require("./ocr/ocrService");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,          // 서버 관련
    GatewayIntentBits.GuildMessages,   // 메시지
    GatewayIntentBits.MessageContent,  // 내용
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.once("ready", () => {
  console.log(`✅ 봇 로그인 완료: ${client.user.tag}`);
  console.log(`📊 봇이 ${client.guilds.cache.size}개의 서버에 있습니다.`);
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

/**
 * 사용 예시:
 * 유저가 " !분석 " 이라는 메시지와 함께 이미지 첨부
 */
client.on("messageCreate", async (message) => {
  // 봇 자체 메시지 무시
  if (message.author.bot) return;

  // 커맨드 파싱 (매우 단순한 예시)
  const content = message.content.trim();

  if (content === "!분석") {
    // 첨부파일 존재 여부 체크
    const attachment = message.attachments.first();
    if (!attachment) {
      await message.reply("이미지가 첨부되어 있지 않습니다. 이미지와 함께 `!분석` 을 보내주세요.");
      return;
    }

    const imageUrl = attachment.url;
    await message.reply("이미지 분석 중입니다. 잠시만 기다려주세요...");

    try {
      // URL 그대로 tesseract.js에 넘겨서 OCR 수행
      const { text, numbers } = await extractNumbersFromImage(imageUrl);

      if (!numbers.length) {
        await message.reply("숫자를 찾지 못했습니다. 이미지가 너무 흐리거나 글자가 작을 수 있습니다.");
        return;
      }

      // 간단하게 상위 몇 개만 보여주는 예시
      const preview = numbers.slice(0, 10).join(", ");

      await message.reply(
        [
          "📊 이미지에서 인식한 숫자들 일부입니다:",
          `\`\`\`\n${preview}\n\`\`\``,
          // 필요시 전체 텍스트도 간단히 출력 가능 (너무 길면 생략 권장)
          // `전체 텍스트:\n\`\`\`${text.slice(0, 300)}...\`\`\``
        ].join("\n")
      );
    } catch (err) {
      console.error(err);
      await message.reply("이미지 분석 중 오류가 발생했습니다.");
    }
  }
});

client.login(DISCORD_BOT_TOKEN);