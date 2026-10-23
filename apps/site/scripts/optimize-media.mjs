import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const directory=fileURLToPath(new URL('../public/images/brand/',import.meta.url));
for(const name of await fs.readdir(directory)){
 if(!name.endsWith('.png')||name==='la-logo.png')continue;
 const source=path.join(directory,name),target=source.replace(/\.png$/,'.webp');
 await sharp(source).resize({width:1800,withoutEnlargement:true}).webp({quality:82}).toFile(target);
 const [before,after]=await Promise.all([fs.stat(source),fs.stat(target)]);
 console.log(`${name}: ${Math.round(before.size/1024)}KB → ${Math.round(after.size/1024)}KB WebP`);
}
