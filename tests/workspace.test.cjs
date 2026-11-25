'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {Workspace} = require('../app/workspace.cjs');
const {createThumbnailCache} = require('../app/thumbnail-cache.cjs');
const {createDestination,presets,cleanField,fieldValue} = require('../app/destinations.cjs');
const {websiteIcon} = require('../app/website-icons.cjs');

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'poster-v2-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const store = new Workspace(root);
  await store.init();
  return store;
}

test('draft artwork is previewable, survives a failed save, and is promoted only when saved',async t => {
  const store = await workspace(t);
  const [collection] = (await store.saveCollection(null,{name:'Drafts'})).collections;
  const asset = await store.storeAsset(Buffer.from('preview'),'image.png','png',{draft:true});
  const abandoned = await store.storeAsset(Buffer.from('abandoned'),'other.png','png',{draft:true});
  assert.equal(path.dirname(await store.assetFile(asset.id)),store.staging);
  await assert.rejects(store.saveItem(collection.id,{title:'',artwork:asset.id,records:[]}),/required/);
  assert.equal(await fs.readFile(await store.assetFile(asset.id),'utf8'),'preview');
  await store.saveItem(collection.id,{title:'Saved',artwork:asset.id,records:[]});
  await store.discardDraftAssets([asset.id,abandoned.id]);
  assert.equal(path.dirname(await store.assetFile(asset.id)),store.assets);
  await assert.rejects(fs.access(path.join(store.staging,abandoned.id)),{code:'ENOENT'});
  const interrupted = await store.storeAsset(Buffer.from('after crash'),'crash.png','png',{draft:true});
  const reopened = new Workspace(store.root);
  await reopened.init();
  await assert.rejects(fs.access(path.join(reopened.staging,interrupted.id)),{code:'ENOENT'});
  assert.equal(await fs.readFile(await reopened.assetFile(asset.id),'utf8'),'preview');
});

test('storage cleanup keeps archived content, inactive destination files and in-progress drafts',async t => {
  const store = await workspace(t);
  const cover = await store.storeAsset(Buffer.from('cover'),'cover.png','png');
  const [collection] = (await store.saveCollection(null,{name:'Cleanup',cover:cover.id,destinations:[{type:'facebook'}]})).collections;
  const [destination] = collection.destinations;
  const image = destination.fields.find(field => field.type === 'file');
  const attachment = await store.storeAsset(Buffer.from('attached'),'attachment.bin','bin',{draft:true});
  const orphan = await store.storeAsset(Buffer.from('unused'),'unused.jpg','jpg');
  const draft = await store.storeAsset(Buffer.from('draft'),'draft.png','png',{draft:true});
  const [item] = (await store.saveItem(collection.id,{title:'Post',records:[{
    id:destination.id,selected:true,status:'draft',values:{[image.id]:attachment},
  }]})).collections[0].items;
  await store.saveItem(collection.id,{id:item.id,title:item.title,records:[{id:destination.id,selected:false}]});
  await store.changeField(collection.id,destination.id,image.id,'archive');
  await store.archiveItem(collection.id,item.id,true);
  await store.archiveCollection(collection.id,true);
  await fs.writeFile(path.join(store.assets,'notes.txt'),'personal');
  const trash = await fs.mkdtemp(path.join(store.root,'trash-'));
  assert.deepEqual(await store.cleanUnusedAssets(file => fs.rename(file,path.join(trash,path.basename(file)))),{moved:1,failed:0});
  assert.deepEqual(await fs.readdir(trash),[orphan.id]);
  assert.deepEqual(await fs.readdir(store.staging),[draft.id]);
  await Promise.all([store.assetFile(cover.id),store.assetFile(attachment.id),fs.access(path.join(store.assets,'notes.txt'))]);
});

test('thumbnail variants limit image size, reuse work, and preserve the original',async t => {
  const store = await workspace(t);
  const original = Buffer.alloc(8192, 1);
  const asset = await store.storeAsset(original,'cover.jpg','jpg');
  const file = await store.assetFile(asset.id);
  const resizeCalls = [];
  const bytes = Buffer.from('compressed');
  const nativeImage = {createFromBuffer(input) {
    assert.deepEqual(input,original);
    return {
      isEmpty:() => false,
      getSize:() => ({width:900,height:1200}),
      resize(options) { resizeCalls.push(options); return {toJPEG:() => bytes}; },
    };
  }};
  const thumbnail = createThumbnailCache(nativeImage,'linux');
  assert.deepEqual(await Promise.all([thumbnail(file,'small'),thumbnail(file,'small')]),[
    {bytes,type:'image/jpeg'},{bytes,type:'image/jpeg'},
  ]);
  await thumbnail(file,'small');
  await thumbnail(file,'cover');
  assert.deepEqual(resizeCalls,[{height:160,quality:'good'},{height:768,quality:'good'}]);
  assert.deepEqual(await fs.readFile(file),original);
  assert.equal(await createThumbnailCache({createFromBuffer:() => ({isEmpty:() => true})},'linux')(file,'small'),null);
});

