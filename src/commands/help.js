import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { PREFIX } from '../utils/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('See all available commands'),
    prefix: 'help',

    async execute(interaction) {
        await interaction.reply(buildHelp(interaction.user, interaction.client));
    },

    async prefixExecute(message, _a, client) {
        await message.reply(buildHelp(message.author, client));
    },
};

function buildHelp(user, client) {
    const avatar = user.displayAvatarURL({ size: 128, extension: 'png' });
    const botAvatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const c = new ContainerBuilder().setAccentColor(0xFF3366);

    // ── Header Matrix ───────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ⚡ INŠANE DYNASTY • COMMAND MATRIX\n-# Operator: **${user.username}** | System Status: **ONLINE**`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Token Core ──────────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🔐 **[ TOKEN CORE ]**\n` +
            `▫️ \`/link\` (\`${PREFIX}link\`) ➔ Link session token\n` +
            `▫️ \`/unlink\` (\`${PREFIX}unlink\`) ➔ Purge token data\n` +
            `▫️ \`/tokencheck\` (\`${PREFIX}tokencheck\`) ➔ Validate token health`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Quest Engine ────────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🎮 **[ QUEST ENGINE ]**\n` +
            `▫️ \`/quest\` (\`${PREFIX}quest\`) ➔ Execute single quest protocol\n` +
            `▫️ \`/q\` (\`${PREFIX}q\`) ➔ Auto-run all active quests\n` +
            `▫️ \`/questlist\` (\`${PREFIX}questlist\`) ➔ Scan quest database\n` +
            `▫️ \`/autoquest\` (\`${PREFIX}autoquest\`) ➔ Autonomous background runner`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── System Terminal ─────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🛠️ **[ SYSTEM TERMINAL ]**\n` +
            `▫️ \`/ping\` (\`${PREFIX}ping\`) ➔ Measure node latency\n` +
            `▫️ \`/help\` (\`${PREFIX}help\`) ➔ Access command matrix`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Footer Stats ────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# 🌐 Active Nodes: **${client.guilds.cache.size}** servers  •  Active Prefix: \`${PREFIX}\``,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );

    // ── Action Row (Support / Server Button) ────────────────────────────────
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Join InŠane DyNaStY')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/4ZFTsKCkYP')
            .setEmoji('🌐'),
    );

    return { 
        components: [c, row], 
        flags: MessageFlags.IsComponentsV2 
    };
}
