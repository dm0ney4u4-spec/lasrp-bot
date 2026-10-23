import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Activity,ArrowRight,Clock,Radio,RefreshCw,Users,Shield,ExternalLink} from 'lucide-react';
import type {PublicErlcStatus} from '../../../packages/shared/src/public-status';
import {publicStatusEndpoint} from './integration/api';
import {External,Eyebrow} from './components';
import {site} from './config/site';
type LiveState={data:PublicErlcStatus|null;loading:boolean;failed:boolean;refresh:()=>void;now:number};
const Context=createContext<LiveState>({data:null,loading:false,failed:false,refresh:()=>{},now:0});
export function validStatus(value:any):value is PublicErlcStatus {
 const count=(n:any)=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0;
 return value&&typeof value.generatedAt==='string'&&Number.isFinite(Date.parse(value.generatedAt))&&['live','stale','unavailable'].includes(value.state)&&[null,'not_configured','upstream_unavailable'].includes(value.reason)&&(value.updatedAt===null||typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt)))&&Number.isFinite(value.refreshAfterSeconds)&&value.refreshAfterSeconds>=30&&value.server&&typeof value.server==='object'&&[value.server.players,value.server.capacity,value.server.populationPercent,value.server.queue,value.server.onlineStaff].every(count)&&(value.server.populationPercent===null||value.server.populationPercent<=100)&&[null,'string'].includes(value.server.name===null?null:typeof value.server.name)&&['responding','unknown'].includes(value.server.availability)&&(value.server.teams===null||typeof value.server.teams==='object'&&!Array.isArray(value.server.teams)&&Object.entries(value.server.teams).every(([name,n])=>name.length<=40&&count(n)&&n!==null))&&(value.server.joinUrl===null||typeof value.server.joinUrl==='string'&&/^https:\/\/erlc\.gg\/join\/[a-zA-Z0-9_-]{1,64}$/.test(value.server.joinUrl))&&Array.isArray(value.sessions)&&value.sessions.length<=5&&value.sessions.every((session:any)=>session.status==='scheduled'&&Number.isFinite(Date.parse(session.startsAt))&&/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(session.announcementUrl))&&typeof value.sessionsAvailable==='boolean';
}
export function LiveStatusProvider({children}:{children:ReactNode}){
 const {pathname}=useLocation(),enabled=pathname==='/'||pathname==='/server-status';
 const [data,setData]=useState<PublicErlcStatus|null>(null),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false),[now,setNow]=useState(Date.now());
 const refresh=useRef(()=>{}),nextAllowed=useRef(0);
 useEffect(()=>{
  if(!enabled)return;let alive=true,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,busy=false;
  const schedule=(ms:number)=>{clearTimeout(timer);timer=setTimeout(()=>void poll(),ms);};
  const poll=async()=>{if(!alive||document.hidden||busy)return;if(Date.now()<nextAllowed.current){schedule(nextAllowed.current-Date.now());return;}busy=true;setLoading(true);controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);let wait=45000;
   try{const response=await fetch(publicStatusEndpoint,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('Status unavailable');const result:unknown=await response.json();if(!validStatus(result))throw Error('Invalid public status');wait=Math.max(45000,result.refreshAfterSeconds*1000);if(alive){setData(result);setFailed(false);}}
   catch{if(alive&&!document.hidden)setFailed(true);}finally{clearTimeout(timeout);busy=false;if(alive){setLoading(false);setNow(Date.now());nextAllowed.current=Date.now()+wait;if(!document.hidden)schedule(wait);}}
  };
  const visibility=()=>{if(document.hidden){clearTimeout(timer);controller?.abort();}else void poll();};
  refresh.current=()=>void poll();document.addEventListener('visibilitychange',visibility);void poll();const freshness=setInterval(()=>{if(!document.hidden)setNow(Date.now());},10000);
  return()=>{alive=false;controller?.abort();clearTimeout(timer);clearInterval(freshness);document.removeEventListener('visibilitychange',visibility);refresh.current=()=>{};};
 },[enabled]);
 return <Context.Provider value={{data,loading,failed,refresh:()=>refresh.current(),now}}>{children}</Context.Provider>;
}
function Count({value}:{value:number|null|undefined}){return <span key={value??'missing'} className="live-number">{value==null?'—':value.toLocaleString()}</span>;}
export function LiveDashboard({detailed=false}:{detailed?:boolean}){
 const {data,loading,failed,refresh,now}=useContext(Context),server=data?.server;
 const stale=Boolean(data?.updatedAt&&(failed||data.state==='stale'||now-Date.parse(data.updatedAt)>90000));
 const live=Boolean(data&&data.state==='live'&&!stale&&!failed),status=live?'Live API data':stale?'Stale data':loading&&!data?'Connecting':'Live Data Unavailable';
 const queue=server?.queue==null?'Queue unavailable':server.queue===0?'No players waiting':`${server.queue} players waiting in queue`;
 const canonical=['Police','Sheriff','Fire / EMS','DOT','Civilian'],teams=[...canonical,...Object.keys(server?.teams??{}).filter(name=>!canonical.includes(name))];
 return <div className={`live-dashboard ${detailed?'detailed':''}`} aria-busy={loading}>
  <div className="live-heading"><div><Eyebrow>LASRP / LIVE SERVER TELEMETRY</Eyebrow><h2>{detailed?(server?.name??'Your server, at a glance.'):'Your next session, at a glance.'}</h2></div><span className={`live-badge ${live?'verified':stale?'stale':''}`}><span/>{status}</span></div>
  {stale&&<p className="live-notice" role="status">Last known values shown. The latest refresh could not confirm current data.</p>}
  {!live&&!stale&&(!loading||data)&&<p className="live-notice" role="status">{data?.reason==='not_configured'?'Live Data Unavailable — the server API connection is not configured.':'Live Data Unavailable — we could not reach the server status service.'} No player or queue values have been estimated.</p>}
  <div className="live-metrics"><div><Users size={19}/><span>Players online</span><strong><Count value={server?.players}/><small> / {server?.capacity??'—'}</small></strong></div><div><Radio size={19}/><span>Join queue</span><strong><Count value={server?.queue}/></strong><p>{queue}</p></div><div><Activity size={19}/><span>Population</span><strong><Count value={server?.populationPercent}/><small>{server?.populationPercent==null?'':'%'}</small></strong></div>{detailed&&<div><Shield size={19}/><span>Online staff</span><strong><Count value={server?.onlineStaff}/></strong><p>{server?.onlineStaff==null?'Not supplied by the API':'From online player permission data'}</p></div>}</div>
  <div className="capacity-heading"><span>Server capacity</span><span>{server?.populationPercent==null?'Unavailable':`${server.populationPercent}% occupied`}</span></div>
  {server?.populationPercent==null?<div className="capacity-track unavailable" aria-label="Capacity unavailable"/>:<div className="capacity-track" role="progressbar" aria-label="Server population" aria-valuemin={0} aria-valuemax={100} aria-valuenow={server.populationPercent}><span style={{width:`${server.populationPercent}%`}}/></div>}
  <div className="live-footer"><div><span><Clock size={14}/>Last successful update</span>{data?.updatedAt?<time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleString()}</time>:<span>Not yet available</span>}<small>{live?'Availability: API responding':'Availability: not currently verified'}</small></div><div className="button-row">{server?.joinUrl?<External href={server.joinUrl}>Join Game</External>:<button className="button secondary" disabled>Join Game unavailable</button>}<button className="refresh-button" onClick={refresh} disabled={loading||now<nextAllowedDisplay(data)} aria-label="Refresh server status"><RefreshCw size={16} className={loading?'spinning':''}/>{loading?'Refreshing':'Auto-refresh enabled'}</button>{!detailed&&<Link to="/server-status" className="text-link">Full server status <ArrowRight size={16}/></Link>}</div></div>
  {detailed&&<><div className="live-teams"><h3>Players by team</h3><p>Aggregate populations only. Individual players, IDs, callsigns, and locations stay private.</p><div>{teams.map(team=><article key={team}><span>{team}</span><strong><Count value={server?.teams?.[team]}/></strong></article>)}</div>{server?.teams==null&&<p className="fineprint">Team breakdown unavailable. A complete player list with team information is required.</p>}</div><div className="live-sessions"><h3>Session announcements</h3>{data?.sessionsAvailable?data.sessions.length?data.sessions.map(session=><article key={session.startsAt}><CalendarLabel at={session.startsAt}/><External href={session.announcementUrl} className="text-link">Open official sessions channel</External></article>):<p>No upcoming scheduled sessions are currently published.</p>:<p>Website session information is unavailable. Check the official Discord session channel.</p>}<External href={site.sessions} className="text-link">View session announcements</External></div></>}
 </div>;
}
function nextAllowedDisplay(data:PublicErlcStatus|null){return data?Date.parse(data.generatedAt)+data.refreshAfterSeconds*1000:0;}
function CalendarLabel({at}:{at:string}){return <time dateTime={at}>Scheduled: {new Date(at).toLocaleString()}</time>;}
export function ServerStatus(){useEffect(()=>{document.title='Live server status | Los Angeles State Roleplay';},[]);return <><section className="container status-page-intro"><Eyebrow>LIVE OPERATIONS / PUBLIC STATUS</Eyebrow><h1>A clearer view<br/>of the next shift.</h1><p>Real server data, shared responsibly. Check capacity, queue, and team populations before you join.</p><External href={site.discord}>Join Our Discord</External></section><section className="container status-page-dashboard"><LiveDashboard detailed/></section></>;}