test('collections and numbering persist independently, archive is reversible, and export copies assets',async t => {
  const store = await workspace(t);
  assert.deepEqual(store.state().collections,[]);
  await Promise.all([store.saveCollection(null,{name:'Mira, Zavi & Pip'}),store.saveCollection(null,{name:'My Portfolio',mark:'code'})]);
  const [stories,portfolio] = store.state().collections;
  const artwork = await store.storeAsset(Buffer.from('asset bytes'),'original.png','png');
  await store.saveItem(stories.id,{title:'Perspective',artwork:artwork.id,records:[]});
  await store.saveItem(portfolio.id,{title:'Async UI',records:[]});
  assert.equal(store.state().collections[0].items[0].number,1);
  assert.equal(store.state().collections[1].items[0].number,1);
  const item = store.state().collections[0].items[0];
  await store.archiveItem(stories.id,item.id,true);
  await store.saveItem(stories.id,{title:'A new story',records:[]});
  assert.equal(store.state().collections[0].items[0].number,2);
  await store.saveCollection(stories.id,{name:'Stories',description:'Illustrations',cover:artwork.id});
  await store.archiveCollection(stories.id,true);

  const reopened = new Workspace(store.root);
  await reopened.init();
  assert.equal(reopened.state().collections[0].archived,true);
  await reopened.archiveCollection(stories.id,false);
  await reopened.archiveItem(stories.id,item.id,false);
  assert.deepEqual(reopened.state().collections[0].items[1],{...item,archived:false});
  assert.equal(reopened.state().collections[0].name,'Stories');
  assert.equal(reopened.state().collections[0].description,'Illustrations');
  await assert.rejects(reopened.assetFile('../workspace.json'),/Invalid asset/);
  const folder = await reopened.exportCollection(store.root,stories.id,item.id);
  const exported = JSON.parse(await fs.readFile(path.join(folder,'collection.json'),'utf8'));
  assert.equal(exported.collection.items.length,1);
  assert.equal(exported.collection.items[0].id,item.id);
  assert.equal(await fs.readFile(path.join(folder,'assets',artwork.id),'utf8'),'asset bytes');
});

test('saved artwork opens from numbered post folders without changing originals or overwriting copies',async t => {
  const store = await workspace(t);
  const collection = (await store.saveCollection(null,{name:'My: Portfolio',destinations:[{type:'instagram'}]})).collections[0];
  const [destination] = collection.destinations;
  const field = destination.fields.find(entry => entry.type === 'file');
  const shared = await store.storeAsset(Buffer.from('shared image'),'source.jpg','jpg');
  const specific = await store.storeAsset(Buffer.from('instagram image'),'variant.webp','webp');
  const item = (await store.saveItem(collection.id,{title:'Perspective / Revisited',artwork:shared.id,records:[{
    id:destination.id,selected:true,status:'draft',values:{[field.id]:specific},
  }]})).collections[0].items[0];
  const reopened = new Workspace(store.root);
  await reopened.init();
  const [revealed, repeated] = await Promise.all([
    reopened.revealArtwork(collection.id,item.id,specific.id),
    reopened.revealArtwork(collection.id,item.id,specific.id),
  ]);
  assert.equal(revealed,repeated);
  const folder = path.join(store.root,'Collections',`My Portfolio (${collection.id.slice(0,8)})`,'Posts','001 - Perspective Revisited');
  assert.equal(path.dirname(revealed),folder);
  assert.match(path.basename(revealed),/^Instagram - .*\.webp$/);
  assert.equal(await fs.readFile(revealed,'utf8'),'instagram image');
  assert.equal(await fs.readFile(path.join(folder,'Shared artwork.jpg'),'utf8'),'shared image');
  await fs.writeFile(revealed,'local edits');
  const next = await reopened.revealArtwork(collection.id,item.id,specific.id);
  assert.notEqual(next,revealed);
  assert.equal(await fs.readFile(revealed,'utf8'),'local edits');
  assert.equal(await fs.readFile(next,'utf8'),'instagram image');
  assert.equal(await fs.readFile(await reopened.assetFile(specific.id),'utf8'),'instagram image');
  assert.equal(await reopened.revealArtwork(collection.id,item.id,specific.id),next);
  await assert.rejects(reopened.revealArtwork(collection.id,item.id,'../workspace.json'),/Save the post/);
});

