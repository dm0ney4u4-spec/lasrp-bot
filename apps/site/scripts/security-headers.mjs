import fs from 'node:fs';
import {loadEnv} from 'vite';
const env=loadEnv('production',process.cwd(),'VITE_');const configured=process.env.VITE_PUBLIC_API_ORIGIN??env.VITE_PUBLIC_API_ORIGIN;let origin='';
if(configured){const url=new URL(configured);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Production VITE_PUBLIC_API_ORIGIN must be an HTTPS origin without a path or credentials');origin=' '+url.origin;}
const template=fs.readFileSync('public/_headers','utf8');fs.writeFileSync('dist/_headers',template.replace("connect-src 'self'",`connect-src 'self'${origin}`));
console.log('Generated public site security headers for the configured API origin.');
