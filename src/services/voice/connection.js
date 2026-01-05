const { 
    joinVoiceChannel,
    getVoiceConnection,
    entersState,
    VoiceConnectionStatus,
    } = require("@discordjs/voice");

async function connectToUserChannel(interaction) {
    const channel = interaction.member?.voice?.channel;

    if (!channel) {
        throw new Error("먼저 음성 채널에 입장하세요.");
    }

    const guildId = interaction.guild.id;
    let connection = getVoiceConnection(guildId);
    
    // 기존 연결이 있고 다른 채널에 있으면 재연결
    if (connection && connection.joinConfig.channelId !== channel.id) {
        connection.destroy();
        connection = null;
    }
    
    if (!connection) {
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true,
        });
    }

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (e) {
        connection.destroy();
        throw new Error(`음성 연결 실패: ${e.message}`);
    }
    return connection;
}

module.exports = { connectToUserChannel };