test('destination status, values and plans remain independent across schema edits and restarts',async t => {
  const store = await workspace(t);
  const collection = (await store.saveCollection(null,{name:'Publishing'})).collections[0];
  for (const type of Object.keys(presets).filter(type => type !== 'website')) await store.addDestination(collection.id,type);
  const [facebook,,pinterest] = store.state().collections[0].destinations;
  const titleField = pinterest.fields[0];
  const tagsField = pinterest.fields.find(f => f.type === 'tags');
  await store.saveItem(collection.id,{title:'Perspective',records:[
    {id:facebook.id,selected:true,status:'scheduled',planned:'2026-11-23T13:30',values:{[facebook.fields[0].id]:'Facebook text'}},
    {id:pinterest.id,selected:true,status:'scheduled',planned:'2026-11-24',values:{[titleField.id]:'Original pin',[tagsField.id]:['Storytelling']}},
  ]});
  const [item] = store.state().collections[0].items;
  await store.setPublication(collection.id,item.id,facebook.id,'published','2026-11-23T14:10');
  await store.changeField(collection.id,pinterest.id,titleField.id,'save',{...titleField,label:'Search title'});
  await store.changeField(collection.id,pinterest.id,tagsField.id,'archive');
  await store.changeField(collection.id,pinterest.id,titleField.id,'down');
  await store.changeDestination(collection.id,pinterest.id,{enabled:false});
  const reopened = new Workspace(store.root);
  await reopened.init();
  const current = reopened.state().collections[0];
  const [fb,pin] = current.items[0].records;
  assert.equal(fb.status,'published');
  assert.equal(pin.status,'scheduled');
  assert.equal(pin.planned,'2026-11-24');
  assert.equal(pin.values[titleField.id],'Original pin');
  assert.deepEqual(pin.values[tagsField.id],['Storytelling']);
  assert.equal(current.destinations[2].fields[1].label,'Search title');
  await reopened.changeField(collection.id,pinterest.id,tagsField.id,'restore');
  await reopened.setPublication(collection.id,item.id,facebook.id,'undo','');
  assert.equal(reopened.state().collections[0].items[0].records[0].status,'scheduled');
  assert.equal(reopened.state().collections[0].items[0].records[1].planned,'2026-11-24');
  await assert.rejects(reopened.saveItem(collection.id,{title:'Other post',records:[pin]}),/disabled/);
  assert.equal(reopened.state().collections[0].nextNumber,2);
});

test('same-status saves and replans enforce required fields without losing existing content',async t => {
  const store = await workspace(t);
  const collection = (await store.saveCollection(null,{name:'Required fields',destinations:[{type:'facebook'}]})).collections[0];
  const [destination] = collection.destinations;
  const [caption,image] = destination.fields;
  const artwork = await store.storeAsset(Buffer.from('original'),'shared.png','png');
  const post = {title:'Post',artwork:artwork.id};
  await store.changeField(collection.id,destination.id,caption.id,'save',{...caption,required:true});
  await store.changeField(collection.id,destination.id,image.id,'save',{...image,required:true});

  for (const status of ['ready','scheduled']) {
    const record = {id:destination.id,selected:true,status,planned:status === 'scheduled' ? '2026-11-25' : '',
      values:{[caption.id]:'Keep this caption',[image.id]:'shared'}};
    const saved = (await store.saveItem(collection.id,{...post,records:[record]})).collections[0].items[0];
    for (const value of ['', ' \t\n ']) {
      await assert.rejects(store.saveItem(collection.id,{...post,id:saved.id,records:[{
        ...record,values:{...record.values,[caption.id]:value},
      }]}),/Caption is required/);
    }
    await assert.rejects(store.saveItem(collection.id,{...post,id:saved.id,artwork:null,records:[]}),/Image/);
    assert.deepEqual(store.state().collections[0].items[0],saved);
    await store.saveItem(collection.id,{...post,id:saved.id,records:[{
      ...record,values:{...record.values,[caption.id]:'Updated caption'},
    }]});
  }

  const scheduled = store.state().collections[0].items[0];
  const updated = (await store.changeField(collection.id,destination.id,null,'save',{label:'Approval',type:'checkbox',required:true})).collections[0];
  await assert.rejects(store.setPublication(collection.id,scheduled.id,destination.id,'plan','2026-11-26'),/Approval is required/);
  const approval = updated.destinations[0].fields.at(-1);
  const plannedDate = scheduled.records[0].planned;
  assert.equal(store.state().collections[0].items[0].records[0].planned,plannedDate);
  await store.changeField(collection.id,destination.id,approval.id,'archive');
  await store.setPublication(collection.id,scheduled.id,destination.id,'plan','2026-11-26');
  assert.equal(store.state().collections[0].items[0].records[0].planned,'2026-11-26');
  await store.saveItem(collection.id,{...post,artwork:null,records:[{id:destination.id,selected:true,status:'draft',values:{}}]});
});

