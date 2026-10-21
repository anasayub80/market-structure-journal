import {mkdir,copyFile,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {extname} from 'node:path';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});await mkdir('dist/assets',{recursive:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await copyFile('index.html','dist/index.html');
for(const file of ['app.js','data.js','ui.js','styles.css','importer.js','imports-ui.js','cloud.js'])await copyFile('src/'+file,'dist/assets/'+file);await cp('public','dist',{recursive:true});
const assets={};const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.csv':'text/csv; charset=utf-8','.mq5':'text/plain; charset=utf-8'};
async function collect(folder,prefix=''){for(const file of await readdir(folder,{withFileTypes:true})){if(['server','.openai'].includes(file.name))continue;const path=folder+'/'+file.name,key=prefix+'/'+file.name;if(file.isDirectory())await collect(path,key);else assets[key]={type:mime[extname(file.name)]||'application/octet-stream',body:await readFile(path,'utf8')};}}
await collect('dist');await writeFile('server/assets.generated.js','export const assets='+JSON.stringify(assets)+';\n');
await build({entryPoints:['server/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});await copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('Built Cloudflare Worker, secure API, and all UI assets → dist/');
