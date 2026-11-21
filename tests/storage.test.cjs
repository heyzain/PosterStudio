'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs/promises');
const path=require('node:path');
const {PosterStore,cleanPoster,parseImageInput}=require('../app/storage.cjs');
const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/ngAAAABJRU5ErkJggg==';
const poster=(id)=>({id,title:'Poster '+id,coverText:'HELLO',theme:'sage',idea:'a story',status:'draft',fbCaption:'FB caption',pinTitle:'Pinterest title',pinDescription:'Pin description',fbDate:'2026-11-12',pinDate:'2026-11-14',fbPosted:false,pinPosted:false,artwork:tinyPng});
test('choose folder, write original image, reopen, schedule, soft delete, keep numbering',async(t)=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'poster-studio-tests-'));t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const folder=path.join(tmp,'collection');await fs.mkdir(folder);
 const appSettings=path.join(tmp,'settings','preferences.json');
 const store=new PosterStore(appSettings);
 assert.equal((await store.init()).folder,null);
 assert.equal((await store.useFolder(folder)).posters.length,0);
 const pinTags='Inspirational quotes, Visual storytelling\nPersonal growth';
 let result=await store.saveAll([{...poster(1),pinTags}]);
 assert.equal(result.nextId,2);
 assert.equal(result.posters.length,1);
 assert.match(result.posters[0].artwork,/^poster-media:\/\/assets\/1\/artwork\.png\?v=/);
 const image=path.join(folder,'Posters','001','artwork.png');
 const bytes=await fs.readFile(image);
 assert.deepEqual(bytes,Buffer.from(tinyPng.split(',')[1],'base64'));
 const metadata=JSON.parse(await fs.readFile(path.join(folder,'Posters','001','poster.json'),'utf8'));
 assert.equal(metadata.artwork,'artwork.png');assert.equal(metadata.fbCaption,'FB caption');assert.equal(metadata.fbDate,'2026-11-12');
 assert.equal(metadata.pinTags,pinTags);
 assert.deepEqual((await fs.readdir(path.dirname(image))).sort(),['artwork.png','poster.json']);
 const reopened=new PosterStore(appSettings);const opened=await reopened.init();
 assert.equal(opened.folder,folder);assert.equal(opened.posters[0].title,'Poster 1');
 assert.equal(opened.posters[0].pinTags,pinTags);
 const edited={...opened.posters[0],fbDate:'2026-11-18',fbPosted:true,status:'ready'};
 result=await reopened.saveAll([edited]);
 assert.equal(result.posters[0].fbDate,'2026-11-18');
 assert.equal(result.posters[0].fbPosted,true);
 assert.equal(result.posters[0].pinTags,pinTags);
 assert.deepEqual(await fs.readFile(image),bytes);
 result=await reopened.saveAll([{...result.posters[0],artwork:'',removeArtwork:true}]);
 assert.equal(result.posters[0].artwork,'');
 await assert.rejects(fs.stat(image),{code:'ENOENT'});
 result=await reopened.saveAll([]);
 assert.equal(result.posters.length,0);assert.equal(result.nextId,2);
 const trash=await fs.readdir(path.join(folder,'.PosterStudioTrash'));
 assert.equal(trash.length,1);assert.ok(trash[0].startsWith('001-'));
 result=await reopened.saveAll([poster(2)]);
 assert.equal(result.nextId,3);
 assert.equal(result.posters[0].id,2);
});

test('Pinterest tags default to empty for existing posters and reject invalid values',()=>{
 assert.equal(cleanPoster(poster(1)).pinTags,'');
 assert.throws(()=>cleanPoster({...poster(1),pinTags:['Quotes']}),/Invalid pinTags/);
 assert.throws(()=>cleanPoster({...poster(1),pinTags:'x'.repeat(10001)}),/Invalid pinTags/);
});

