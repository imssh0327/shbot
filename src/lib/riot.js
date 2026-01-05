const { RIOT_API_KEY } = require("../config/env");

async function riotGet(url) {
  const res = await fetch(url, {
    headers: {
      "X-Riot-Token": RIOT_API_KEY,
      "User-Agent": "shbot/1.0",
    },
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    const err = new Error(`Riot API Error: ${res.status} ${text}`);
    err.status = res.status;
    err.body = text;
    err.url = url;
    throw err;
  }

  return text ? JSON.parse(text) : null;
}

const STATUS_MESSAGE_MAP = {
  403: "403 오류: API 키 권한 문제 또는 만료 가능성이 큽니다.",
  404: "404 오류: 해당 소환사명을 찾지 못했습니다.",
  429: "429 오류: 요청 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.",
};

async function handleRiotError(interaction, error) {
  const status = error?.status;
  const msg = STATUS_MESSAGE_MAP[status];
  if (!msg) return false;

  await editError(interaction, msg);
  return true;
}


async function editError(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content);
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (e) {
    // 디스코드 응답 자체가 실패한 경우를 대비
    console.error("Discord reply failed:", e);
  }
}

module.exports = {
  riotGet,
  handleRiotError,
};
