import test from 'node:test';
import assert from 'node:assert/strict';
import { allowed,demand,requireAgency,type Principal } from '../packages/shared/src/permissions.js';
import { incidentSchema,recordSchema,characterSchema,vehicleSchema } from '../packages/shared/src/schemas.js';
import { Tickets } from '../apps/bot/src/tickets.js';
const civilian:Principal={id:'civilian',name:'Civilian',roles:[],groups:['civilian']};
test('civilian cannot access agency, management or dispatch actions',()=>{assert.equal(allowed(civilian,'dispatcher'),false);assert.throws(()=>demand(civilian,'management'));assert.throws(()=>requireAgency(civilian,'police'));});
test('police access does not grant EMS medical or management access',()=>{const p:Principal={...civilian,groups:['police']};requireAgency(p,'police');assert.throws(()=>requireAgency(p,'ems'));assert.equal(allowed(p,'management'),false);});
test('input schemas reject extra fields, private demographics, bad priorities and plate injection',()=>{
 assert.throws(()=>incidentSchema.parse({location:'Main',narrative:'Details',type:'Call',priority:0,agency:'police'}));
 assert.throws(()=>characterSchema.parse({name:'Alex Example',demographics:{realAddress:'Sensitive'}}));
 assert.throws(()=>vehicleSchema.parse({characterId:'x',plate:'<script>',make:'A',model:'B',color:'C'}));
 assert.throws(()=>recordSchema.parse({kind:'warrant',agency:'police',sealed:true,data:{title:'Test',narrative:'Narrative'}}));
});
test('ticket accused member and unassigned support cannot read restricted complaints',()=>{
 const tickets=Object.create(Tickets.prototype) as Tickets;
 const ticket={id:'T1',user:'opener',channel:'c',category:2,accusedId:'accused',status:'created',request:'Complaint',priority:'normal',created:1,members:[]};
 assert.throws(()=>tickets.authorize(ticket,{...civilian,id:'accused',groups:['management']},'claim'));
 assert.throws(()=>tickets.authorize(ticket,{...civilian,id:'support',groups:['support']},'claim'));
 tickets.authorize(ticket,{...civilian,id:'opener'},'close');
});
