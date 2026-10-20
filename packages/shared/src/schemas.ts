import { z } from 'zod';
export const agency=z.enum(['police','sheriff','fire','ems','dot','dispatch','doj']);
export const coordinates=z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100),mapRevision:z.number().int().positive().optional()}).strict();
export const incidentSchema=z.object({location:z.string().trim().min(2).max(160),narrative:z.string().trim().min(5).max(3000),type:z.string().min(2).max(80),priority:z.number().int().min(1).max(5),agency:agency.default('police'),coordinates:coordinates.optional()}).strict();
export const incidentUpdate=z.object({version:z.number().int().positive(),status:z.enum(['pending','dispatched','responding','on_scene','closed']).optional(),priority:z.number().int().min(1).max(5).optional(),location:z.string().min(2).max(160).optional(),narrative:z.string().min(5).max(3000).optional(),note:z.string().min(1).max(1500).optional(),coordinates:coordinates.optional()}).strict();
export const unitSchema=z.object({callsign:z.string().trim().min(1).max(30),agency:agency,status:z.enum(['available','busy','en_route','on_scene','traffic_stop','transport','out_of_service','panic']),location:z.string().max(150).optional(),coordinates:coordinates.optional(),version:z.number().int().positive().optional()}).strict();
export const characterSchema=z.object({name:z.string().trim().min(3).max(80),demographics:z.object({description:z.string().max(500).optional(),occupation:z.string().max(80).optional()}).strict().default({}),licenses:z.array(z.enum(['driver','commercial','firearm','business'])).max(4).default([])}).strict();
export const vehicleSchema=z.object({characterId:z.string().min(1),plate:z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{2,10}$/),make:z.string().min(1).max(50),model:z.string().min(1).max(60),color:z.string().min(1).max(40)}).strict();
export const recordKinds=['incident_report','traffic_stop','citation','arrest','investigation','evidence','warrant','bolo','fire_incident','ems_report','tow_request','court_case','crash','use_of_force','witness_statement','search_seizure','highway_assistance'] as const;
export const reportDetails=z.discriminatedUnion('type',[
 z.object({type:z.literal('crash'),vehicles:z.string().trim().min(2).max(1000),injuries:z.string().trim().max(1000)}).strict(),
 z.object({type:z.literal('use_of_force'),basis:z.string().trim().min(5).max(1000),forceUsed:z.string().trim().min(5).max(1000)}).strict(),
 z.object({type:z.literal('witness_statement'),alias:z.string().trim().min(2).max(80),statement:z.string().trim().min(10).max(3000)}).strict(),
 z.object({type:z.literal('search_seizure'),basis:z.string().trim().min(5).max(1000),items:z.string().trim().min(2).max(1500)}).strict(),
 z.object({type:z.literal('highway_assistance'),service:z.enum(['disabled_vehicle','debris','road_closure','traffic_control']),outcome:z.string().trim().min(5).max(1000)}).strict(),
]);
export const recordSchema=z.object({kind:z.enum(recordKinds),agency:agency,subjectId:z.string().max(100).optional(),incidentId:z.string().max(100).optional(),data:z.object({details:reportDetails.optional(),title:z.string().min(2).max(150),narrative:z.string().min(5).max(6000),plate:z.string().max(10).optional(),location:z.string().max(150).optional(),disposition:z.enum(['accusation','warning','citation','arrest','conviction','none']).default('none'),evidenceUrls:z.array(z.string().url().max(500).refine(v=>new URL(v).protocol==='https:','HTTPS required')).max(10).default([]),expiresAt:z.string().datetime().optional(),fine:z.number().min(0).max(100000).optional()}).strict()}).strict();
export const recordUpdate=z.object({version:z.number().int().positive(),status:z.enum(['draft','submitted','approved','denied','issued','cancelled','closed']).optional(),sealed:z.boolean().optional(),data:recordSchema.shape.data.optional()}).strict();
export const questions=[
 'Discord username and Roblox username / verified Roblox account.',
 'Confirm that you meet the configured eligibility requirements; do not provide your exact birthdate.',
 'Time zone and usual weekly availability.',
 'Previous moderation or ER:LC roleplay experience and responsibilities.',
 'Why do you want to join the LASRP staff team?',
 'What makes you a suitable moderator? Include strengths and areas for growth.',
 'How would you handle a user insulting another member in chat?',
 'How would you handle a suspected exploiter when evidence is incomplete?',
 'How would you respond if a friend broke a server rule?',
 'How would you handle an accusation of staff abuse against a senior staff member?',
 'Are you willing to follow staff policies, document decisions, and keep reports confidential?',
 'Any additional information for the review team?',
];
