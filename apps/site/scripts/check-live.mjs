import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

// Integration check against the real local backend. No request interception or fixtures.
const origin=process.env.LASRP_PREVIEW_ORIGIN??'http://127.0.0.1:5173';
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 const statusResponse=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public/erlc-status'&&r.status()===200,{timeout:75000});
 const firstResponse=statusResponse();
 await page.goto(`${origin}/server-status`);
 const first=await(await firstResponse).json();
 assert.equal(first.state,'live','The real upstream must respond for this live check to pass');
 assert.match(first.server.joinUrl??'',/^https:\/\/erlc\.gg\/join\/[a-zA-Z0-9_-]+$/);
 await page.getByText('Live API data',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/^Join Game/}).getAttribute('href'),first.server.joinUrl);
 assert.equal(await page.locator('time[datetime]').first().getAttribute('datetime'),first.updatedAt);
 assert.ok(!/"(?:Players|OwnerId|JoinKey|Location|Callsign)"/.test(JSON.stringify(first)));
 console.log('Real detailed dashboard and Join Game verified; waiting for automatic refresh.');
 const next=await(await statusResponse()).json();
 assert.equal(next.state,'live');
 assert.ok(Date.parse(next.updatedAt)>Date.parse(first.updatedAt),'Automatic refresh must obtain a newer upstream observation');
 await page.getByRole('link',{name:'Home',exact:true}).first().count().then(async count=>{
  if(count)await page.getByRole('link',{name:'Home',exact:true}).first().click();
  else await page.goto(origin);
 });
 await page.getByText('Your next session, at a glance.',{exact:true}).waitFor();
 await page.getByText('Live API data',{exact:true}).waitFor({timeout:60000});
 assert.equal(await page.getByRole('link',{name:/^Join Game/}).getAttribute('href'),first.server.joinUrl);
 console.log(JSON.stringify({verified:'real homepage, detail page, configured join link, automatic refresh',players:next.server.players,capacity:next.server.capacity,queue:next.server.queue,updatedAt:next.updatedAt}));
}finally{await browser.close();}
