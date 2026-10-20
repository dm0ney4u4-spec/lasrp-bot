import { ids } from './ids.js';
export function icon(name:keyof typeof ids.emojis){const value=ids.emojis[name];return /^\d{17,20}$/.test(value)?`<:${name}:${value}>`:'◆';}
export function monochrome(text:string){return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/^\s+/,'');}
