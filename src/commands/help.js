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

    // ==========================================
    // SLASH COMMAND
    // ==========================================
    async execute(interaction) {
        try {
            // Acknowledge interaction immediately
            await interaction.deferReply({
                flags: MessageFlags.IsComponentsV2,
            });

            const helpMessage = buildHelp(
                interaction.user,
                interaction.client
            );

            // Edit the deferred reply
            await interaction.editReply(helpMessage);

        } catch (error) {
            console.error('[HELP COMMAND ERROR]', error);

            // If interaction was already acknowledged
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Failed to load the help menu.',
                }).catch(() => {});
                return;
            }

            // If interaction is still usable
            await interaction.reply({
                content: '❌ Failed to load the help menu.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    },

    // ==========================================
    // PREFIX COMMAND
    // ==========================================
    async prefixExecute(message, _args, client) {
        try {
            await message.reply(
                buildHelp(message.author, client)
            );
        } catch (error) {
            console.error('[PREFIX HELP ERROR]', error);

            await message.reply(
                '❌ Failed to load the help menu.'
            ).catch(() => {});
        }
    },
};


// ==========================================
// HELP MENU BUILDER
// ==========================================

function buildHelp(user, client) {
    const avatar = user.displayAvatarURL({
        size: 128,
        extension: 'png',
    });

    const botAvatar = client.user.displayAvatarURL({
        size: 128,
        extension: 'png',
    });

    const c = new ContainerBuilder()
        .setAccentColor(0xFF3366);

    // ==========================================
    // HEADER
    // ==========================================

    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ⚡ Quest Completer Bot • COMMAND MATRIX\n` +
                    `-# Operator: **${user.username}** | System Status: **ONLINE**`
                ),
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder()
                    .setURL(botAvatar)
            ),
    );

    c.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    // ==========================================
    // TOKEN CORE
    // ==========================================

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🔐 **[ TOKEN CORE ]**\n` +
            `▫️ \`/link\` (\`${PREFIX}link\`) ➔ Link session token\n` +
            `▫️ \`/unlink\` (\`${PREFIX}unlink\`) ➔ Purge token data\n` +
            `▫️ \`/tokencheck\` (\`${PREFIX}tokencheck\`) ➔ Validate token health`
        ),
    );

    c.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    // ==========================================
    // QUEST ENGINE
    // ==========================================

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🎮 **[ QUEST ENGINE ]**\n` +
            `▫️ \`/quest\` (\`${PREFIX}quest\`) ➔ Execute single quest protocol\n` +
            `▫️ \`/q\` (\`${PREFIX}q\`) ➔ Auto-run all active quests\n` +
            `▫️ \`/questlist\` (\`${PREFIX}questlist\`) ➔ Scan quest database\n` +
            `▫️ \`/autoquest\` (\`${PREFIX}autoquest\`) ➔ Autonomous background runner`
        ),
    );

    c.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    // ==========================================
    // SYSTEM TERMINAL
    // ==========================================

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🛠️ **[ SYSTEM TERMINAL ]**\n` +
            `▫️ \`/ping\` (\`${PREFIX}ping\`) ➔ Measure node latency\n` +
            `▫️ \`/help\` (\`${PREFIX}help\`) ➔ Access command matrix`
        ),
    );

    c.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    // ==========================================
    // FOOTER
    // ==========================================

    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# 🌐 Active Nodes: **${client.guilds.cache.size}** servers  •  Active Prefix: \`${PREFIX}\``
                ),
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder()
                    .setURL(avatar)
            ),
    );

    // ==========================================
    // SUPPORT BUTTON
    // ==========================================

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Join Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/6Dag66TfKE')
            .setEmoji('🌐')
    );

    // ==========================================
    // FINAL RESPONSE
    // ==========================================

    return {
        components: [c, row],
        flags: MessageFlags.IsComponentsV2,
    };
}
