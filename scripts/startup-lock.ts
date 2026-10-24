import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export function processIdentity(pid:number):string|null{
 if(!Number.isSafeInteger(pid)||pid<=0)return null;
 try{
  if(process.platform==='win32')return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-Process -Id ${pid} -ErrorAction Stop; $p.ProcessName + '|' + $p.StartTime.ToUniversalTime().Ticks`],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore'],timeout:5000}).trim()||null;
  return execFileSync('ps',['-p',String(pid),'-o','comm=','-o','lstart='],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim()||null;
 }catch{return null;}
}
export function acquireStartupLock(file:string,options:{pid?:number;identity?:string;lookup?:(pid:number)=>string|null}={}){
 const pid=options.pid??process.pid,lookup=options.lookup??processIdentity,identity=options.identity??lookup(pid);
 if(!identity)throw Error('Could not verify the launcher process identity. Close other LASRP launchers and try again.');
 if(fs.existsSync(file)){
  let previous:{pid?:number;identity?:string};try{const parsed=JSON.parse(fs.readFileSync(file,'utf8'));previous=parsed&&typeof parsed==='object'?parsed:{};}catch{previous={};}
  const actual=typeof previous.pid==='number'?lookup(previous.pid):null;
  // Legacy PID-only locks cannot prove ownership after Windows reuses a PID.
  const legacyStarting=!previous.identity&&actual&&/^node(?:\||\s|$)/i.test(actual)&&Date.now()-fs.statSync(file).mtimeMs<120000;
  if(actual&&(previous.identity===actual||legacyStarting))return null;
  fs.rmSync(file,{force:true});
 }
 const nonce=randomUUID();let handle:number;
 try{handle=fs.openSync(file,'wx');}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return null;throw error;}
 try{fs.writeFileSync(handle,JSON.stringify({pid,identity,nonce}));}finally{fs.closeSync(handle);}
 return ()=>{try{const current=JSON.parse(fs.readFileSync(file,'utf8'));if(current.nonce===nonce)fs.rmSync(file,{force:true});}catch{}};
}
