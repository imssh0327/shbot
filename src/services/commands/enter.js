const { SlashCommandBuilder } = require("discord.js");
const { connectToUserChannel } = require("../voice/connection");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("입장")
        .setDescription("봇을 현재 음성 채널에 입장시킵니다."),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            await connectToUserChannel(interaction);
            await interaction.editReply("✅ 음성 채널에 입장했습니다.");
        } catch (e) {
            console.error("입장 명령어 에러:", e);
            await interaction.editReply(`❌ ${e.message}`);
        }
    },
};