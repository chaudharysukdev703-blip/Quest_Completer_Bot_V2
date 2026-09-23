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
    StringSelectMenuBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    Colors,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { QuestClient } from '../quest/questClient.js';
import { TokenStore } from '../quest/tokenStore.js';
import { enableAutoquest, disableAutoquest, isAutoquestEnabled } from '../quest/autoquestStore.js';
import { PREFIX } from '../utils/config.js';

// Access Control Function (Blocks DMs and checks for 'Quest Access' role or invites)
function checkUserAccess(member, interactionOrMessage) {
    if (interactionOrMessage && !interactionOrMessage.guild) return false;
    if (!member) return true;
    
    try {
        if (member.permissions && typeof member.permissions.has === 'function') {
            if (member.permissions.has('Administrator')) return true;
        }
    } catch (e) {}

    const userId = member.id || member.author?.id;
    if (!userId) return false;

    const dbPath = path.resolve('./invitesData.json');
    if (fs.existsSync(dbPath)) {
        try {
            const inviteData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const userInvites = inviteData[userId]?.count || 0;
            
            if (member.guild && member.roles) {
                const targetRole = member.guild.roles.cache.find(r => r.name === 'Quest Access');
                if (userInvites >= 2) {
                    if (targetRole && !member.roles.cache.has(targetRole.id)) {
                        member.roles.add(targetRole).catch(() => {});
                    }
                    return true;
                }
                return member.roles.cache.some(role => role.name === 'Quest Access');
            }
            if (userInvites >= 2) return true;
        } catch (err) {
            console.error('Database check error:', err);
        }
    }

    return member.roles?.cache?.some(role => role.name === 'Quest Access') || false;
}

function buildAccessDeniedCard() {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ❌ Access Denied\nYou cannot use quest commands in DMs, or you lack the required **Quest Access** role in the server.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

export function makeTokenStore(secret) {
    return new TokenStore(secret);
}

function sanitizeToken(raw) {
    return raw.trim()
        .replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
        .replace(/^`+|`+$/g, '')
        .replace(/^Bot\s+/i, '')
        .trim();
}

function isValidUserToken(token) {
    return token.length >= 50 && /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(token);
}

function buildLinkModal() {
    const modal = new ModalBuilder()
        .setCustomId('link_token_modal')
        .setTitle('Link Your Discord Token');
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('link_token_input')
                .setLabel('Your Discord user token')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Paste your token here...')
                .setRequired(true),
        ),
    );
    return modal;
}

