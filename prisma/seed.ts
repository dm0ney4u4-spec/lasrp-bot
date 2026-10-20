import 'dotenv/config';
import { db } from '../packages/shared/src/database.js';
if(process.env.DEMO_MODE!=='true'||process.env.NODE_ENV==='production')throw Error('Demo seed requires DEMO_MODE=true outside production.');
await db.user.upsert({where:{id:'DEMO_OWNER'},create:{id:'DEMO_OWNER',displayName:'DEMO • Local Owner'},update:{}});
await db.incident.upsert({where:{id:'DEMO-CALL-001'},create:{id:'DEMO-CALL-001',callerId:'DEMO_OWNER',location:'DEMO • Training station',narrative:'DEMO fictional training exercise. No real emergency.',type:'Training',priority:4,agency:'police',demo:true},update:{}});
await db.civilianCharacter.upsert({where:{id:'DEMO-CHAR-001'},create:{id:'DEMO-CHAR-001',ownerId:'DEMO_OWNER',name:'DEMO • Alex Morgan',demographics:{occupation:'Fictional training character'},demo:true},update:{}});
await db.$disconnect();console.log('Clearly marked DEMO records seeded. Production queries exclude them.');
