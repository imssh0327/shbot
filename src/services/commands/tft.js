const { SlashCommandBuilder } = require("discord.js");
const { handleRiotError } = require("../../lib/riot");
const { runTftRecord } = require("../riot/tft/record");

const NAKTA_GAME_NAME = "롤체는너무어려워";
const NAKTA_TAG = "운빨게임";

module.exports = {
  data: buildCommand(),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const sub = interaction.options.getSubcommand();

      if (sub === "record") {
        const gameName = interaction.options.getString("game", true).trim();
        const tagLine = interaction.options.getString("tag", true).trim();

        const out = await runTftRecord({ gameName, tagLine });
        await interaction.editReply(out);
        return;
      }

      if (sub === "camel") {
        const out = await runTftRecord({
          gameName: NAKTA_GAME_NAME,
          tagLine: NAKTA_TAG,
        });
        await interaction.editReply(out);
        return;
      }

      await interaction.editReply("지원하지 않는 명령어입니다.");
    } catch (e) {
      const handled = await handleRiotError(interaction, e);
      if (handled) return;

      console.error("tft 커맨드 에러:", e);
      await interaction.editReply("전적 조회 중 오류가 발생했습니다. 서버 로그를 확인해 주세요.");
    }
  },
};

function buildCommand() {
  return new SlashCommandBuilder()
    .setName("tft")
    .setDescription("롤토체스 관련 기능")
    .addSubcommand((sub) =>
      sub
        .setName("record")
        .setDescription("롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다.")
        .setNameLocalizations({ ko: "전적검색" })
        .setDescriptionLocalizations({
          ko: "롤토체스 티어 및 최근 랭크 10경기 등수를 조회합니다.",
        })
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("Riot ID 게임 닉네임")
            .setRequired(true)
            .setNameLocalizations({ ko: "닉네임" })
            .setDescriptionLocalizations({ ko: "Riot ID 게임 닉네임" })
        )
        .addStringOption((opt) =>
          opt
            .setName("tag")
            .setDescription("Riot ID 태그 (예: KR1)")
            .setRequired(true)
            .setNameLocalizations({ ko: "태그" })
            .setDescriptionLocalizations({ ko: "Riot ID 태그 (예: KR1)" })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("camel")
        .setDescription("롤체는너무어려워#운빨게임 전적을 조회합니다.")
        .setNameLocalizations({ ko: "낙타" })
        .setDescriptionLocalizations({
          ko: "롤체는너무어려워#운빨게임 전적을 자동 조회합니다.",
        })
    );
}