function buildLinkPrompt() {
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔗 Token Required\nYou need to link your Discord token before using quest commands.\n\n### HOW TO FIND YOUR TOKEN\nPick your platform below:`,
        ),
    );
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    
    c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('platform_pc')
                .setLabel('Java Script')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🪄'),
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('link_prompt')
                .setLabel('🔗 Update Token')
                .setStyle(ButtonStyle.Primary),
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildNoQuestsCard() {
    const c = new ContainerBuilder().setAccentColor(0x4F545C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔍 No Quests Available\nThere are no active, uncompleted quests on your account right now.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildExpiredTokenCard() {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ❌ Token Expired\nYour saved token was rejected by Discord — it has likely expired.\n\n**Your token has been removed.** Re-link with \`/link\` or \`${PREFIX}link\`.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildErrorCard(err) {
    const msg = err?.message ?? String(err);
    const is401 = msg.includes('401');
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            is401
                ? `# ❌ Invalid or Expired Token\nRe-link your token with \`${PREFIX}link\`.`
                : `# ❌ Error\n${msg.slice(0, 800)}`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildQuestSelectCard(quests) {
    const ICONS = {
        PLAY_ON_DESKTOP: '🖥️', WATCH_VIDEO: '🎬', STREAM_ON_DESKTOP: '📺',
        PLAY_ACTIVITY: '🎮', WATCH_VIDEO_ON_MOBILE: '📱',
    };

    const lines = quests.map((q, i) => {
        const tasks = (q.config.task_config ?? q.config.task_config_v2)?.tasks ?? {};
        const taskKey = Object.keys(tasks)[0] ?? '';
        const icon = ICONS[taskKey] ?? '⚙️';
        const exp = Math.floor(new Date(q.config.expires_at).getTime() / 1000);
        return `**${i + 1}.** ${icon} **${q.config.messages.quest_name}**\n> *${q.config.messages.game_title}* •  Expires <t:${exp}:R>`;
    }).join('\n\n');

    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🎮 ${quests.length} Quest${quests.length !== 1 ? 's' : ''} Available\n${lines}\n\n*Use the dropdown below to pick one.*`,
        ),
    );
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`quest_select_${Date.now()}`)
        .setPlaceholder('Pick a quest...')
        .addOptions(
            quests.map((q) => {
                const tasks = (q.config.task_config ?? q.config.task_config_v2)?.tasks ?? {};
                const taskKey = Object.keys(tasks)[0] ?? '';
                return {
                    label: q.config.messages.quest_name.slice(0, 100),
                    description: q.config.messages.game_title.slice(0, 100),
                    value: q.id,
                    emoji: ICONS[taskKey] ?? '⚙️',
                };
            }),
        );

    c.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildQuestInfoCard(quest, phase, claimed = 0, failReason = '') {
    const cfg  = quest.config;
    const msgs = cfg.messages;
    const appId = cfg.application.id;

    const thumbUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${cfg.assets.game_tile}.png`;

    const TASK_META = {
        PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
        WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
        STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
        PLAY_ACTIVITY:         { icon: '🎮', label: 'Play Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
    };

    const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
        const meta = TASK_META[type] ?? { icon: '⚙️', label: type };
        let dur = '';
        if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') {
            dur = `  •  **${Math.ceil(task.target / 60)} min**`;
        } else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
            const s = task.target;
            dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
        }
        return `${meta.icon}${meta.label}${dur}${phase === 'done' ? '  ✅' : ''}`;
    });

    const rewardLines = cfg.rewards_config.rewards.map((r) => {
        let line = `**${r.messages.name}**`;
        if (r.orb_quantity) line += `  ✦ *(${r.orb_quantity} Orbs)*`;
        else if (r.quantity) line += `  *(${r.quantity}d Nitro)*`;
        return line;
    });

    const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
    const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

    const PHASE = {
        starting: { color: 0x5865F2, title: '⚙️  Solving Quest...',  bar: '`░░░░░░░░░░`  **0%** —  *Working on it...*' },
        done:     { color: 0x57F287, title: '✅  Quest Complete!',    bar: '`██████████`  **100%**' },
        failed:   { color: 0xED4245, title: '❌  Quest Failed',       bar: '' },
    };

    const p = PHASE[phase];
    const progressText = phase === 'failed' && failReason
        ? `\`░░░░░░░░░░\`  **0%**\n\`\`\`\n${failReason.slice(0, 300)}\n\`\`\``
        : p.bar;

    const footerNote = phase === 'done' && claimed > 0
        ? `-# 🎁 ${claimed} reward(s) claimed`
        : phase === 'starting'
        ? `-# Quest Bot  •  Please wait...`
        : phase === 'failed'
        ? `-# Requires manual completion in the Discord app`
        : '';

    const c = new ContainerBuilder().setAccentColor(p.color);

    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${p.title}\n### ${msgs.quest_name}\n*${msgs.game_title}* •  ${msgs.game_publisher}`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `📋 **Task**\n${taskLines.join('\n') || '*Unknown task*'}\n\n` +
            `📅 **Expires** <t:${expiresEpoch}:R>  *(${daysLeft}d left)*\n\n` +
            `📊 **Progress**\n${progressText || '`░░░░░░░░░░`  0%'}\n\n` +
            `🎁 **Reward**\n${rewardLines.join('\n') || '*No rewards listed*'}`,
        ),
    );

    if (footerNote) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerNote));
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

