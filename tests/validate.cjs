'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const context=vm.createContext({});
vm.runInContext(read('data.js')+'\nthis.exported={WORLDS,LESSONS,BUILDERS}',context);
const {WORLDS,LESSONS,BUILDERS}=context.exported;
assert.equal(WORLDS.length,9);
const qs=Object.values(LESSONS).flat();
assert.equal(qs.length,118);
assert.equal(qs.filter(q=>q.level==='n5').length,82);
assert.equal(qs.filter(q=>q.level==='n4').length,36);
assert.equal(Object.keys(BUILDERS).length,18);
const ids=new Set();
const jpn=/[ぁ-んァ-ヶ一-龥]/;
const korean=/[가-힣]/;
for(const w of WORLDS){
  assert.ok(LESSONS[w.id]?.length>=12,`Not enough questions: ${w.id}`);
  for(const file of [`assets/bg-${w.id}.webp`,`assets/npc-${w.id}.webp`]) assert.ok(fs.existsSync(path.join(root,file)),`Missing ${file}`);
}
for(const q of qs){
  assert.ok(q.id && !ids.has(q.id),`Duplicate id ${q.id}`);ids.add(q.id);
  assert.ok(q.world && q.npc && q.kana && q.roma && q.ko && q.ans && q.ansRoma && q.ansKo && q.tip);
  assert.equal(q.choices.length,3);
  assert.equal(q.choices[0][0],q.ans);
  for(const [jp,ko] of q.choices){assert.ok(jpn.test(jp),`Non-Japanese choice: ${q.id}`);assert.ok(korean.test(ko),`Non-Korean meaning: ${q.id}`);}
  assert.ok(korean.test(q.tip),`Tip missing Korean explanation: ${q.id}`);
  assert.ok(['n5','n4'].includes(q.level));
  if(q.build) assert.equal(q.build.join(''),q.ans,`Builder mismatch ${q.id}`);
}
for(const asset of fs.readdirSync(path.join(root,'assets')).filter(x=>x.endsWith('.webp'))){
  const bytes=fs.readFileSync(path.join(root,'assets',asset));
  assert.equal(bytes.toString('ascii',0,4),'RIFF',`WebP RIFF header missing: ${asset}`);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',`WebP signature missing: ${asset}`);
}
for(const file of ['index.html','styles.css','game.js','data.js','pwa.js','service-worker.js','manifest.webmanifest','favicon.webp'])assert.ok(fs.existsSync(path.join(root,file)),`Missing root file: ${file}`);
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
const sw=read('service-worker.js');
for(const asset of fs.readdirSync(path.join(root,'assets')).filter(x=>x.endsWith('.webp')))assert.ok(sw.includes(`./assets/${asset}`),`Not precached: ${asset}`);
console.log(`PASS — ${WORLDS.length} chapters, ${qs.length} questions (N5-like: 82, N4-like: 36), ${Object.keys(BUILDERS).length} sentence puzzles, ${fs.readdirSync(path.join(root,'assets')).length} WebP assets.`);