test('field schemas validate inputs, retain stable choice IDs, and support all requested types',() => {
  assert.equal(createDestination('linkedin').fields.find(field => field.label === 'Image').defaultValue,'shared');
  const choice = cleanField({type:'select',label:'Category',options:[{label:'Engineering'},{label:'Design'}],defaultOptionIndex:1});
  assert.equal(choice.defaultValue,choice.options[1].id);
  const next = cleanField({...choice,options:[{...choice.options[1],label:'Visual design'}]},choice);
  assert.equal(next.options[0].id,choice.options[1].id);
  assert.equal(next.options[1].archived,true);
  assert.equal(fieldValue(next,choice.options[0].id),choice.options[0].id);
  const validates = [
    [{type:'text',maxLength:2}, 'OK', 'long'],
    [{type:'long',maxLength:8}, 'Two\nlines'.slice(0,8), 12],
    [{type:'tags'}, ['Engineering'], ['']],
    [{type:'number',min:0,max:10}, 4, 20],
    [{type:'datetime'}, '2026-11-23T13:44','2026-02-31'],
    [{type:'checkbox'}, false, 'false'],
    [{type:'file'}, 'shared', '../outside'],
    [{type:'url'}, 'https://example.com/', 'file:///tmp/a'],
  ];
  for (const [props,good,bad] of validates) {
    const field = cleanField({label:'A field',...props});
    assert.deepEqual(fieldValue(field,good),good);
    assert.throws(() => fieldValue(field,bad));
  }
  assert.throws(() => fieldValue({...next,required:true},null,null,true),/required/);
});

test('custom website profiles can be reused and duplicate destinations are rejected',async t => {
  const store = await workspace(t);
  await store.saveCollection(null,{name:'Portfolio'});
  await store.saveCollection(null,{name:'Engineering'});
  const [one,two] = store.state().collections;
  await store.addDestination(one.id,'website',{name:'heyzain.dev',url:'https://heyzain.dev',description:'Portfolio'});
  const [site] = store.state().websites;
  await store.addDestination(two.id,'website',{id:site.id});
  const second = store.state().collections[1].destinations[0];
  assert.equal(second.name,'heyzain.dev');
  assert.equal(second.url,'https://heyzain.dev/');
  assert.equal(second.mark,'◎');
  assert.equal(store.state().websites.length,1);
  await assert.rejects(store.addDestination(two.id,'website',{id:site.id}),/already exists/);
  await assert.rejects(store.addDestination(two.id,'website',{name:'Bad',url:'file:///temp'}),/HTTP/);
});

test('favicon lookup uses a checked same-origin address and rejects private networks',async () => {
  const calls = [];
  const lookup = async () => [{address:'93.184.216.34'}];
  const fetch = async (url,address) => {
    calls.push([url.pathname,address]);
    if (url.pathname === '/favicon.ico') return null;
    if (url.pathname === '/') return {type:'text/html',bytes:Buffer.from('<link rel="icon" href="/icon.png">')};
    return {type:'image/png',bytes:Buffer.from('icon')};
  };
  const decode = bytes => bytes.toString() === 'icon' ? bytes : null;
  assert.equal((await websiteIcon('https://example.com',decode,{lookup,fetch})).toString(),'icon');
  assert.deepEqual(calls,[['/favicon.ico','93.184.216.34'],['/','93.184.216.34'],['/icon.png','93.184.216.34']]);
  await assert.rejects(websiteIcon('http://127.0.0.1',decode,{lookup:async () => [{address:'127.0.0.1'}],fetch}),/unavailable/);
  await assert.rejects(websiteIcon('https://example.com',decode,{lookup:async () => [...await lookup(),{address:'192.168.1.1'}],fetch}),/unavailable/);
  const remote = await websiteIcon('https://example.com',decode,{lookup,fetch:async url => url.pathname === '/' ?
    {type:'text/html',bytes:Buffer.from('<link rel="icon" href="https://other.example/icon.png">')} : null});
  assert.equal(remote,null);
});
