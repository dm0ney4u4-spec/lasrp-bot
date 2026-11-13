import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {AttachmentBuilder,MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle,ActionRowBuilder,type Interaction,type Attachment} from 'discord.js';
import {authorize,DENIED,LiveryError,liveryInput,missing,type LiveryRecord,type Department} from '../../../../packages/livery/src/model.js';
import {LiveryService,type Query} from '../../../../packages/livery/src/service.js';
import {decodeRecords} from '../../../../packages/livery/src/serialization.js';
import {discoverOfficialVehicles} from '../../../../packages/livery/src/catalog.js';
import {listPanel,panel,recordPanel,buttonRow,safeText,summaryText,theme} from './panels.js';
import {ZodError} from 'zod';
type CachedQuery={kind:'records';query:Query}|{kind:'vehicles';department?:string;vehicle?:string;uncovered?:boolean};
type Session={expires:number;query:CachedQuery};
export function isLiveryInteraction(i:any){return i.commandName==='livery'||typeof i.customId==='string'&&/^(?:lv:|livery:|ls:livery:)/.test(i.customId);}
export function logDenied(actor:string,kind:string){try{fs.mkdirSync('data/livery',{recursive:true});fs.appendFileSync('data/livery/security.ndjson',JSON.stringify({at:new Date().toISOString(),event:'livery.access_denied',actor,kind:kind.slice(0,40)})+'\n');}catch{console.error('Livery access-denial log could not be written.');}}
export async function readAttachment(file:Pick<Attachment,'url'|'size'|'name'>,request:typeof fetch=fetch){
 const url=new URL(file.url);if(file.size>1024*1024||url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)||url.username||url.password||!/^\/(?:ephemeral-)?attachments\//.test(url.pathname))throw new LiveryError('Use a Discord JSON/CSV attachment of at most 1 MiB');
 if(!/\.(?:json|csv|txt)$/i.test(file.name??''))throw new LiveryError('Expected a JSON, CSV, or structured TXT attachment');
 const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw new LiveryError('Attachment unavailable; upload it again');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;try{while(true){const result=await reader.read();if(result.done)break;length+=result.value.length;if(length>1024*1024)throw new LiveryError('Attachment exceeded 1 MiB');chunks.push(result.value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks).toString('utf8');
}
export class LiveryManager {
 private readonly sessions=new Map<string,Session>();
 private readonly editors=new Map<string,{expires:number;value:string}>();
 private readonly confirmations=new Map<string,{expires:number;id:string;version:number}>();
 constructor(readonly service:LiveryService,private readonly denyLog:typeof logDenied=logDenied){}
 private prune(){const now=Date.now();for(const map of [this.sessions,this.editors,this.confirmations]){for(const [key,value]of map)if(value.expires<now)map.delete(key);while(map.size>=300)map.delete(map.keys().next().value!);}}
 private record(record:LiveryRecord,page=0){this.prune();const key=record.id+':'+record.version;this.editors.set(key,{expires:Date.now()+600000,value:JSON.stringify(liveryInput.parse(Object.fromEntries(Object.keys(liveryInput.shape).map(k=>[k,record[k as keyof LiveryRecord]]))),null,2)});return recordPanel(record,page);}
 private async browse(actor:string,query:CachedQuery,page=0,token?:string){this.prune();token??=randomUUID();this.sessions.set(token,{expires:Date.now()+600000,query});if(query.kind==='records')return listPanel(await this.service.list(actor,query.query),token,page);
  const records=query.uncovered?await this.service.list(actor):[];
  const rows=(await this.service.catalog(actor)).filter(v=>(!query.department||v.departments.includes(query.department as Department))&&(!query.vehicle||v.name.toLowerCase().includes(query.vehicle.toLowerCase()))&&(!query.uncovered||v.departments.some(d=>(!query.department||d===query.department)&&!records.some(r=>r.department===d&&r.vehicleName.toLowerCase()===v.name.toLowerCase())))).sort((a,b)=>a.name.localeCompare(b.name));const pages=Math.max(1,Math.ceil(rows.length/5));page=Math.max(0,Math.min(page,pages-1));const slice=rows.slice(page*5,page*5+5);return panel(query.uncovered?'Vehicles missing livery records':'Vehicle catalog',slice.map(v=>`**${summaryText(v.name,70)}**\n${summaryText(v.category,40)} · ${v.departments.join(', ')}\n${v.status==='CONFIRMED_IN_GAME'?'Owner-attested in-game confirmation for '+v.confirmedDepartments.join(', '):'UNVERIFIED in current game; '+v.status}\nSource: ${summaryText(v.sourceUrl,100)}`).join('\n\n')+`\n\n${rows.length} documented entries · Page ${page+1}/${pages}\nTemplates are not proof of current compatibility. Vehicles absent from the source remain unknown.`,0x244a91,pages>1?[buttonRow([...(page>0?[{id:`lv:page:${token}:${page-1}`,label:'Previous'}]:[]),...(page+1<pages?[{id:`lv:page:${token}:${page+1}`,label:'Next'}]:[])])]:[]);
 }
 private async deletion(actor:string,id:string){const record=await this.service.view(actor,id),token=randomUUID();this.prune();this.confirmations.set(token,{expires:Date.now()+120000,id,version:record.version});return panel('Confirm deletion',`Delete **${safeText(record.name)}** for ${safeText(record.vehicleName)}?\nExport a backup first if you need to retain this record. This confirmation expires in two minutes.`,theme[record.department],[buttonRow([{id:'lv:confirm:'+token,label:'Confirm deletion',danger:true},{id:'lv:cancel:'+token,label:'Cancel'}])]);}
 async interaction(i:Interaction):Promise<boolean>{
  if(!isLiveryInteraction(i))return false;
  try{authorize(i.user.id);}catch{this.denyLog(String(i.user.id),i.isAutocomplete()?'autocomplete':i.isChatInputCommand()?'command':i.isModalSubmit()?'modal':'component');if(i.isAutocomplete())await i.respond([]);else if(i.isRepliable())await i.reply({content:DENIED,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});return true;}
  try{
   if(i.isAutocomplete()){
    const focused=i.options.getFocused(true),needle=String(focused.value).toLowerCase(),department=i.options.getString('department')??undefined;
    if(focused.name==='id'){const rows=await this.service.list(i.user.id);await i.respond(rows.filter(r=>[r.name,r.vehicleName,r.id].join(' ').toLowerCase().includes(needle)).slice(0,25).map(r=>({name:(r.department+' | '+r.vehicleName+' | '+r.name).slice(0,100),value:r.id})));}
    else if(focused.name==='vehicle'){const rows=await this.service.catalog(i.user.id);const names=[...new Set(rows.filter(v=>v.name.length<=100&&v.name.toLowerCase().includes(needle)&&(!department||v.departments.includes(department as Department))).map(v=>v.name))];await i.respond(names.slice(0,25).map(name=>({name,value:name})));}
    else if(focused.name==='rank'){const data=await this.service.snapshot(i.user.id),ranks=[...new Set(department?data.ranks[department as Department]??[]:Object.values(data.ranks).flat())];await i.respond(ranks.filter(r=>r.toLowerCase().includes(needle)).slice(0,25).map(r=>({name:r,value:r})));}else await i.respond([]);return true;
   }
   if(i.isButton()&&i.customId.startsWith('lv:edit:')){
    this.prune();const key=i.customId.slice('lv:edit:'.length),cached=this.editors.get(key);if(!cached||cached.value.length>4000){await i.reply(panel('Reopen the editor',cached?'This record is too large for Discord’s modal. Export JSON, edit one record, and use /livery edit with a file attachment.':'Editor expired. Reopen the record with /livery edit.'));return true;}
    await i.showModal(new ModalBuilder().setCustomId('lv:save:'+key).setTitle('Edit livery — JSON').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('json').setLabel('Full input record; IDs must remain strings').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setValue(cached.value))));return true;
   }
   if(!i.isRepliable())return true;
   await i.deferReply({flags:MessageFlags.Ephemeral});
   const send=async(payload:any)=>i.editReply({...payload,flags:MessageFlags.IsComponentsV2});
   if(i.isChatInputCommand()){
    const action=i.options.getSubcommand(),actor=i.user.id,department=i.options.getString('department')??undefined;
    if(action==='list'||action==='search'||action==='department'){await send(await this.browse(actor,{kind:'records',query:{department,search:action==='search'?i.options.getString('query',true):undefined}}));}
    else if(action==='view'||action==='preview'||action==='edit'){
     const old=await this.service.view(actor,i.options.getString('id',true));const file=action==='edit'?i.options.getAttachment('file'):null;if(file){const input=decodeRecords(await readAttachment(file),'json');if(input.length!==1)throw new LiveryError('Attach exactly one livery record for editing');await send(this.record(await this.service.edit(actor,old.id,old.version,input[0])));}else if(action==='preview'&&!old.previewUrl)await send(panel('Preview missing','No preview artwork is recorded. Add an approved HTTPS image reference with /livery edit. No fake preview was generated.'));else await send(this.record(old));
    }else if(action==='add'){
     const vehicleName=i.options.getString('vehicle',true),catalog=await this.service.catalog(actor),vehicle=catalog.find(v=>v.name===vehicleName);
     const record=await this.service.add(actor,{department,vehicleName,vehicleCategory:vehicle?.category??'Unclassified',name:i.options.getString('name',true),rankRestriction:i.options.getString('rank'),division:i.options.getString('division')});await send(this.record(record));
    }else if(action==='delete')await send(await this.deletion(actor,i.options.getString('id',true)));
    else if(action==='import'){
     const file=i.options.getAttachment('file',true),text=await readAttachment(file);if(i.options.getString('kind')==='catalog'){const count=await this.service.importCatalog(actor,text);await send(panel('Catalog imported',`${count} documented entries processed. Imported current-game compatibility is UNVERIFIED.`));}else{const result=await this.service.import(actor,text,/\.csv$/i.test(file.name??'')?'csv':'json');await send(panel('Import complete',`Imported: ${result.imported}\nDuplicates skipped: ${result.duplicates}\nIncomplete input records: ${result.incomplete}\nImported approvals and tests are reset to UNVERIFIED. No creator rights or compatibility have been assumed.`));}
    }else if(action==='export'){
     const format=i.options.getString('format',true) as 'json'|'csv',text=await this.service.export(actor,format,{department});if(Buffer.byteLength(text)>8*1024*1024)throw new LiveryError('Export is too large. Export one department at a time.');const payload=panel('Private export',`Exported ${format.toUpperCase()} inventory. Decal IDs remain strings. Keep original JSON for lossless backups; CSV cells are escaped against spreadsheet formulas.`);await send({...payload,files:[...payload.files,new AttachmentBuilder(Buffer.from(text),{name:'NYCRP-liveries.'+format})]});
    }else if(action==='verify'){
     const old=await this.service.view(actor,i.options.getString('id',true));const record=await this.service.verify(actor,old.id,old.version,i.options.getString('assets',true) as any,i.options.getString('approval',true) as any,i.options.getBoolean('tested',true),i.options.getString('evidence',true));await send(this.record(record));
    }else if(action==='vehicle'){
     if(i.options.getString('action',true)==='sync'){const entries=await discoverOfficialVehicles();await this.service.upsertVehicles(actor,entries);}await send(await this.browse(actor,{kind:'vehicles',department,vehicle:i.options.getString('vehicle')??undefined}));
    }else if(action==='rank'){
     const configure=i.options.getString('configure');if(configure){const ranks=await this.service.setRanks(actor,department as Department,configure.split(',').map(s=>s.trim()));await send(panel('Rank labels saved',safeText(ranks.join(' → '))+'\n\nOrganizational labels only; no Roblox spawn restrictions were changed.'));}else if(i.options.getString('rank'))await send(await this.browse(actor,{kind:'records',query:{department,rank:i.options.getString('rank')!}}));else{const data=await this.service.snapshot(actor);await send(panel('Department rank labels',safeText((data.ranks[department as Department]??[]).join(' → '))+'\n\nUse rank to filter records, or configure to customize labels. These labels are not in-game permissions.'));}
    }else if(action==='missing'||action==='stats'){
     if(action==='missing')await send(await this.browse(actor,i.options.getBoolean('catalog')?{kind:'vehicles',department,uncovered:true}:{kind:'records',query:{department,missingOnly:true}}));else{const data=await this.service.snapshot(actor),uncovered=data.vehicles.flatMap(v=>v.departments.filter(d=>!data.records.some(r=>r.department===d&&r.vehicleName.toLowerCase()===v.name.toLowerCase())));await send(panel('Inventory statistics',`Liveries: ${data.records.length}\nRecords with missing required decals: ${data.records.filter(r=>missing(r).length).length}\nOwner-attested tests: ${data.records.filter(r=>r.tested).length}\nDocumented catalog entries: ${data.vehicles.length}\nCurrent-game confirmed vehicles: ${data.vehicles.filter(v=>v.status==='CONFIRMED_IN_GAME').length}\nCatalog department/vehicle combinations without a livery: ${uncovered.length}\n\nNo claim of complete current ER:LC vehicle coverage is made. /livery vehicle browses the source-backed catalog.`));}
    }else throw new LiveryError('Unknown livery action');return true;
   }
   if(i.isStringSelectMenu()&&i.customId==='lv:select'){if(i.values.length!==1)throw new LiveryError('Select one record');await send(this.record(await this.service.view(i.user.id,i.values[0])));return true;}
   if(i.isModalSubmit()&&i.customId.startsWith('lv:save:')){const [id,rawVersion]=i.customId.slice('lv:save:'.length).split(':');const input=JSON.parse(i.fields.getTextInputValue('json'));await send(this.record(await this.service.edit(i.user.id,id,Number(rawVersion),input)));return true;}
   if(i.isButton()){
    const [,action,...args]=i.customId.split(':');if(action==='page'){const session=this.sessions.get(args[0]);if(!session||session.expires<Date.now())throw new LiveryError('Navigation expired; run the command again');await send(await this.browse(i.user.id,session.query,Number(args[1])||0,args[0]));}
    else if(action==='detail')await send(this.record(await this.service.view(i.user.id,args[0]),Number(args[1])||0));
    else if(action==='delete')await send(await this.deletion(i.user.id,args[0]));
    else if(action==='confirm'){const confirmation=this.confirmations.get(args[0]);this.confirmations.delete(args[0]);if(!confirmation||confirmation.expires<Date.now())throw new LiveryError('Confirmation expired or already used');await this.service.delete(i.user.id,confirmation.id,confirmation.version);await send(panel('Livery deleted','The selected record was deleted after your private confirmation.'));}
    else if(action==='cancel'){this.confirmations.delete(args[0]);await send(panel('Deletion cancelled','No livery records were removed.'));}
    else throw new LiveryError('Unknown livery control');return true;
   }
   throw new LiveryError('Unknown livery interaction');
  }catch(error){const message=error instanceof LiveryError?error.message:error instanceof ZodError?'Validation failed: '+error.issues.slice(0,4).map(issue=>issue.path.join('.')+': '+issue.message).join('; '):error instanceof SyntaxError?'Invalid JSON. Keep decal IDs quoted and use the documented schema.':'Livery operation failed. No credentials were included in this response. Check setup and try again.';console.error('Livery operation failed:',error instanceof Error?error.name:'Unknown');if(i.isAutocomplete()){await i.respond([]).catch(()=>{});}else if(i.isRepliable()){const payload=panel('Livery action needs attention',safeText(message));if(i.deferred||i.replied)await i.editReply({...payload,flags:MessageFlags.IsComponentsV2});else await i.reply(payload);}return true;}
 }
}
