import test from 'node:test';
import assert from 'node:assert/strict';
import { courtAuthority } from '../apps/api/src/courts.js';
import { groupsFor,type Principal } from '../packages/shared/src/permissions.js';
import { ids } from '../config/ids.js';
test('specialist court roles inherit DOJ access and separate judges, lawyers and clerks',()=>{
 const previous=ids.courtsPolicy.specialistRolesEnabled;ids.courtsPolicy.specialistRolesEnabled=true;
 const user=(group:'judge'|'prosecutor'|'defense'|'clerk'):Principal=>({id:'TEST_COURT',name:'Test',roles:[],groups:['doj',group]});
 try{assert.ok(groupsFor('TEST_COURT',['COURT_ROLE'],{judge:'COURT_ROLE'}).includes('doj'));assert.doesNotThrow(()=>courtAuthority(user('judge'),'decided'));assert.throws(()=>courtAuthority(user('clerk'),'decided'));assert.doesNotThrow(()=>courtAuthority(user('clerk'),'scheduled'));assert.doesNotThrow(()=>courtAuthority(user('defense'),'appealed'));assert.throws(()=>courtAuthority(user('prosecutor'),'hearing'));assert.throws(()=>courtAuthority(user('defense'),'submit'));}finally{ids.courtsPolicy.specialistRolesEnabled=previous;}
});
