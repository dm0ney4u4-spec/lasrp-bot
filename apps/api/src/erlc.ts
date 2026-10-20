import { z } from 'zod';
const player=z.object({Player:z.string(),Team:z.string().optional(),Callsign:z.string().optional(),Location:z.object({LocationX:z.number(),LocationZ:z.number(),PostalCode:z.string().optional(),StreetName:z.string().optional()}).optional()}).passthrough();
export const snapshotSchema=z.object({Name:z.string(),CurrentPlayers:z.number().int().nonnegative(),MaxPlayers:z.number().int().positive(),Players:z.array(player).optional(),Queue:z.array(z.number()).optional(),Vehicles:z.array(z.unknown()).optional(),EmergencyCalls:z.array(z.object({CallNumber:z.number(),StartedAt:z.number(),Description:z.string(),PositionDescriptor:z.string(),Position:z.array(z.number()).optional(),Caller:z.number(),Team:z.string().optional()}).passthrough()).optional()}).passthrough();
export type Snapshot=z.infer<typeof snapshotSchema>;
export class ErlcAdapter {
 cooldownUntil=0;disabled=false;lastCommand=0;last?:{data:Snapshot;at:number};
 constructor(private key:string,private request:typeof fetch=fetch){}
 async call(path:string,body?:unknown){
  if(!this.key)throw Error('ER:LC key is not configured');if(this.disabled)throw Error('ER:LC authentication is disabled after an invalid request; check the key and restart');
  if(Date.now()<this.cooldownUntil)throw Error('ER:LC rate-limit cooldown is active');
  const response=await this.request('https://api.erlc.gg/v2/server'+path,{method:body?'POST':'GET',headers:{'server-key':this.key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  if(response.status===429){const raw=await response.json().catch(()=>({})) as {retry_after?:number};this.cooldownUntil=Date.now()+Math.max(1,Number(response.headers.get('Retry-After')??raw.retry_after??60))*1000;throw Error('ER:LC rate limited; requests paused for the required retry interval');}
  if([400,401,403,404].includes(response.status)){this.disabled=true;throw Error('ER:LC rejected the request; check API configuration before restarting');}
  if(!response.ok)throw Error(`ER:LC unavailable (${response.status})`);
  if(response.status===204)return {confirmed:true};return response.json();
 }
 async snapshot(){if(this.last&&Date.now()-this.last.at<30000)return this.last;const data=snapshotSchema.parse(await this.call('?Players=true&Queue=true&Vehicles=true&EmergencyCalls=true'));this.last={data,at:Date.now()};return this.last;}
 async message(text:string){
  if(!text.trim()||text.length>160||/[\r\n:;]/.test(text)||text.includes('@'))throw Error('Message must be 1–160 characters without command separators, colons, or mentions');
  if(Date.now()-this.lastCommand<5000)throw Error('Wait at least five seconds between remote announcements');
  this.lastCommand=Date.now();const result=await this.call('/command',{command:`:m ${text}`});
  // No automatic POST retries: timeout leaves execution uncertain.
  return {confirmed:true,result};
 }
}
