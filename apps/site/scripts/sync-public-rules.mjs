import fs from 'node:fs';
const source=new URL('../../bot/src/rules.json',import.meta.url),output=new URL('../src/config/public-regulations.json',import.meta.url);
const rules=JSON.parse(fs.readFileSync(source,'utf8'));fs.writeFileSync(output,JSON.stringify({community:rules.community,server:rules.server},null,2)+'\n');
console.log('Synchronized public Discord/in-game regulations only; private staff policies excluded.');
