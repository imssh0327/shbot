const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { YOUTUBE_API_KEY } = require("../config/env");

/**
 * YouTube 검색 API 호출
 * - endpoint: https://www.googleapis.com/youtube/v3/search
 * - part=snippet : 제목/채널/썸네일 등 snippet 정보 포함
 * - type=video   : 영상만 검색 (채널/재생목록 제외)
 */

async function searchYouTube(query, maxResults = 5) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("q", query);
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
    });

    const data = await res.json();

    if (!res.ok) {
        const msg = data?.error?.message || 'Youtube API 오류 (HTTP ${res.status})';
        throw new Error(msg);
    }

    return data.items ?? [];
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName("검색")
    .setDescription("YouTube에서 검색을 진행합니다.")
    .addStringOption((opt) =>
    opt.setName("검색어").setDescription("검색할 키워드를 입력해주세요.").setRequired(true)
    ),

    async execute(interaction) {
        const query = interaction.options.getString("검색어", true);
        await interaction.deferReply();

        let items;
        try {
            items = await searchYouTube(query, 5);
        } catch (error) {
            return interaction.editReply(`X ${error.message}`);
        }

        if (!items.length) {
            return interaction.editReply('검색 결과가 없습니다.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`YouTube 검색: ${query}`)
            .setDescription('상위 5개')
            .setTimestamp(new Date());

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const videoId = it?.id?.videoId;
            const title = it?.snippet?.title ?? '(제목 없음)';
            const channel = it?.snippet?.channelTitle ?? '(채널 없음)';
            const publishedAt = it?.snippet?.publishedAt
            ? new Date(it.snippet.publishedAt).toISOString().slice(0, 10)
            : "(날짜 없음)";

            const link = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "(링크 없음)";

            embed.addFields({
                name: `${i + 1}. ${title}`,
                value: `${link}\n채널: **${channel}** · 업로드: **${publishedAt}**`,
            });
        }

        return interaction.editReply({ embeds: [embed]});
    },
};