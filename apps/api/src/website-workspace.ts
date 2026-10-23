import type {Express,Request,Response} from 'express';
import {allowed,agencyAccess} from '../../../packages/shared/src/permissions.js';
import {ids} from '../../../config/ids.js';
import {db} from '../../../packages/shared/src/database.js';
import {websiteDepartments} from '../../../config/website.js';
import {cadAdmission} from './cad-admission.js';
import {websiteAdmin} from '../../../packages/shared/src/website-permissions.js';
const departmentAgencies={lapd:'police',lasd:'sheriff',lafd:'fire',dot:'dot'} as const;
function authenticated(req:Request,res:Response){if(!req.principal){res.status(401).json({error:'Sign in with Discord to continue.'});return false;}return true;}
// These routes are registered AFTER the existing /api session gate, never as public endpoints.
export function configureWebsiteWorkspace(app:Express,database:Pick<typeof db,'application'>=db,admissionCheck:typeof cadAdmission=cadAdmission){
 app.get('/api/website/member',async(req,res)=>{
  if(!authenticated(req,res))return;
  const roles=req.discordProfile?.roles??[];
  const departments=Object.entries(websiteDepartments).map(([slug,config])=>{
   const member=req.principal.groups.includes(config.agency),access=agencyAccess(req.principal,config.agency);
   const rank=member?config.rankRoleIds.map(id=>roles.find(role=>role.id===id)).find(Boolean)??null:null;
   return {slug,member,access,rank,canManage:access&&(websiteAdmin(req.principal)||config.commandRoleIds.some(id=>req.principal.roles.includes(id)))};
  });
  const admission=await admissionCheck(req.principal);
  res.json({identity:{id:req.principal.id,name:req.principal.name,...req.discordProfile},departments,cad:{authorized:admission.admitted,status:admission.status,url:process.env.WEB_BASE_URL??'http://localhost:3000'}});
 });
 app.get('/api/website/workspace',async(req,res)=>{
  if(!authenticated(req,res))return;
  const reviewer=allowed(req.principal,'reviewer'),management=websiteAdmin(req.principal);
  const fields={id:true,number:true,status:true,createdAt:true,updatedAt:true} as const;
  const mine=await database.application.findMany({where:{guildId:ids.guildId,applicantId:req.principal.id},orderBy:{createdAt:'desc'},take:50,select:fields});
  const reviewQueue=reviewer?await database.application.findMany({where:{guildId:ids.guildId,status:{in:['submitted','interview','more_info']}},orderBy:{createdAt:'asc'},take:50,select:fields}):null;
  res.set('Cache-Control','no-store').json({identity:{id:req.principal.id,name:req.principal.name},capabilities:{reviewer,management},departments:Object.entries(departmentAgencies).filter(([,agency])=>agencyAccess(req.principal,agency)).map(([slug])=>slug),applications:mine,reviewQueue});
 });
 app.get('/api/website/departments/:slug',async(req,res)=>{
  if(!authenticated(req,res))return;const slug=String(req.params.slug),agency=departmentAgencies[slug as keyof typeof departmentAgencies];
  if(!agency)return res.status(409).json({error:'Department permissions have not been configured for this portal.'});
  if(!agencyAccess(req.principal,agency))return res.status(403).json({error:'Department access required.'});
  const config=websiteDepartments[slug as keyof typeof websiteDepartments],management=websiteAdmin(req.principal)||config.commandRoleIds.some(id=>req.principal.roles.includes(id));
  res.set('Cache-Control','no-store').json({department:slug,management,mode:'preparation',modules:management?['personnel','promotions','training','activity','discipline','recruitment'].map(key=>({key,state:'coming_soon'})):[]});
 });
}
