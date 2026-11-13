import {LiveryError,type Department,type Vehicle} from './model.js';
export const officialRoot='189nYv-AOsjcROfpRF_Chx9ls0_-LsRG5';
export interface DriveEntry {id:string;name:string;type:string;}
// Parse a public directory data string as JSON. Never eval remote JavaScript.
export function parseOfficialFolder(html:string):DriveEntry[]{const match=html.match(/window\['_DRIVE_ivd'\] = '([^']*)'/);if(!match)throw new LiveryError('Official template directory format changed or is unavailable; existing catalog preserved.');try{const rows=JSON.parse(match[1].replace(/\\x([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))))[0];if(!Array.isArray(rows))throw Error();return rows.map(row=>({id:row[0],name:row[2],type:row[3]})).filter(row=>typeof row.id==='string'&&/^[\w-]{10,100}$/.test(row.id)&&typeof row.name==='string'&&typeof row.type==='string');}catch{throw new LiveryError('Official template directory could not be validated; no catalog updates were made.');}}
export async function discoverOfficialVehicles(request:typeof fetch=fetch):Promise<Vehicle[]>{
 const read=async(id:string)=>{const response=await request(`https://drive.google.com/drive/folders/${id}`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new LiveryError('Official template directory is unavailable');const body=await response.text();if(body.length>4*1024*1024)throw new LiveryError('Official directory response exceeded the limit');return parseOfficialFolder(body);};
 const root=await read(officialRoot),groups:{name:string;departments:Department[]}[]=[{name:'Law Enforcement',departments:['NYPD','NYCSO','NYSP','SPECIAL_OPERATIONS']},{name:'Fire Department',departments:['NYFD','SPECIAL_OPERATIONS']},{name:'Department of Transportation',departments:['NYDOT','SPECIAL_OPERATIONS']}];
 const vehicles:Vehicle[]=[],now=new Date().toISOString();
 for(const group of groups){const entry=root.find(e=>e.name===group.name&&e.type==='application/vnd.google-apps.folder');if(!entry)throw new LiveryError(`Official ${group.name} folder was not found. Catalog unchanged.`);const entries=(await read(entry.id)).filter(e=>e.type==='application/vnd.google-apps.folder');
  for(const parent of entries){const candidates=group.name==='Department of Transportation'?[parent]:(await read(parent.id)).filter(e=>e.type==='application/vnd.google-apps.folder');for(const item of candidates)vehicles.push({name:item.name,category:group.name==='Department of Transportation'?'Road services':parent.name,departments:group.departments,confirmedDepartments:[],sourceUrl:`https://drive.google.com/drive/folders/${item.id}`,status:'TEMPLATE_DOCUMENTED',observedAt:now,lastVerifiedAt:null,evidence:'Vehicle name observed in the public template directory linked by https://erlc.gg/. Template listing does not establish current in-game support or an approved livery.'});}
 }
 if(!vehicles.length)throw new LiveryError('No vehicle folders were found; existing catalog preserved');
 return vehicles;
}
