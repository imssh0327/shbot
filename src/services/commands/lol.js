const { SlashCommandBuilder } = require("discord.js");
const { handleRiotError } = require("../../lib/riot");
const { runLolRecord } = require("../lol/record");

module.exports = {
  data: buildCommand(),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const sub = interaction.options.getSubcommand();

      if (sub === "record") {
        const gameName = interaction.options.getString("game", true).trim();
        const tagLine = interaction.options.getString("tag", true).trim();

        const out = await runLolRecord({ gameName, tagLine });
        await interaction.editReply(out);
        return;
      }

      await interaction.editReply("지원하지 않는 명령어입니다.");
    } catch (e) {
      const handled = await handleRiotError(interaction, e);
      if (handled) return;

      console.error("lol 커맨드 에러:", e);
      await interaction.editReply("전적 조회 중 오류가 발생했습니다. 서버 로그를 확인해 주세요.");
    }
  },
};

function buildCommand() {
  return new SlashCommandBuilder()
    .setName("lol")
    .setDescription("리그 오브 레전드 관련 기능")
    .addSubcommand((sub) =>
      sub
        .setName("record")
        .setDescription("LOL 솔랭 티어 및 최근 랭크 10경기 요약을 조회합니다.")
        .setNameLocalizations({ ko: "전적검색" })
        .setDescriptionLocalizations({
          ko: "LOL 솔랭 티어 및 최근 랭크 10경기 요약을 조회합니다.",
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
    );
}