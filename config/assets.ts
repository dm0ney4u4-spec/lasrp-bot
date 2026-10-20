import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const assetDirectory=fileURLToPath(new URL('../assets/branding/',import.meta.url));
export const assets={logo:path.join(assetDirectory,'la-logo.png'),sessions:path.join(assetDirectory,'sessions-banner.png'),applications:path.join(assetDirectory,'applications-banner.png'),topic:path.join(assetDirectory,'blank-blue-banner.png'),header:path.join(assetDirectory,'server-header.png')};
export const bannerFor=(key:string)=>/ssu|ssd|session|vote/.test(key)?assets.sessions:/application|recruit/.test(key)?assets.applications:/welcome|server_info/.test(key)?assets.header:assets.topic;
