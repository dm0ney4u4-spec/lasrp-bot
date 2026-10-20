import { PrismaClient, Prisma } from '@prisma/client';
import { EventEmitter } from 'node:events';
export const db=new PrismaClient();
export const events=new EventEmitter();
export async function audit(actorId:string,action:string,entityId:string,before:unknown,after:unknown,tx:Prisma.TransactionClient=db){
 return tx.auditEvent.create({data:{actorId,action,entityId,before:before==null?Prisma.JsonNull:JSON.parse(JSON.stringify(before)),after:after==null?Prisma.JsonNull:JSON.parse(JSON.stringify(after))}});
}
export const changed=()=>events.emit('changed');
