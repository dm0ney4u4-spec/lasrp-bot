import {test,expect} from '@playwright/test';
const paths=['/','/server-status','/departments','/departments/lapd','/departments/lasd','/departments/lafd','/departments/dot','/departments/chp','/departments/lapd/portal','/applications','/applications/dashboard','/applications/status','/cad','/staff','/sessions','/community','/community/rules','/community/news','/community/guides','/community/contact','/profile','/missing-page'];
test.beforeEach(async({page})=>{await page.route('**/api/public/erlc-status',route=>route.fulfill({status:503,json:{error:'Isolated browser test'}}));await page.route('**/api/website/**',route=>route.fulfill({status:401,json:{error:'Isolated browser test'}}));});
test('all routes render directly without errors or horizontal overflow',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of paths){await page.goto(path);await expect(page.locator('main h1')).toBeVisible();await expect(page.locator('footer')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);if(path==='/')await page.screenshot({path:testInfo.outputPath('homepage.png'),animations:'disabled'});if(path==='/departments/lapd')await page.screenshot({path:testInfo.outputPath('lapd.png'),animations:'disabled'});}
  expect(errors).toEqual([]);
});
test('navigation, department gallery and rank disclosure work',async({page},testInfo)=>{
  await page.goto('/');if(testInfo.project.name!=='desktop')await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.getByRole('button',{name:'Departments',exact:true}).click();
  await page.locator('#department-navigation').getByRole('link',{name:'LAPD',exact:true}).click();
  await expect(page).toHaveURL(/\/departments\/lapd$/);await expect(page.locator('main')).toBeFocused();
  await page.locator('.rank-tree summary').first().click();await expect(page.locator('.rank-tree details').first()).toHaveAttribute('open','');
  await page.getByRole('button',{name:/02 Uniform standards/}).click();await expect(page.locator('.gallery-stage h3')).toHaveText('Uniform standards');
  await page.goBack();await expect(page).toHaveURL(/\/$/);
});
test('missing images use a branded fallback without an error loop',async({page})=>{
  await page.route('**/images/lapd/hero.svg',route=>route.abort());await page.goto('/departments/lapd');
  await expect(page.locator('.page-hero img')).toHaveAttribute('src','/images/community/fallback.svg');
  await expect(page.locator('.page-hero img')).toHaveJSProperty('naturalWidth',1800);
});
test('all configured images load and no fabricated login or submission is offered',async({page})=>{
  await page.goto('/');const paths=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')!));
  for(const src of new Set(paths)){const response=await page.request.get(src);expect(response.ok(),src).toBe(true);}
  await page.goto('/applications');await expect(page.locator('form')).toHaveCount(0);await expect(page.getByText(/does not accept or save/)).toBeVisible();
  await page.goto('/profile');await expect(page.getByRole('button',{name:/sign in|log in/i})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Website account access coming soon'})).toBeVisible();
});
test('keyboard navigation exposes menus and preserves reduced motion',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  if(testInfo.project.name!=='desktop')await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Community',exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(trigger).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Tab');await expect(page.locator('#community-navigation a').first()).toBeFocused();await page.keyboard.press('Escape');await expect(trigger).toHaveAttribute('aria-expanded','false');
  expect(await page.locator('main').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
