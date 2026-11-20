import test from 'node:test';
import assert from 'node:assert/strict';
import {Collection,PermissionsBitField} from 'discord.js';
import {isBotOwner} from '../apps/bot/src/owner-access.js';
import {access} from '../apps/bot/src/access.js';
import {actorFromMember,isAdministrator,authorize} from '../apps/bot/src/ticket-system/permissions.js';
import {sessionCommands} from '../apps/bot/src/session-hub/commands.js';
const owner='1425577335637413961';
test('exact configured owner has bot access without roles or Discord administrator permission',()=>{
  const member:any={id:owner,guild:{ownerId:'someone-else'},roles:{cache:new Collection()},permissions:new PermissionsBitField(0n),user:{username:'owner'}};
  assert.equal(isBotOwner(owner),true);assert.equal(isBotOwner(owner+'0'),false);assert.equal(isBotOwner(1425577335637413961 as any),false);
  for(const level of ['staff','management','department'])assert.equal(access(member,{},level),true);
  const actor=actorFromMember(member);assert.equal(actor.administrator,true);
  const config:any={guildId:'main',allowDiscordAdministrators:false,administratorRoleIds:[],categories:[{key:'general',supportRoleId:'support'}]};
  assert.equal(isAdministrator(actor,config),true);assert.doesNotThrow(()=>authorize({guildId:'main',category:'general',creatorId:'other',escalatedRoles:[]},actor,'repair',config));
  assert.equal(access({...member,id:'ordinary-member'},{staffRoles:[],managementRoles:[],departmentRoles:[]},'management'),false);
});
test('old session aliases and boost are not registered',()=>{
  assert.deepEqual(sessionCommands.map(c=>c.name),['session']);
  assert.deepEqual(sessionCommands[0].toJSON().options!.map(c=>c.name),['vote','start','low','shutdown','cancel-vote','status','panel']);
});