async function runQuestOne(userId, tokenStore, send) {
    const token = tokenStore.get(userId);
    if (!token) { await send(buildLinkPrompt()); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(buildNoQuestsCard()); return false; }

        const selMsg = await send(buildQuestSelectCard(valid));

        let selectedId;
        try {
            const interaction = await selMsg.awaitMessageComponent({
                filter: (i) => i.user.id === userId,
                time: 60_000,
                componentType: ComponentType.StringSelect,
            });
            await interaction.deferUpdate();
            selectedId = interaction.values[0];
        } catch {
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⏱️ Timed Out\nNo quest was selected within 60 seconds. Run \`${PREFIX}quest\` again.`));
            await selMsg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return false;
        }

        await selMsg.edit({ components: [], flags: MessageFlags.IsComponentsV2 });

        const quest = valid.find((q) => q.id === selectedId);
        const progressMsg = await send(buildQuestInfoCard(quest, 'starting'));

        const logs = [];
        const log = (m) => { console.log(m); logs.push(m); };
        const questDone = await manager.doingQuest(quest, log);

        if (!questDone) {
            const failReason = logs.filter(l => l.startsWith('[FAIL]')).slice(-2).join('\n') || logs.slice(-3).join('\n') || 'Could not be completed automatically.';
            await progressMsg.edit(buildQuestInfoCard(quest, 'failed', 0, failReason));
            return false;
        }

        const claimed = await manager.claimRewards(log).catch(() => 0);
        await progressMsg.edit(buildQuestInfoCard(quest, 'done', claimed));
        return true;

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId); disableAutoquest(userId);
            await send(buildExpiredTokenCard()).catch(() => {});
        } else {
            await send(buildErrorCard(err)).catch(() => {});
        }
        return false;
    }
}

async function runQuestAll(userId, tokenStore, send) {
    const token = tokenStore.get(userId);
    if (!token) { await send(buildLinkPrompt()); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(buildNoQuestsCard()); return false; }

        const progressMsgs = await Promise.all(valid.map((q) => send(buildQuestInfoCard(q, 'starting'))));

        const questLogs = valid.map(() => []);
        const questResults = await Promise.allSettled(
            valid.map((quest, i) => {
                const log = (m) => { console.log(m); questLogs[i].push(m); };
                return manager.doingQuest(quest, log);
            }),
        );

        const completed = valid.filter((_, i) => questResults[i].status === 'fulfilled' && questResults[i].value === true);
        const skipped   = valid.filter((_, i) => questResults[i].status === 'rejected' || (questResults[i].status === 'fulfilled' && questResults[i].value === false));

        await Promise.allSettled(skipped.map((q) => {
            const idx = valid.indexOf(q);
            const failLogs = questLogs[idx].filter(l => l.startsWith('[FAIL]'));
            const reason = questResults[idx].status === 'rejected'
                ? questResults[idx].reason?.message ?? 'Unknown error'
                : failLogs.slice(-2).join('\n') || questLogs[idx].slice(-3).join('\n') || 'Could not be completed automatically.';
            return progressMsgs[idx].edit(buildQuestInfoCard(q, 'failed', 0, reason));
        }));

        if (completed.length === 0) {
            const c = new ContainerBuilder().setAccentColor(0xFEE75C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚠️ No Quests Auto-Completed\nAll quests require manual completion via the Discord desktop or mobile app.`));
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return false;
        }

        const claimed = await manager.claimRewards(console.log).catch(() => 0);
        const claimedPer = completed.length > 0 ? Math.floor(claimed / completed.length) : 0;

        await Promise.allSettled(completed.map((q, i) => {
            const idx = valid.indexOf(q);
            return progressMsgs[idx].edit(buildQuestInfoCard(q, 'done', i === 0 ? claimed : claimedPer));
        }));
        return true;

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401') && tokenStore.has(userId)) {
            tokenStore.remove(userId); disableAutoquest(userId);
            await send(buildExpiredTokenCard()).catch(() => {});
        } else {
            await send(buildErrorCard(err)).catch(() => {});
        }
        return false;
    }
}

async function runQuestList(userId, tokenStore, send) {
    const token = tokenStore.get(userId);
    if (!token) { await send(buildLinkPrompt()); return; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const all = manager.list();
        if (all.length === 0) { await send(buildNoQuestsCard()); return; }

        const TASK_META = {
            PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
            WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
            STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
            PLAY_ACTIVITY:         { icon: '🎮', label: 'Play Activity' },
            WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
        };

        for (const q of all.slice(0, 10)) {
            const cfg = q.config;
            const msgs = cfg.messages;
            const appId = cfg.application.id;
            const thumbUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${cfg.assets.game_tile}.png`;
            const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
            const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

            const st = q.isCompleted() ? { color: 0x57F287, icon: '✅', label: 'Completed' }
                : q.isExpired()        ? { color: 0xED4245, icon: '🔴', label: 'Expired' }
                : q.isEnrolledQuest()  ? { color: 0xFEE75C, icon: '⏳', label: 'In Progress' }
                :                        { color: 0x5865F2, icon: '🔵', label: 'Available' };

            const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
                const meta = TASK_META[type] ?? { icon: '⚙️', label: type };
                let dur = '';
                if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') dur = `  •  **${Math.ceil(task.target / 60)} min**`;
                else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
                    const s = task.target;
                    dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
                }
                return `${meta.icon} ${meta.label}${dur}`;
            });

            const rewardLines = cfg.rewards_config.rewards.map((r) => {
                let line = `**${r.messages.name}**`;
                if (r.orb_quantity) line += `  ✦ *(${r.orb_quantity} Orbs)*`;
                else if (r.quantity) line += `  *(${r.quantity}d Nitro)*`;
                return line;
            });

            const c = new ContainerBuilder().setAccentColor(st.color);
            c.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# ${st.icon}  ${msgs.quest_name}\n*${msgs.game_title}* •  ${msgs.game_publisher}`,
                        ),
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl)),
            );
            c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `📊 **Status:** ${st.label}   📅 **Expires:** <t:${expiresEpoch}:R> *(${daysLeft}d)*\n\n` +
                    `📋 **Task**\n${taskLines.join('\n') || '*Unknown*'}\n\n` +
                    `🎁 **Reward**\n${rewardLines.join('\n') || '*No rewards listed*'}`,
                ),
            );
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (all.length > 10) {
            const c = new ContainerBuilder().setAccentColor(0x4F545C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# …and **${all.length - 10}** more quest(s) not shown.`));
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

    } catch (err) {
        await send(buildErrorCard(err)).catch(() => {});
    }
}

