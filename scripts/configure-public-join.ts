import 'dotenv/config';
import fs from 'node:fs';
import {ErlcAdapter} from '../apps/api/src/erlc.js';
import {publicJoinUrl} from '../apps/api/src/public-erlc.js';

// Explicit owner-run setup: publish only the game's join code, never the API key.
if(publicJoinUrl()){
 console.log('Join Game is already configured; existing setting preserved.');
}else{
 const adapter=new ErlcAdapter(process.env.ERLC_SERVER_API_KEY??'');
 let code:unknown;
 try{code=(await adapter.snapshot()).data.JoinKey;}catch{throw Error('Could not read the server join code. No environment settings were changed.');}
 if(typeof code!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(code))throw Error('The API did not provide a valid join code. No environment settings were changed.');
 const path='.env',before=fs.readFileSync(path,'utf8');
 const line=`PUBLIC_ERLC_JOIN_CODE=${code}`;
 const after=/^PUBLIC_ERLC_JOIN_CODE=.*$/m.test(before)?before.replace(/^PUBLIC_ERLC_JOIN_CODE=.*$/m,line):`${before.trimEnd()}\n${line}\n`;
 fs.writeFileSync(path,after,{mode:0o600});
 console.log('Join Game configured from the official server response. Restart the backend to load it.');
}
