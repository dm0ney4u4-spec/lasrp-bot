import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MessageFlags } from 'discord.js';
import { render,validatePayload,validateTemplate,button,safeUrl } from '../apps/bot/src/panels.js';
import { seeds } from '../apps/bot/src/seeds.js';
import { assets,bannerFor } from '../config/assets.js';
import { monochrome,icon } from '../config/icons.js';
import { allCommands } from '../apps/bot/src/main.js';

test('all default panels serialize as actual Components V2 on every page',()=>{
 for(const [key,template] of Object.entries(seeds)){
  validateTemplate(template);for(let page=0;page<(template.pages?.length??1);page++){
   const payload=render(template,{community:'Los Angeles State Roleplay'},{page});
   assert.ok(payload.flags&MessageFlags.IsComponentsV2,key);assert.equal(payload.components[0].type,17);assert.ok(!('embeds'in payload));assert.ok(!('content'in payload));assert.ok(payload.components[0].components.some((c:any)=>c.type===9),key+' has a Section');assert.ok(payload.components[0].components.some((c:any)=>c.type===12),key+' has a MediaGallery');
  }
 }
});
test('renderer rejects oversized text, excessive components, duplicates and unsupported actions',()=>{
 assert.throws(()=>render({title:'Limits',sections:['x'.repeat(4001)]}));
 assert.throws(()=>render({title:'Limits',sections:Array(45).fill('x')}));
 assert.throws(()=>render({title:'Duplicate',sections:['Test'],buttons:[button('A','panel','help'),button('B','panel','help')]}));
 assert.throws(()=>render({title:'Unsafe',sections:['Test'],buttons:[{label:'A',action:'arbitrary',args:'evil'}]}));
 assert.throws(()=>validatePayload({flags:MessageFlags.IsComponentsV2,components:[],content:'Legacy'}));
});
test('media allowlist rejects arbitrary origins, credentials and unsafe protocols',()=>{
 assert.throws(()=>safeUrl('http://cdn.discordapp.com/image.png'));assert.throws(()=>safeUrl('https://example.com/a'));assert.throws(()=>safeUrl('https://u:p@cdn.discordapp.com/a'));assert.equal(safeUrl('https://cdn.discordapp.com/a'),'https://cdn.discordapp.com/a');
});
test('branding preserves supplied files and maps sessions/applications separately',()=>{
 for(const file of Object.values(assets))assert.ok(fs.statSync(file).size>1000);assert.equal(bannerFor('ssu'),assets.sessions);assert.equal(bannerFor('application_submitted'),assets.applications);assert.equal(bannerFor('support'),assets.topic);assert.equal(monochrome('🚨 ALERT'),'ALERT');assert.match(icon('shield'),/^<:shield:\d+>$/);
});
test('rules contain complete numbered policy sets and paginated readable text',()=>{
 const c=JSON.stringify(seeds.community_rules.pages),s=JSON.stringify(seeds.server_rules.pages),staff=JSON.stringify(seeds.staff_handbook.pages);assert.match(c,/Rule 12/);assert.match(s,/18\. Common Sense/);assert.match(staff,/15\. Report serious security/);assert.ok(seeds.community_rules.pages.length>1);assert.ok(seeds.server_rules.pages.length>1);
});
test('every registered command passes Discord builder validation with unique names',()=>{
 const names=allCommands.map(c=>c.toJSON().name);assert.equal(new Set(names).size,names.length);assert.ok(!names.includes('apply'));assert.ok(names.includes('setup'));assert.ok(names.includes('security'));
});
