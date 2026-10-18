import {mkdir,copyFile,cp,rm,readFile,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist/assets',{recursive:true});await copyFile('index.html','dist/index.html');for(const file of ['app.js','data.js','ui.js','styles.css'])await copyFile('src/'+file,'dist/assets/'+file);await cp('public','dist',{recursive:true});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));manifest.static={directory:'dist'};await writeFile('.openai/hosting.json',JSON.stringify(manifest,null,2)+'\n');console.log('Built complete static app → dist/');