test('existing Instagram artwork and plans carry over without marking Facebook as posted',async(t)=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'poster-studio-migration-'));
 t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const store=new PosterStore(path.join(tmp,'settings.json'));
 await store.useFolder(tmp);

 const {fbCaption,fbDate,artwork,...base}=poster(1);
 delete base.fbPosted;
 const bytes=Buffer.from(artwork.split(',')[1],'base64');
 for(const id of [1,2]){
   const posted=id===1;
   const dir=store.posterFolder(id);
   await fs.mkdir(dir);
   await fs.writeFile(path.join(dir,'instagram.png'),bytes);
   await fs.writeFile(path.join(dir,'poster.json'),JSON.stringify({
     ...base,id,status:posted?'published':'ready',pinPosted:posted,
     igCaption:fbCaption,igDate:fbDate,igPosted:posted,igImage:'instagram.png',
   }));
 }

 const {posters}=await store.getState();
 const completed=posters.find(p=>p.id===1);
 const planned=posters.find(p=>p.id===2);
 assert.equal(completed.fbCaption,fbCaption);
 assert.equal(completed.fbPosted,false);
 assert.equal(completed.fbDate,'');
 assert.equal(completed.status,'ready');
 assert.equal(completed.pinPosted,true);
 assert.equal(completed.pinDate,base.pinDate);
 assert.equal(planned.fbPosted,false);
 assert.equal(planned.fbDate,fbDate);
 assert.deepEqual(await fs.readFile((await store.imageFile(completed.artwork)).file),bytes);

 await store.saveAll([{...completed,fbPosted:true,fbDate:'2026-11-21'},planned]);
 const meta=JSON.parse(await fs.readFile(path.join(store.posterFolder(1),'poster.json'),'utf8'));
 assert.equal(meta.igPosted,true);
 assert.equal(meta.igDate,fbDate);
 assert.equal(meta.artwork,'instagram.png');
 const reloaded=(await store.getState()).posters;
 const updated=reloaded.find(p=>p.id===1);
 assert.equal(updated.fbPosted,true);
 assert.equal(updated.fbDate,'2026-11-21');
 assert.deepEqual(await fs.readFile((await store.imageFile(updated.artwork)).file),bytes);

 const result=await store.saveAll([
   {...updated,artwork:'',removeArtwork:true},
   {...planned,artwork:tinyPng},
 ]);
 assert.equal(result.posters[0].artwork,'');
 assert.match(result.posters[1].artwork,/\/artwork\.png\?v=/);
 for(const p of [completed,planned]) {
   await assert.rejects(store.imageFile(p.artwork),/not registered/);
   assert.deepEqual(await fs.readFile(path.join(store.posterFolder(p.id),'instagram.png')),bytes);
 }
});

test('older platform images share the existing Pinterest original with a Facebook fallback',async(t)=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'poster-studio-shared-'));
 t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const store=new PosterStore(path.join(tmp,'settings.json'));
 await store.useFolder(tmp);
 const {artwork,...base}=poster(1);
 const bytes=Buffer.from(artwork.split(',')[1],'base64');
 for(const id of [1,2]){
   const dir=store.posterFolder(id);
   await fs.mkdir(dir);
   await fs.writeFile(path.join(dir,'facebook.png'),bytes);
   if(id===1)await fs.writeFile(path.join(dir,'pinterest.png'),bytes);
   await fs.writeFile(path.join(dir,'poster.json'),JSON.stringify({
     ...base,id,fbImage:'facebook.png',pinImage:'pinterest.png',
   }));
 }
 const {posters}=await store.getState();
 const both=posters.find(p=>p.id===1);
 const onlyFacebook=posters.find(p=>p.id===2);
 assert.match(both.artwork,/\/pinterest\.png\?v=/);
 assert.match(onlyFacebook.artwork,/\/facebook\.png\?v=/);
 assert.equal((await store.imageFile(both.artwork)).file,path.join(store.posterFolder(1),'pinterest.png'));
 await assert.rejects(store.imageFile('poster-media://assets/1/facebook.png'),/not registered/);

 const saved=await store.saveAll([both,onlyFacebook]);
 assert.equal(saved.posters[0].artwork,both.artwork);
 assert.equal(saved.posters[1].artwork,onlyFacebook.artwork);
 await store.saveAll([{...saved.posters[0],artwork:'' ,removeArtwork:true},saved.posters[1]]);
 assert.equal((await store.getState()).posters[0].artwork,'');
 assert.deepEqual((await fs.readdir(store.posterFolder(1))).sort(),['facebook.png','pinterest.png','poster.json']);
});

test('image URL is restricted to known poster assets, invalid data rejected',async(t)=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'poster-studio-safe-'));t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const s=new PosterStore(path.join(tmp,'settings.json'));await fs.mkdir(path.join(tmp,'collection'));
 await s.useFolder(path.join(tmp,'collection'));
 assert.throws(()=>parseImageInput('data:image/png;base64,YWJjZA=='),/format/);
 await assert.rejects(s.saveAll([{...poster(1),title:''+'x'.repeat(101)}]),/title/);
 await assert.rejects(s.imageFile('poster-media://assets/1/../../settings.json'),/Invalid/);
 await s.saveAll([poster(1)]);
 const got=await s.imageFile('poster-media://assets/1/artwork.png');
 assert.equal(got.mime,'image/png');
 await assert.rejects(s.imageFile('poster-media://assets/1/pinterest.jpg'),/not registered/);
});
