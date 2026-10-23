import 'dotenv/config';
import {ErlcAdapter} from '../apps/api/src/erlc.js';
import {sanitizeStatus,publicJoinUrl} from '../apps/api/src/public-erlc.js';
const erlc=new ErlcAdapter(process.env.ERLC_SERVER_API_KEY??'');
console.log('ER:LC key configured:',erlc.configured?'yes':'no');
console.log('Public Join Game link configured:',publicJoinUrl()?'yes':'no');
let failed=false;try{if(erlc.configured)await erlc.snapshot();else failed=true;}catch{failed=true;}
const status=sanitizeStatus(erlc.last,failed,erlc.configured,erlc.retryAfterSeconds,publicJoinUrl());
console.log(JSON.stringify({state:status.state,players:status.server.players,capacity:status.server.capacity,queue:status.server.queue,teamBreakdownAvailable:status.server.teams!==null,onlineStaff:status.server.onlineStaff,updatedAt:status.updatedAt}));
if(failed)console.log('Live verification unavailable. No raw API responses, identity data, or credentials were printed.');