async function runTokenCheck(userId, tokenStore, replyFn) {
    const token = tokenStore.get(userId);

    if (!token) {
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# No Token Saved\nYou don't have a saved token. Use \`${PREFIX}link\` to save one.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    let valid = false, accountName = '';
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        valid = res.ok;
        if (res.ok) {
            const data = await res.json();
            accountName = data.global_name || data.username || '';
        }
    } catch { valid = false; }

    const c = new ContainerBuilder().setAccentColor(valid ? 0x57F287 : 0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            valid
                ? `# ✅ Token is Valid\nLinked as **"${accountName}"**.\n\nYour saved token is working correctly.`
                : `# ❌ Token Invalid or Expired\nYour saved token was rejected by Discord.\nUse \`${PREFIX}unlink\` then \`${PREFIX}link\` to save a fresh token.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
    if (!valid) tokenStore.remove(userId);
}

async function runAutoquestToggle(userId, tokenStore, replyFn) {
    if (isAutoquestEnabled(userId)) {
        disableAutoquest(userId);
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🤖 Auto-Quest Disabled\nI'll no longer auto-run new quests for you.\nUse \`${PREFIX}autoquest\` again to turn it back on.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }
    if (!tokenStore.has(userId)) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ No Saved Token\nAuto-Quest needs your Discord user token.\n\n**Use \`${PREFIX}link\` first**, then run \`${PREFIX}autoquest\` again.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }
    enableAutoquest(userId);
    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🤖 Auto-Quest Enabled!\nEvery new Discord quest that drops will be **auto-completed for you** in the background.\n\nI'll DM you a summary once each quest finishes.\n\nUse \`${PREFIX}autoquest\` again to turn this off.\n\n-# Keep your saved token fresh with \`${PREFIX}tokencheck\`.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
}

export const questCmd = {
    data: new SlashCommandBuilder().setName('quest').setDescription('Pick and complete one Discord quest'),
    prefix: 'quest',
    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        const ts = client.tokenStore;
        await interaction.deferReply();
        await runQuestOne(interaction.user.id, ts, (opts) => interaction.followUp(opts));
    },
    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        await runQuestOne(message.author.id, client.tokenStore, (opts) => message.channel.send(opts));
    },
};

export const questAllCmd = {
    data: new SlashCommandBuilder().setName('q').setDescription('Complete all quests at once'),
    prefix: 'q',
    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        const ts = client.tokenStore;
        await interaction.deferReply();
        await runQuestAll(interaction.user.id, ts, (opts) => interaction.followUp(opts));
    },
    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        await runQuestAll(message.author.id, client.tokenStore, (opts) => message.channel.send(opts));
    },
};

export const questListCmd = {
    data: new SlashCommandBuilder().setName('questlist').setDescription('List all Discord quests and their status'),
    prefix: 'questlist',
    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        await interaction.deferReply();
        await runQuestList(interaction.user.id, client.tokenStore, (opts) => interaction.followUp(opts));
    },
    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        await runQuestList(message.author.id, client.tokenStore, (opts) => message.channel.send(opts));
    },
};

export const tokenCheckCmd = {
    data: new SlashCommandBuilder().setName('tokencheck').setDescription('Check whether your saved Discord token is still valid'),
    prefix: 'tokencheck',
    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        await interaction.deferReply({ flags: 64 });
        await runTokenCheck(interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts));
    },
    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        await runTokenCheck(message.author.id, client.tokenStore, (opts) => message.reply(opts));
    },
};

export const autoquestCmd = {
    data: new SlashCommandBuilder().setName('autoquest').setDescription('Auto-complete every new quest the moment it drops'),
    prefix: 'autoquest',
    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        await interaction.deferReply({ flags: 64 });
        await runAutoquestToggle(interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts));
    },
    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        await runAutoquestToggle(message.author.id, client.tokenStore, (opts) => message.reply(opts));
    },
};

export const linkCmd = {
    data: new SlashCommandBuilder().setName('link').setDescription('Save your Discord token so you never have to enter it again'),
    prefix: 'link',

    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        await interaction.showModal(buildLinkModal());
    },

    async prefixExecute(message, args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        const ts = client.tokenStore;
        const inlineToken = args.join('').trim();

        if (inlineToken) {
            try { await message.delete(); } catch {}
            const token = sanitizeToken(inlineToken);

            const sendDM = async (payload) => {
                const user = await client.users.fetch(message.author.id).catch(() => null);
                const dm = await user?.createDM().catch(() => null);
                await dm?.send(payload).catch(() => {});
            };

            if (!isValidUserToken(token)) {
                await sendDM((() => {
                    const c = new ContainerBuilder().setAccentColor(0xED4245);
                    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Invalid Token Format\nThat doesn't look like a valid Discord token. Copy the **Authorization** header value exactly.`));
                    return { components: [c], flags: MessageFlags.IsComponentsV2 };
                })());
                return;
            }

            let accountName = '', verifyOk = false;
            try {
                const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
                verifyOk = res.ok;
                if (res.ok) {
                    const data = await res.json();
                    accountName = data.global_name || data.username || '';
                }
            } catch {}

            if (!verifyOk) {
                await sendDM((() => {
                    const c = new ContainerBuilder().setAccentColor(0xED4245);
                    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Token Rejected by Discord\nMake sure you copied the \`Authorization\` header and try again.`));
                    return { components: [c], flags: MessageFlags.IsComponentsV2 };
                })());
                return;
            }

            ts.save(message.author.id, token);
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ✅ Token Linked!\nLinked as **"${accountName}"**.\n\nYou can now use \`${PREFIX}quest\`, \`${PREFIX}q\`, and \`${PREFIX}questlist\`.\nTo remove it, use \`${PREFIX}unlink\`.`,
                ),
            );
            await sendDM({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        await message.reply(buildLinkPrompt());
    },
};

