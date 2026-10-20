import { MessageFlags } from 'discord.js';
import { validatePayload } from './panels.js';

export function editReply(interaction, payload) {
  // Ephemerality is selected by the initial reply/defer, never changed on edits.
  return interaction.editReply(validatePayload({ ...payload, flags: MessageFlags.IsComponentsV2 }));
}
