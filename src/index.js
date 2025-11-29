// 1. .env 파일을 읽어서 process.env 에 환경변수로 넣어주는 역할
require("dotenv").config();

// 2. discord.js 에서 필요한 클래스 import
const { Client, GatewayIntentBits } = require("discord.js");

// 3. 클라이언트(봇) 인스턴스 생성
const client = new Client({
  intents: [
    // 봇이 어떤 이벤트를 받을지 설정
    GatewayIntentBits.Guilds,          // 서버(길드) 관련 이벤트
    GatewayIntentBits.GuildMessages,   // 서버 안의 메시지 이벤트
    GatewayIntentBits.MessageContent   // 메시지 내용 접근 권한
  ],
});

// 4. 봇이 로그인되어 준비되었을 때 한 번만 호출되는 이벤트
client.once("ready", () => {
  console.log(`봇 로그인 완료: ${client.user.tag}`);
});

// 5. 메시지가 생성될 때마다 호출되는 이벤트
client.on("messageCreate", (message) => {
  // (1) 봇 자신이 보낸 메시지는 무시
  if (message.author.bot) return;

  // (2) "!ping" 이라는 내용이 오면 "pong" 으로 답장
  if (message.content === "!ping") {
    message.reply("pong");
  }
});

// 6. 디스코드에 로그인 (봇 토큰 사용)
client.login(process.env.DISCORD_BOT_TOKEN);