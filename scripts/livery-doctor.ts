import 'dotenv/config';
import {db} from '../packages/shared/src/database.js';
import {LiveryService} from '../packages/livery/src/service.js';
import {PostgresLiveryRepository} from '../packages/livery/src/repository.js';
import {LIVERY_OWNER} from '../packages/livery/src/model.js';
try {
 const rows=await db.$queryRawUnsafe<{ready:boolean}[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='LiveryLibrary') AS ready`);
 console.log(rows[0]?.ready?'Livery database table: ready.':'Livery database table: missing. Run npm run livery:setup with PostgreSQL running.');
 if(rows[0]?.ready){const library=await new LiveryService(new PostgresLiveryRepository(db)).snapshot(LIVERY_OWNER);console.log(`Livery service read: successful. Catalog entries: ${library.vehicles.length}. Livery records: ${library.records.length}.`);}else process.exitCode=1;
}catch{
 console.log('Livery database: unavailable. Start the configured PostgreSQL server before running livery:setup.');
 process.exitCode=1;
}finally{await db.$disconnect();}
