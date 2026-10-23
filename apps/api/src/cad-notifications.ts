import {ChannelType,ContainerBuilder,TextDisplayBuilder,MessageFlags,PermissionFlagsBits,type Client} from 'discord.js';
import {db} from '../../../packages/shared/src/database.js';
import {ids} from '../../../config/ids.js';
import {cadAccessConfig} from '../../../config/cad-access.js';
export async function deliverCadNotifications(client:Client,database=db){
 if(!client.isReady())return;
 const rows=await database.cadAccessDelivery.findMany({where:{status:'pending',kind:{in:cadAccessConfig.reviewChannelId?['review','decision']:['decision']},nextAttemptAt:{lte:new Date()},OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},orderBy:{createdAt:'asc'},take:10});
 for(const row of rows){if(row.kind==='review'&&!cadAccessConfig.reviewChannelId)continue;
  const claim=await database.cadAccessDelivery.updateMany({where:{id:row.id,status:'pending',OR:[{lockedAt:null},{lockedAt:{lt:new Date(Date.now()-300000)}}]},data:{lockedAt:new Date(),attempts:{increment:1}}});if(!claim.count)continue;
  try{const payload=row.payload as {userId:string;status:string;reason:string};const content=`## LASRP CAD ${row.kind==='review'?'Application Review':'Access Update'}\n**Reference:** ${row.applicationId}\n**Status:** ${payload.status.replace('_',' ')}\n${payload.reason}\n\n${row.kind==='review'?'Review the answers and audit history on the authorized website reviewer dashboard.':'Open the website CAD page to view your application and admission status. Never send passwords.'}`;
   const message={components:[new ContainerBuilder().setAccentColor(0x2964ab).addTextDisplayComponents(new TextDisplayBuilder().setContent(content))],flags:MessageFlags.IsComponentsV2 as const,allowedMentions:{parse:[] as []},nonce:row.id,enforceNonce:true};
   if(row.kind==='review'){
    const guild=await client.guilds.fetch(ids.guildId),channel=await guild.channels.fetch(cadAccessConfig.reviewChannelId);if(!channel||channel.type!==ChannelType.GuildText||channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel))throw Error('PRIVATE_CHANNEL_REQUIRED');
    const trusted=new Set([...cadAccessConfig.reviewerRoleIds,...cadAccessConfig.revokerRoleIds,...cadAccessConfig.websiteAdminRoleIds]);
    const botRole=(await guild.members.fetchMe()).roles.botRole?.id;if(botRole)trusted.add(botRole);
    for(const overwrite of channel.permissionOverwrites.cache.values())if(overwrite.allow.has(PermissionFlagsBits.ViewChannel)&&!overwrite.deny.has(PermissionFlagsBits.ViewChannel)&&!(overwrite.type===0?trusted.has(overwrite.id):ids.owners.includes(overwrite.id)||overwrite.id===client.user!.id))throw Error('PRIVATE_CHANNEL_REQUIRED');
    await channel.send(message);
   }else await(await client.users.fetch(payload.userId)).send(message);
   await database.cadAccessDelivery.update({where:{id:row.id},data:{status:'sent',deliveredAt:new Date(),lockedAt:null,errorCode:null}});
  }catch(error){const code=error instanceof Error&&error.message==='PRIVATE_CHANNEL_REQUIRED'?'private_channel_required':'discord_delivery_failed';await database.cadAccessDelivery.update({where:{id:row.id},data:{status:row.attempts>=4?'failed':'pending',lockedAt:null,errorCode:code,nextAttemptAt:new Date(Date.now()+Math.min(3600,60*2**row.attempts)*1000)}});}
 }
}
export function startCadNotifications(client:Client){let pending:Promise<void>|undefined;const run=()=>{if(!pending)pending=deliverCadNotifications(client).catch(()=>{console.error('CAD notification delivery deferred.');}).finally(()=>{pending=undefined;});};run();const timer=setInterval(run,60000);timer.unref();return async()=>{clearInterval(timer);await pending;};}
