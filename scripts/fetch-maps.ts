import fs from 'node:fs/promises';
import path from 'node:path';
import { mapVariants } from '../packages/shared/src/map.js';
const directory=path.resolve('assets/maps');await fs.mkdir(directory,{recursive:true});
for(const variant of mapVariants){
 const response=await fetch(`https://api.erlc.gg/maps/${variant}.png`,{signal:AbortSignal.timeout(60000),redirect:'error'});if(!response.ok)throw Error(`Official map download failed (${response.status}) for ${variant}.`);
 const chunks:Uint8Array[]=[];let total=0;if(!response.body)throw Error('Map response has no image.');const reader=response.body.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>32*1024*1024)throw Error('Map exceeds 32 MiB limit.');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==5355||bytes.readUInt32BE(20)!==5355)throw Error('Official map dimensions or PNG signature changed; review before installing.');
 const temporary=path.join(directory,variant+'.download');await fs.writeFile(temporary,bytes);await fs.rename(temporary,path.join(directory,variant+'.png'));console.log(`Installed official ${variant} map (${Math.round(total/1024)} KiB).`);
}
await fs.writeFile(path.join(directory,'SOURCE.txt'),'ER:LC official map images supplied for integrations by Police Roleplay Community.\nSource: https://apidocs.erlc.gg/official-map-images\nImages: https://api.erlc.gg/maps/\nArtwork remains the property of its respective owners.\nRetrieved: '+new Date().toISOString()+'\n');
