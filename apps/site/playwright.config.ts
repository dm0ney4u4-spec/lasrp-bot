import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', fullyParallel:true, workers:2, retries:0,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'tablet',use:{...devices['iPad Pro 11'],defaultBrowserType:'chromium'}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000},
});
