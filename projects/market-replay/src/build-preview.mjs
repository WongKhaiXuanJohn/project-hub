import {readFile,writeFile} from 'node:fs/promises';
const file=p=>new URL('../dist/'+p,import.meta.url);
let html=await readFile(file('index.html'),'utf8');
for(const name of ['style','markets','replay','board','chart','crude']){
 const css=await readFile(file(name+'.css'),'utf8');
 html=html.replace('<link rel="stylesheet" href="/'+name+'.css">',()=>'<style>'+css+'</style>');
}
const [prices,news]=await Promise.all(['prices','news'].map(async n=>JSON.parse(await readFile(file('data/'+n+'.json'),'utf8'))));
const seed=JSON.stringify({prices,news,asOf:new Date().toISOString()}).replaceAll('<','\\u003c');
html=html.replace('<script src="/atlas.js"',()=>'<script id="saved-edition" type="application/json">'+seed+'</script><script src="/atlas.js"');
for(const name of ['atlas','crude','markets','replay','app']){
 const script=await readFile(file(name+'.js'),'utf8');
 html=html.replace('<script src="/'+name+'.js" defer></script>',()=>'<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
}
html=html.replace('href="/favicon.svg"','href="data:image/svg+xml;base64,'+(await readFile(file('favicon.svg'))).toString('base64')+'"');
await writeFile(new URL('../Market-Replay.html',import.meta.url),html);