export const unlinkCmd = {
    data: new SlashCommandBuilder().setName('unlink').setDescription('Remove your saved Discord token'),
    prefix: 'unlink',

    async execute(interaction, client) {
        if (!checkUserAccess(interaction.member, interaction)) {
            await interaction.reply({ components: [buildAccessDeniedCard().components[0]], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            return;
        }
        const ts = client.tokenStore;
        const removed = ts.remove(interaction.user.id);
        disableAutoquest(interaction.user.id);
        const c = new ContainerBuilder().setAccentColor(removed ? 0xFEE75C : 0x4F545C);
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                removed
                    ? `# 🔓 Token Unlinked\nYour saved token has been removed.`
                    : `# No Token Saved\nYou don't have a saved token.`,
            ),
        );
        await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async prefixExecute(message, _args, client) {
        if (!checkUserAccess(message.member, message)) {
            await message.reply(buildAccessDeniedCard());
            return;
        }
        const ts = client.tokenStore;
        const removed = ts.remove(message.author.id);
        disableAutoquest(message.author.id);
        const c = new ContainerBuilder().setAccentColor(removed ? 0xFEE75C : 0x4F545C);
        c.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                removed
                    ? `# 🔓 Token Unlinked\nYour saved token has been removed.`
                    : `# No Token Saved\nYou don't have a saved token.`,
            ),
        );
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    },
};

