const base=process.env.WEB_BASE_URL??'http://localhost:3000';
const login=await fetch(base+'/auth/demo',{method:'POST',headers:{Origin:base}});if(!login.ok)throw Error('Start npm run demo before running the smoke test.');
const cookie=login.headers.get('set-cookie')!.split(';')[0];
const me=await(await fetch(base+'/api/me',{headers:{Cookie:cookie}})).json() as {demo:boolean;csrf:string};if(!me.demo)throw Error('This test only mutates the local DEMO environment.');
async function request(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':me.csrf},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(`${method} ${path}: ${value.error??response.status}`);return value;}
const health=await request('/health');if(health.database!=='connected')throw Error('Database health failed');
const map=await request('/api/map');if(!map.variants.every((v:{installed:boolean})=>v.installed))throw Error('Official map images are not installed.');
const mapImage=await fetch(base+'/api/map/image/fall_postals',{headers:{Cookie:cookie,Range:'bytes=0-31'}});const imageBytes=new Uint8Array(await mapImage.arrayBuffer());if(mapImage.status!==206||imageBytes[0]!==137||imageBytes[1]!==80)throw Error('Map image delivery failed.');
const character=await request('/api/characters','POST',{name:'DEMO • Smoke Test Civilian',demographics:{occupation:'Fictional test character'},licenses:[]});
const vehicle=await request('/api/vehicles','POST',{characterId:character.id,plate:'D'+Date.now().toString().slice(-7),make:'DEMO',model:'Fictional Sedan',color:'Blue'});
const incident=await request('/api/incidents','POST',{location:'DEMO training site',narrative:'DEMO fictional smoke-test incident. No real emergency.',type:'DEMO training',priority:4,agency:'police'});
const summary=await request('/api/summary');const existing=summary.units.find((u:{userId:string})=>u.userId==='DEMO_OWNER');
const unit=await request('/api/unit','PUT',{callsign:'DEMO-01',agency:'police',status:'available',...(existing?{version:existing.version}:{})});
const assigned=await request(`/api/incidents/${incident.id}/assign`,'POST',{unitId:unit.id,version:incident.version,remove:false});
await request(`/api/incidents/${incident.id}`,'PATCH',{version:assigned.version,status:'closed',note:'DEMO smoke test completed.'});
console.log('HTTP smoke test passed: health, login/session, CSRF, character, vehicle, incident, duty, assignment, closure. Only DEMO data was created.');
