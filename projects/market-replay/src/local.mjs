import {createServer} from 'node:http';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import worker from '../dist/server/index.js';

const directory=join(homedir(),'.market-replay','observations');
const root='http://127.0.0.1:8734';
await mkdir(directory,{recursive:true});
const fileFor=key=>join(directory,createHash('sha256').update(key).digest('hex')+'.json');
async function stored(key){
 try{
   const body=await readFile(fileFor(key),'utf8');
   return {etag:createHash('sha256').update(body).digest('hex'),json:()=>JSON.parse(body)};
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
const bucket={get:stored,head:stored,async put(key,body,options){
 const old=await stored(key);
 if(options.onlyIf.has('if-match')&&options.onlyIf.get('if-match')!=='"'+old?.etag+'"')return null;
 if(options.onlyIf.has('if-none-match')&&old)return null;
 const file=fileFor(key),temp=file+'.'+randomUUID();
 await writeFile(temp,body);await rename(temp,file);
 return {etag:createHash('sha256').update(body).digest('hex')};
}};
const read=url=>worker.fetch(new Request(root+url),{BUCKET:bucket},{waitUntil:p=>p.catch(e=>console.error(e.message))});
async function refresh(){await Promise.all(['/data/news.json','/data/prices.json'].map(read));}
const server=createServer(async(req,res)=>{
 try{const r=await worker.fetch(new Request(new URL(req.url,root),{method:req.method}),{BUCKET:bucket},{waitUntil:p=>p.catch(e=>console.error(e.message))});
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}
 catch{res.writeHead(500);res.end('Unable to serve this page.');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(8734,'127.0.0.1',()=>{
 console.log('Market Replay is running at '+root+'\nKeep this window open for source updates. Press Control-C to stop.');
 if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[root],{stdio:'ignore'}).unref();
 refresh().catch(console.error);
 setInterval(()=>refresh().catch(console.error),30*60*1000).unref();
});