export async function handleLinkModal(interaction, client) {
    const ts = client.tokenStore;
    const raw = interaction.fields.getTextInputValue('link_token_input');
    const token = sanitizeToken(raw);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!isValidUserToken(token)) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Invalid Token Format\nThat doesn't look like a valid Discord token. Copy the **Authorization** header value exactly.`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    let accountName = '', verifyOk = false;
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        verifyOk = res.ok;
        if (res.ok) {
            const data = await res.json();
            accountName = data.global_name || data.username || '';
        }
    } catch {}

    if (!verifyOk) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Token Rejected by Discord\nMake sure you copied the \`Authorization\` header and try again.`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    ts.save(interaction.user.id, token);
    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ✅ Token Linked!\nLinked as **"${accountName}"**.\n\nYou can now use \`/quest\`, \`/q\`, and \`/questlist\`.\nTo remove it, use \`/unlink\`.`,
        ),
    );
    await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
}

export async function handleLinkPromptButton(interaction) {
    await interaction.showModal(buildLinkModal());
}

export async function runAutoquestForUser(userId, quest, tokenStore, discordClient) {
    const token = tokenStore.get(userId);
    if (!token) { disableAutoquest(userId); return; }

    const { QuestClient: QC } = await import('../quest/questClient.js');
    const { Quest: Q } = await import('../quest/quest.js');
    const qc = new QC(token);
    const logs = [];
    const log = (m) => { console.log(`[AutoQuest:${userId}]`, m); logs.push(m); };

    try {
        const manager = await qc.fetchQuests();
        let live = manager.get(quest.id);
        if (!live) {
            live = Q.create({ id: quest.id, config: quest.config, user_status: null, targeted_content: quest.targetedContent, preview: quest.preview });
        }
        if (live.isCompleted() || live.isExpired()) return;

        await manager.doingQuest(live, log);

        let claimManager = manager;
        try { claimManager = await qc.fetchQuests(); } catch { if (!manager.hasQuest(live.id)) manager.upsert(live); }

        const claimed = await claimManager.claimRewards(log).catch(() => 0);

        try {
            const user = await discordClient.users.fetch(userId);
            const dm = await user.createDM();
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🤖 Auto-Quest Complete!\n**${live.config.messages.quest_name}** has been completed automatically.\n${claimed > 0 ? `🎁 **${claimed}** reward(s) claimed.\n` : ''}\nUse \`${PREFIX}autoquest\` to disable.`,
                ),
            );
            await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        } catch {}

    } catch (err) {
        const msg = err?.message ?? String(err);
        console.error(`[AutoQuest:${userId}] Error:`, msg);
        if (msg.includes('401')) {
            tokenStore.remove(userId);
            disableAutoquest(userId);
            try {
                const user = await discordClient.users.fetch(userId);
                const dm = await user.createDM();
                const c = new ContainerBuilder().setAccentColor(0xED4245);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🤖 Auto-Quest Paused\nYour saved token expired. Run \`${PREFIX}link\` to re-link, then \`${PREFIX}autoquest\` to re-enable.`));
                await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            } catch {}
        }
    }
}
