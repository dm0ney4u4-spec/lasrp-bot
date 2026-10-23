import type {Server} from 'node:http';
import type {Client} from 'discord.js';
import {WebSocketServer,WebSocket} from 'ws';
import {sessionUser} from './auth.js';
import {cadAdmission} from './cad-admission.js';
import {events} from '../../../packages/shared/src/database.js';
export function configureCadSockets(server:Server,client:Client,dependencies:{session?:typeof sessionUser;admission?:typeof cadAdmission;intervalMs?:number}={}){
 const lookup=dependencies.session??sessionUser,admission=dependencies.admission??cadAdmission,sockets=new WebSocketServer({noServer:true}),cookies=new Map<WebSocket,string|undefined>();
 const authorized=async(cookie:string|undefined)=>{const session=await lookup(cookie,client);return Boolean(session&&(await admission(session.principal)).admitted);};
 const upgrade=async(req:import('node:http').IncomingMessage,socket:import('node:stream').Duplex,head:Buffer)=>{try{if(req.url!=='/live'||req.headers.origin!==(process.env.WEB_BASE_URL??'http://localhost:3000')||!await authorized(req.headers.cookie)){socket.destroy();return;}sockets.handleUpgrade(req,socket,head,ws=>{cookies.set(ws,req.headers.cookie);ws.on('error',()=>{});ws.on('close',()=>cookies.delete(ws));ws.send(JSON.stringify({type:'connected'}));});}catch{socket.destroy();}};
 server.on('upgrade',upgrade);
 let checking=false;const check=async(broadcast=false)=>{if(checking)return;checking=true;try{await Promise.all([...sockets.clients].map(async ws=>{try{if(!await authorized(cookies.get(ws))){ws.close(1008,'CAD admission or session is no longer valid');return;}if(broadcast&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'refresh'}));}catch{ws.close(1011,'Authorization unavailable');}}));}finally{checking=false;}};
 const onChanged=()=>void check(true),timer=setInterval(()=>void check(),dependencies.intervalMs??5000);timer.unref();events.on('changed',onChanged);
 return {sockets,stop:()=>{clearInterval(timer);events.off('changed',onChanged);server.off('upgrade',upgrade);for(const ws of sockets.clients)ws.terminate();}};
}
