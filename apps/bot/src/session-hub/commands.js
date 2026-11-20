import { SlashCommandBuilder } from 'discord.js';
const cmd = (name, description) => new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
export const sessionCommands = [
  cmd('session', 'New York City Roleplay session hub')
    .addSubcommand(c => c.setName('vote').setDescription('Staff: open a session vote').addIntegerOption(o => o.setName('votes').setDescription('Votes required (default 2)').setMinValue(1).setMaxValue(1000)))
    .addSubcommand(c => c.setName('start').setDescription('Staff: start a session'))
    .addSubcommand(c => c.setName('low').setDescription('Staff: announce low activity'))
    .addSubcommand(c => c.setName('shutdown').setDescription('Staff: confirm session shutdown').addStringOption(o => o.setName('reason').setDescription('Shutdown reason').setMaxLength(300)))
    .addSubcommand(c => c.setName('cancel-vote').setDescription('Staff: cancel the active vote'))
    .addSubcommand(c => c.setName('status').setDescription('View session status'))
    .addSubcommand(c => c.setName('panel').setDescription('Staff: create or repair the permanent panel'))
];
