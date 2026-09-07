import { buildSearchRegex } from '../../../../lib/search-query';
import { SEARCH_RESULT_PROPS } from '../../../../lib/search-page';
import { writeFileSync, readFileSync } from 'node:fs';
const full='id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';
const rows=[];
for(let round=0;round<2;round++) for(const term of ['Gilles Peterson','Clementine','Sam Bhok']) {
 for(const name of (round===0?['baseline','final']:['final','baseline'])) {
  const url=new URL(`https://api.cosmicjs.com/v3/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/objects`);
  url.search=new URLSearchParams({read_key:process.env.NEXT_PUBLIC_COSMIC_READ_KEY!,query:JSON.stringify({type:'episode',status:'published',title:buildSearchRegex(term),'metadata.broadcast_date':{$lte:'2026-09-06'}}),props:name==='baseline'?full:SEARCH_RESULT_PROPS,limit:name==='baseline'?'20':'5',sort:'-metadata.broadcast_date',depth:'1',useCache:'false'}).toString();
  const start=performance.now();const response=await fetch(url);const text=await response.text();const data=JSON.parse(text);
  const row={round,term,name,status:response.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text),ids:(data.objects||[]).map((x:any)=>x.id)};rows.push(row);
  const path='.context/compound-engineering/ce-optimize/search-latency/controlled.json';writeFileSync(path,JSON.stringify(rows,null,2));JSON.parse(readFileSync(path,'utf8'));console.log(JSON.stringify({...row,ids:undefined}));
 }
}
