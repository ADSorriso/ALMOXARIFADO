import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const entries=[['/index.html','text/html; charset=utf-8','dist/index.html'],['/app.js','text/javascript; charset=utf-8','dist/app.js'],['/truck3d.js','text/javascript; charset=utf-8','dist/truck3d.js'],['/purchase-orders.js','text/javascript; charset=utf-8','dist/purchase-orders.js'],['/menu-icons.js','text/javascript; charset=utf-8','dist/menu-icons.js'],['/style.css','text/css; charset=utf-8','dist/style.css'],['/truck3d.css','text/css; charset=utf-8','dist/truck3d.css'],['/purchase-orders.css','text/css; charset=utf-8','dist/purchase-orders.css'],['/menu-icons.css','text/css; charset=utf-8','dist/menu-icons.css'],['/brand.css','text/css; charset=utf-8','dist/brand.css'],['/light-theme.css','text/css; charset=utf-8','dist/light-theme.css'],['/icon-system.css','text/css; charset=utf-8','dist/icon-system.css']];
const officialLogo='data:image/png;base64,'+(await readFile(resolve(root,'assets/sorriso-logo-2026.png'))).toString('base64');
const pairs=await Promise.all(entries.map(async ([url,type,file])=>{
 let body=await readFile(resolve(root,file),'utf8');
 if(url==='/index.html')body=body.replace('__SORRISO_LOGO_DATA_URI__',officialLogo);
 return [url,{type,body}];
}));
const source=await readFile(resolve(root,'server/worker.js'),'utf8');
await mkdir(resolve(root,'dist/server'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),`const ASSETS=${JSON.stringify(Object.fromEntries(pairs))};\n${source}`);
