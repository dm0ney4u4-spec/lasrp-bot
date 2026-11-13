import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const assetDirectory=fileURLToPath(new URL('../assets/branding/',import.meta.url));
const file=(name:string)=>path.join(assetDirectory,name);
export const assets={departments:file('nyc-general.png'),logo:file('nyc-logo.png'),sessions:file('nyc-general.png'),applications:file('nyc-general.png'),topic:file('nyc-general.png'),header:file('nyc-general.png'),rules:file('nyc-rules.png'),assistance:file('nyc-assistance.png'),footer:file('nyc-footer.png')};
export const departmentAssets={police:file('nyc-police.png'),sheriff:file('nyc-sheriff.png'),fire:file('nyc-fire.png'),dot:file('nyc-dot.png')};
export const bannerFor=(key:string)=>{const department=/^department_(police|sheriff|fire|dot)$/.exec(key)?.[1] as keyof typeof departmentAssets|undefined;return department?departmentAssets[department]:/rules|regulations/.test(key)?assets.rules:/support|ticket|assistance/.test(key)?assets.assistance:/department/.test(key)?assets.departments:/ssu|ssd|session|vote/.test(key)?assets.sessions:/application|recruit/.test(key)?assets.applications:/welcome|server_info/.test(key)?assets.header:assets.topic;};
