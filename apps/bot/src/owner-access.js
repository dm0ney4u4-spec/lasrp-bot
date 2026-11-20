import { ids } from '../../../config/ids.js';

// Exact Discord USER IDs in config/ids.ts. This grants bot authorization only;
// it does not impersonate another member or change the bot's Discord permissions.
export const isBotOwner = userId => typeof userId === 'string' && ids.owners.includes(userId);
