import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, extname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const dist = resolve(directory, '../dist');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2', '.txt':'text/plain'};
const assets = {};
async function collect(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || entry.name === 'server') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await collect(path); continue; }
    if (!entry.isFile()) continue;
    const type = mime[extname(path)];
    if (!type) throw new Error('Unsupported asset: ' + path);
    const binary = !/^(text\/|application\/json|image\/svg)/.test(type);
    const data = await readFile(path);
    const key = '/' + relative(dist,path).split(sep).join('/');
    assets[key] = {type:type + (binary?'':'; charset=utf-8'), body:data.toString(binary?'base64':'utf8'), binary};
  }
}
await collect(dist);
for (const name of ['/index.html','/data/news.json','/data/prices.json']) {
  if (!assets[name]) throw new Error('Missing deployment asset ' + name);
}
const [main, belgianOil] = await Promise.all(['live.mjs','oil-daily.mjs'].map(name => readFile(join(directory,name),'utf8')));
const runtime = main.replace("import {getBelgianOilPatch} from './oil-daily.mjs';", () => belgianOil.replace(/^export /gm,''));
await mkdir(join(dist,'server'),{recursive:true});
await writeFile(join(dist,'server/index.js'),'const ASSETS = '+JSON.stringify(assets)+';\n'+runtime);
console.log('Built Market Replay Worker with '+Object.keys(assets).length+' assets.');
