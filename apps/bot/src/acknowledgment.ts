import type {Interaction}from'discord.js';
import{editReply}from'./replies.js';
// Modal-opening buttons must use showModal as their initial Discord response.
export function opensModal(i:any){if(!('customId'in i)||i.isModalSubmit?.())return false;const [,action,args='']=i.customId.split(':'),part=args.split(',')[0];return action==='ticket'||action==='appeal'||action==='review'||action==='dm'&&['answer','followup'].includes(part)||action==='appReview'&&['accept','deny','interview','more_info','note'].includes(part)||action==='ticketV2'&&['close','resolve','add','remove','priority'].includes(part)||action==='record'&&['leave','suggestion'].includes(part);}
export async function acknowledgeInteraction<T extends Interaction>(interaction:T):Promise<T>{
 if(!interaction.isRepliable()||opensModal(interaction)||'customId'in interaction&&interaction.customId.startsWith('ls:appPage:'))return interaction;
 await interaction.deferReply(interaction.inGuild()?{flags:64}:{});
 return new Proxy(interaction,{get(target,key){if(key==='deferReply')return async()=>undefined;if(key==='reply')return(payload:any)=>editReply(target,payload);const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}
