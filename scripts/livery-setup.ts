import 'dotenv/config';
import fs from 'node:fs';
import {db} from '../packages/shared/src/database.js';
import {LiveryService} from '../packages/livery/src/service.js';
import {PostgresLiveryRepository} from '../packages/livery/src/repository.js';
import {vehicleSchema,LIVERY_OWNER} from '../packages/livery/src/model.js';
// Explicit operator setup; no changes to Prisma migrations or automatic bot startup.
try{await db.$executeRawUnsafe(fs.readFileSync('packages/livery/sql/001_library.sql','utf8'));const file='imports/liveries/official-vehicle-catalog.json';if(fs.existsSync(file)){const entries=JSON.parse(fs.readFileSync(file,'utf8')).map((value:unknown)=>vehicleSchema.parse(value));await new LiveryService(new PostgresLiveryRepository(db)).upsertVehicles(LIVERY_OWNER,entries);console.log('Official template catalog snapshot loaded. Current game compatibility remains UNVERIFIED.');}console.log('LiveryLibrary table is ready. No other tables or records were changed.');}catch{console.error('Livery setup failed. Start the configured PostgreSQL database and check DATABASE_URL. No credentials printed.');process.exitCode=1;}finally{await db.$disconnect();}
