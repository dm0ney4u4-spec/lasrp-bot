import {emptyLibrary,librarySchema,type Library,LiveryError} from './model.js';
export interface LibraryRow {version:number;data:Library;}
export interface LiveryRepository { read():Promise<LibraryRow>; compareAndSwap(version:number,data:Library):Promise<boolean>; }
// Raw parameterized SQL uses the existing Prisma connection without changing its generated client.
// The new table is installed only by the explicit, additive livery:setup command.
export interface SqlClient {$queryRawUnsafe<T=unknown>(sql:string,...values:unknown[]):Promise<T>;}
export class PostgresLiveryRepository implements LiveryRepository {
 constructor(private readonly db:SqlClient){}
 async read():Promise<LibraryRow>{try{const rows=await this.db.$queryRawUnsafe<{version:number;data:unknown}[]>('SELECT "version", "data" FROM "LiveryLibrary" WHERE "id" = $1','LASRP_LIVERIES');return rows[0]?{version:rows[0].version,data:librarySchema.parse(rows[0].data)}:{version:0,data:emptyLibrary()};}catch(error){if(error instanceof Error&&error.name==='ZodError')throw new LiveryError('Livery database validation failed; preserve the data and restore a verified backup.');throw new LiveryError('Livery database unavailable. Run npm run livery:setup once against the configured database; see docs/LIVERY_MANAGER.md.');}}
 async compareAndSwap(version:number,data:Library){const serialized=JSON.stringify(librarySchema.parse(data));const result=version===0?await this.db.$queryRawUnsafe<unknown[]>('INSERT INTO "LiveryLibrary" ("id","version","data","updatedAt") VALUES ($1,1,$2::jsonb,NOW()) ON CONFLICT ("id") DO NOTHING RETURNING "version"','LASRP_LIVERIES',serialized):await this.db.$queryRawUnsafe<unknown[]>('UPDATE "LiveryLibrary" SET "data"=$1::jsonb,"version"="version"+1,"updatedAt"=NOW() WHERE "id"=$2 AND "version"=$3 RETURNING "version"',serialized,'LASRP_LIVERIES',version);return result.length===1;}
}
