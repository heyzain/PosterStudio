'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {Workspace} = require('../app/workspace.cjs');
const {createDestination,presets,cleanField,fieldValue} = require('../app/destinations.cjs');
const {websiteIcon} = require('../app/website-icons.cjs');

async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'poster-v2-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const store = new Workspace(root);
  await store.init();
  return store;
}

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
