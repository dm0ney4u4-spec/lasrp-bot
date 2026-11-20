import {verifyParts} from '../apps/bot/src/ticket-system/transcripts.js';
export async function secureHistoricalTranscripts(system:any,client:any){
 let logs=0,dms=0;const channel=await system.logChannel();
 const records=system.repo.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND lifecycle='CLOSED'").all(system.config.guildId).map((row:any)=>system.repo.decode(row));
 for(const ticket of records){
  if(!ticket.transcript)continue;const key='transcript_access_migration:'+ticket.id;if(system.repo.db.prepare('SELECT 1 FROM assistance_settings WHERE key=?').get(key))continue;
  await verifyParts(ticket.transcript.parts);const delivery=system.repo.delivery(ticket.id);let complete=true;
  for(const id of delivery.logMessageIds){try{const message=await channel.messages.fetch(id);if(message.author.id!==client.user.id)throw Error('Ownership mismatch');await message.edit({...system.closureLogPayload(ticket,system.category(ticket)),attachments:[],files:[]});logs++;}catch(error){if((error as {code?:number}).code!==10008){complete=false;console.error('A historical transcript log could not be secured; saved data was preserved.');}}}
  if(delivery.dmMessageIds.length)try{const user=await client.users.fetch(ticket.creatorId),dm=await user.createDM();for(const id of delivery.dmMessageIds){try{const message=await dm.messages.fetch(id);if(message.author.id!==client.user.id)throw Error('Ownership mismatch');await message.edit({...system.closureDmPayload(ticket,system.category(ticket)),attachments:[]});dms++;}catch(error){if((error as {code?:number}).code!==10008)throw error;}}}catch{complete=false;console.error('A historical creator DM could not be updated. Website transcript authorization remains enforced.');}
  if(complete)system.repo.db.prepare('INSERT INTO assistance_settings VALUES(?,?)').run(key,JSON.stringify({at:new Date().toISOString()}));
 }console.log('Historical transcript copies secured: '+logs+' log messages, '+dms+' creator DMs.');
}
