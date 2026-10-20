import net from 'node:net';
export function scanMode(){const mode=process.env.EVIDENCE_SCAN_MODE??(process.env.NODE_ENV==='production'?'required':'off');if(!['required','off'].includes(mode))throw Error('EVIDENCE_SCAN_MODE must be required or off.');if(mode==='off'&&process.env.NODE_ENV==='production')throw Object.assign(Error('Production evidence scanning cannot be disabled.'),{status:503});return mode;}
export async function scanEvidence(bytes:Buffer):Promise<'clamav_clean'|'not_scanned'>{
 if(scanMode()==='off')return 'not_scanned';
 const host=process.env.CLAMAV_HOST??'127.0.0.1',port=Number(process.env.CLAMAV_PORT??3310);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid ClamAV port.');
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port}),parts:Buffer[]=[];let size=0,finished=false;
  const fail=(message='Evidence scanner unavailable. Upload was not stored.',status=503)=>{if(finished)return;finished=true;socket.destroy();reject(Object.assign(Error(message),{status}));};
  socket.setTimeout(20000,()=>fail('Evidence scanning timed out. Upload was not stored.'));socket.on('error',()=>fail());
  socket.on('end',()=>{if(!finished)fail('Incomplete scanner reply. Upload was not stored.');});
  socket.on('data',chunk=>{if(finished)return;size+=chunk.length;if(size>4096){fail();return;}parts.push(chunk);const reply=Buffer.concat(parts);const end=reply.indexOf(0);if(end<0)return;const text=reply.subarray(0,end).toString('utf8').trim();if(text==='stream: OK'){finished=true;socket.destroy();resolve('clamav_clean');}else if(text.endsWith(' FOUND'))fail('Malware was detected. Upload rejected.',422);else fail('Scanner could not verify this file. Upload rejected.');});
  socket.on('connect',()=>{void(async()=>{const write=(value:Buffer)=>new Promise<void>((done,error)=>socket.write(value,e=>e?error(e):done()));await write(Buffer.from('zINSTREAM\0'));for(let i=0;i<bytes.length;i+=65536){if(finished)return;const chunk=bytes.subarray(i,i+65536),header=Buffer.alloc(4);header.writeUInt32BE(chunk.length);await write(Buffer.concat([header,chunk]));}if(!finished)await write(Buffer.alloc(4));})().catch(()=>fail());});
 });
}
