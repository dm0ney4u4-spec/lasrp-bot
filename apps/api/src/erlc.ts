import { z } from 'zod';
const player=z.object({Player:z.string(),Team:z.string().optional(),Permission:z.string().optional(),Callsign:z.string().nullable().optional(),Location:z.object({LocationX:z.number(),LocationZ:z.number(),PostalCode:z.string().optional(),StreetName:z.string().optional()}).nullable().optional()}).passthrough();
export const snapshotSchema=z.object({Name:z.string(),CurrentPlayers:z.number().int().nonnegative(),MaxPlayers:z.number().int().positive(),Players:z.array(player).optional(),Queue:z.array(z.number()).optional(),Vehicles:z.array(z.unknown()).optional(),EmergencyCalls:z.array(z.object({CallNumber:z.number(),StartedAt:z.number(),Description:z.string(),PositionDescriptor:z.string(),Position:z.array(z.number()).optional(),Caller:z.number(),Team:z.string().optional()}).passthrough()).optional()}).passthrough();
export type Snapshot=z.infer<typeof snapshotSchema>;
export class ErlcAdapter {
 cooldownUntil=0;disabled=false;lastCommand=0;last?:{data:Snapshot;at:number};
 private pending?:Promise<{data:Snapshot;at:number}>;private nextSnapshotAt=0;
 get configured(){return Boolean(this.key.trim());}
 get retryAfterSeconds(){return Math.max(30,Math.ceil((Math.max(this.cooldownUntil,this.nextSnapshotAt)-Date.now())/1000));}
 constructor(private key:string,private request:typeof fetch=fetch){}
 async call(path:string,body?:unknown){
  if(!this.key)throw Error('ER:LC key is not configured');if(this.disabled)throw Error('ER:LC authentication is disabled after an invalid request; check the key and restart');
  if(Date.now()<this.cooldownUntil)throw Error('ER:LC rate-limit cooldown is active');
  const response=await this.request('https://api.erlc.gg/v2/server'+path,{method:body?'POST':'GET',headers:{'server-key':this.key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  if(response.status===429){const raw=await response.json().catch(()=>({})) as {retry_after?:number};const header=Number(response.headers.get('Retry-After')),body=Number(raw.retry_after);const wait=Math.max(1,...[header,body].filter(n=>Number.isFinite(n)&&n>0),60);this.cooldownUntil=Date.now()+wait*1000;throw Error('ER:LC rate limited; requests paused for the required retry interval');}
  if([400,401,403,404].includes(response.status)){this.disabled=true;throw Error('ER:LC rejected the request; check API configuration before restarting');}
  if(!response.ok)throw Error(`ER:LC unavailable (${response.status})`);
  const remaining=response.headers.get('X-RateLimit-Remaining'),reset=Number(response.headers.get('X-RateLimit-Reset'));if(remaining==='0'&&Number.isFinite(reset)&&reset*1000>Date.now())this.cooldownUntil=Math.max(this.cooldownUntil,reset*1000);
  if(response.status===204)return {confirmed:true};return response.json();
 }
 async snapshot(){
  if(this.last&&Date.now()-this.last.at<30000)return this.last;
  if(this.pending)return this.pending;
  if(Date.now()<this.nextSnapshotAt)throw Error('ER:LC refresh backoff is active');
  this.pending=(async()=>{try{const result=snapshotSchema.safeParse(await this.call('?Players=true&Queue=true&Vehicles=true&EmergencyCalls=true'));if(!result.success)throw Error('ER:LC returned invalid server data');this.last={data:result.data,at:Date.now()};this.nextSnapshotAt=0;return this.last;}catch(error){this.nextSnapshotAt=Date.now()+30000;throw error;}})();
  try{return await this.pending;}finally{this.pending=undefined;}
 }
 async message(text:string){
  if(!text.trim()||text.length>160||/[\r\n:;]/.test(text)||text.includes('@'))throw Error('Message must be 1–160 characters without command separators, colons, or mentions');
  if(Date.now()-this.lastCommand<5000)throw Error('Wait at least five seconds between remote announcements');
  this.lastCommand=Date.now();const result=await this.call('/command',{command:`:m ${text}`});
  // No automatic POST retries: timeout leaves execution uncertain.
  return {confirmed:true,result};
 }
}
