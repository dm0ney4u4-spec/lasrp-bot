import fs from 'node:fs';
import {discoverOfficialVehicles} from '../packages/livery/src/catalog.js';
// Writes a reviewed source snapshot only. Does not start or deploy the bot or write database rows.
try{const vehicles=await discoverOfficialVehicles();fs.mkdirSync('imports/liveries',{recursive:true});fs.writeFileSync('imports/liveries/official-vehicle-catalog.json',JSON.stringify(vehicles,null,2));console.log(`Saved ${vehicles.length} documented template entries. Current in-game support remains UNVERIFIED until manual testing.`);}catch{console.error('Catalog discovery failed; existing snapshot preserved. Check the official ER:LC template directory.');process.exitCode=1;}
