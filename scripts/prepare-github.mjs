import {cp,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const destination=resolve(process.argv[2]||'github-export');
await mkdir(destination,{recursive:true});

const assets=['app.js','truck3d.js','purchase-orders.js','menu-icons.js','style.css','truck3d.css','purchase-orders.css','menu-icons.css','brand.css','light-theme.css','icon-system.css'];
for(const name of assets)await copyFile(join(root,'dist',name),join(destination,name));

// The Sites source uses an embedded image marker. GitHub's static preview
// references the logo file directly instead.
const sourceHtml=await readFile(join(root,'dist/index.html'),'utf8');
await writeFile(join(destination,'index.html'),sourceHtml.replace('__SORRISO_LOGO_DATA_URI__','./assets/sorriso-logo-2026.png'));

for(const folder of ['assets','dist','drizzle','server','scripts'])await cp(join(root,folder),join(destination,folder),{recursive:true});
for(const name of ['README.md','.gitignore'])await copyFile(join(root,name),join(destination,name));
console.log('GitHub export prepared:',destination);
