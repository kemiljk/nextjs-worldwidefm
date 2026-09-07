import { cosmic } from '../../../../lib/cosmic-config';
import { buildSearchRegex } from '../../../../lib/search-query';
import { writeFileSync } from 'node:fs';
const full = 'id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';
const lean = 'id,slug,title,created_at,metadata.broadcast_date,metadata.genres.id,metadata.genres.title';
const records = [];
for (const term of ['Gilles Peterson','Clementine','Sam Bhok']) {
 for (const [name, props, limit] of [['baseline',full,20],['lean-20',lean,20],['lean-5',lean,5]] as const) {
  const start=performance.now();
  const r=await cosmic.objects.find({type:'episode',status:'published',title:buildSearchRegex(term),'metadata.broadcast_date':{$lte:'2026-09-06'}}).props(props).limit(limit).sort('-metadata.broadcast_date').depth(1);
  const row={term,name,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(JSON.stringify(r)),ids:r.objects.map((o:any)=>o.id),sample:r.objects[0]};
  records.push(row);
  writeFileSync('.context/compound-engineering/ce-optimize/search-latency/baseline.json',JSON.stringify(records,null,2));
  console.log(JSON.stringify({...row,ids:undefined,sample:undefined}));
 }
}
