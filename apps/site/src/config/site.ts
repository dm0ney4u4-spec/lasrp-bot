import {invites} from './invites';
// Public, nonsecret website settings. Authoritative accounts remain in the existing API.
export const site = {
  name: 'Los Angeles State Roleplay', short: 'LASRP',
  discord: invites.main,
  applications: 'https://discord.com/channels/1529507818452029650/1557893259840458792',
  sessions: 'https://discord.com/channels/1529507818452029650/1529553843199807590',
  rules: 'https://discord.com/channels/1529507818452029650/1561876833065115790',
  support: invites.main,
  cadUrl: publicCadUrl(import.meta.env.VITE_CAD_URL),
};
function publicCadUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try { const url = new URL(value); if(url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) return null; if(url.username || url.password || url.search || url.hash) return null; return url.origin; } catch { return null; }
}
