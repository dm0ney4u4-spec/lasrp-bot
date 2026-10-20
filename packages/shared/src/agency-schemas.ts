import { z } from 'zod';
const text=z.string().trim().min(2).max(150);
export const fireDetails=z.object({summary:z.string().trim().min(5).max(3000),location:text,station:text,apparatus:text,commander:text,staging:text,hazard:z.enum(['low','moderate','high']),notes:z.string().max(2000).default('')}).strict();
export const emsDetails=z.object({summary:z.string().trim().min(5).max(3000),location:text,patientAlias:text,characterId:z.string().max(100).optional(),hospital:z.string().max(150).default(''),transportNotes:z.string().max(1500).default(''),notes:z.string().max(2000).default('')}).strict();
export const towDetails=z.object({summary:z.string().trim().min(5).max(3000),location:text,plate:z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{2,10}$/),vehicleId:z.string().max(100).optional(),trafficStopId:z.string().max(100).optional(),impoundLot:z.string().max(150).default(''),inventoryNotes:z.string().max(1500).default(''),releaseReason:z.string().max(1000).default(''),releaseRequestedBy:z.string().max(100).optional(),notes:z.string().max(2000).default('')}).strict();
export const operationalCreate=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('fire'),incidentId:z.string().max(100).optional(),data:fireDetails}).strict(),
 z.object({kind:z.literal('ems'),incidentId:z.string().max(100).optional(),data:emsDetails}).strict(),
 z.object({kind:z.literal('tow'),incidentId:z.string().max(100).optional(),data:towDetails.omit({releaseRequestedBy:true})}).strict(),
]);
export const operationalUpdate=z.object({version:z.number().int().positive(),nextStatus:z.string().max(30),data:z.record(z.unknown())}).strict();
export const operationalTransitions:Record<string,Record<string,string[]>>={
 fire:{dispatched:['on_scene','cancelled'],on_scene:['controlled'],controlled:['cleared'],cleared:[],cancelled:[]},
 ems:{awaiting_response:['on_scene','cancelled'],on_scene:['treating','transporting','released'],treating:['transporting','released'],transporting:['arrived'],arrived:['closed'],released:['closed'],closed:[],cancelled:[]},
 tow:{requested:['assigned','cancelled'],assigned:['en_route','cancelled'],en_route:['on_scene'],on_scene:['impounded','completed'],impounded:['released'],released:[],completed:[],cancelled:[]},
};
