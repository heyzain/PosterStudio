'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {Workspace} = require('../app/workspace.cjs');
const {schedulePreview, findCollection, latestPublication} = require('../app/assistant-schedule.cjs');
const {assistantProvider} = require('../app/assistant-provider.cjs');

async function temporaryDirectory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'poster-assistant-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  return root;
}

test('bulk preview follows post order, preserves times and skips a published destination', async t => {
  const store = new Workspace(await temporaryDirectory(t));
  await store.init();
  const [collection] = (await store.saveCollection(null,{
    name:'Story posters', destinations:[{type:'facebook'},{type:'pinterest'}],
  })).collections;
  const [facebook, pinterest] = collection.destinations;
  const planned = id => ({id, selected:true, status:'scheduled', planned:'2026-11-27T09:30'});
  const [first] = (await store.saveItem(collection.id,{
    title:'First', records:[planned(facebook.id), planned(pinterest.id)],
  })).collections[0].items;
  await store.setPublication(collection.id, first.id, facebook.id, 'published', '2026-11-27T10:05');
  await store.saveItem(collection.id,{title:'Unscheduled draft', records:[{id:facebook.id, selected:true,status:'draft'}]});
  const [third] = (await store.saveItem(collection.id,{
    title:'Third', records:[planned(facebook.id),{id:pinterest.id,selected:true,status:'ready'}],
  })).collections[0].items;
  const options = {collectionId:collection.id, start:'2026-11-30', intervalDays:2};
  const original = store.state();
  const preview = schedulePreview(original, options);
  assert.equal(findCollection(original, '', 'story posters'), collection.id);
  assert.equal(preview.postCount, 2);
  assert.deepEqual(preview.rows.map(row => [row.number,row.destination,row.planned]),[
    [1,'Pinterest','2026-11-30T09:30'],
    [3,'Facebook','2026-12-02T09:30'],
    [3,'Pinterest','2026-12-02'],
  ]);
  assert.deepEqual(store.state(), original);
  const saved = await store.applyAssistantSchedule(options, preview);
  const items = saved.collections[0].items;
  assert.deepEqual(items.find(item => item.id === first.id).records[0],
    original.collections[0].items.find(item => item.id === first.id).records[0]);
  assert.equal(items.find(item => item.id === third.id).records[1].status, 'scheduled');
  assert.deepEqual(schedulePreview(saved, options).rows, []);
  await assert.rejects(store.applyAssistantSchedule(options, preview), /schedule changed/);
  const reopened = new Workspace(store.root);
  await reopened.init();
  assert.deepEqual(reopened.state(), saved);
});

test('a conflicting edit between preview and confirmation prevents the entire update', async t => {
  const store = new Workspace(await temporaryDirectory(t));
  await store.init();
  const [collection] = (await store.saveCollection(null, {name:'Calendar', destinations:[{type:'facebook'}]})).collections;
  const [destination] = collection.destinations;
  for (const title of ['First','Second']) {
    await store.saveItem(collection.id, {title, records:[{id:destination.id,selected:true,status:'scheduled',planned:'2026-11-28'}]});
  }
  const options = {collectionId:collection.id,start:'2026-12-01',intervalDays:2};
  const before = store.state();
  const preview = schedulePreview(before, options);
  const [last] = before.collections[0].items;
  const current = await store.setPublication(collection.id,last.id,destination.id,'plan','2026-12-02');
  await assert.rejects(store.applyAssistantSchedule(options, preview), /schedule changed/);
  assert.deepEqual(store.state(), current);
});

test('latest platform publication uses publication dates and returns the same post’s other destinations', () => {
  const linkedin = {id:'linkedin', type:'linkedin', name:'LinkedIn Profile'};
  const site = {id:'site', type:'website', name:'HeyZain'};
  const entry = (id, status, published, planned = '') => ({id, selected:true, status, published, planned});
  const post = (id, records, archived = false) => ({id, title:id, records, archived});
  const data = {collections:[
    {id:'stories',name:'Stories',destinations:[site],items:[]},
    {id:'portfolio',name:'Portfolio',destinations:[linkedin,site],items:[
      post('Recent draft',[entry('linkedin','scheduled','','2026-12-09')]),
      post('Archived post',[entry('linkedin','published','2026-12-08')], true),
      post('Older post',[entry('linkedin','published','2026-11-26','2026-12-08')]),
      post('Last LinkedIn post',[entry('linkedin','published','2026-11-27T09:00'),entry('site','scheduled','','2026-11-29')]),
    ]},
  ]};
  const {post:latest} = latestPublication(data,'','LinkedIn');
  assert.equal(latest.title,'Last LinkedIn post');
  assert.equal(latest.date,'2026-11-27T09:00');
  assert.equal(latest.actual,true);
  assert.deepEqual(latest.others,[{id:'site',name:'HeyZain',status:'scheduled',published:''}]);
  assert.equal(latestPublication(data,'stories','LinkedIn').post,null);
  assert.deepEqual(latestPublication(data,'portfolio','LinkedIn Profile').post,latest);
});

test('OpenRouter interprets user messages without receiving stored workspace data', async t => {
  const root = await temporaryDirectory(t);
  const file = path.join(root, 'openrouter-key.enc');
  const key = 'sk-or-test-' + 'a'.repeat(24);
  const safeStorage = {
    isEncryptionAvailable:() => true,
    getSelectedStorageBackend:() => 'gnome_libsecret',
    encryptString:value => Buffer.from(value).reverse(),
    decryptString:bytes => Buffer.from(bytes).reverse().toString(),
  };
  let requests = 0;
  const provider = assistantProvider(file, safeStorage, async (url, options) => {
    requests++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer ' + key);
    assert.equal(options.redirect, 'error');
    const {messages,model} = JSON.parse(options.body);
    assert.equal(model, 'openrouter/free');
    if (requests === 3) return Response.json({error:{code:429,message:'Provider rate limit'}});
    const asksForHistory = requests === 2;
    assert.deepEqual(messages.slice(1), [{role:'user',content:asksForHistory ? 'LinkedIn pe last post kab ki thi?' : 'Aaj kya post karna hai?'}]);
    assert.match(messages[0].content, /2026-11-28/);
    return Response.json({choices:[{message:{tool_calls:[{function:{
      name:asksForHistory ? 'latest_publication' : 'pending_publications',
      arguments:JSON.stringify(asksForHistory ? {destination:'LinkedIn'} : {date:'2026-11-28'}),
    }}]}}]});
  });
  assert.deepEqual(await provider.settings(), {configured:false,secureStorage:true});
  await provider.saveKey(key);
  assert.deepEqual(await provider.settings(), {configured:true,secureStorage:true});
  assert.notEqual(await fs.readFile(file,'utf8'), key);
  assert.deepEqual(await provider.interpret(['Aaj kya post karna hai?'],'2026-11-28'),
    {type:'agenda',date:'2026-11-28',collection:'',useSelectedCollection:false});
  assert.deepEqual(await provider.interpret(['LinkedIn pe last post kab ki thi?'],'2026-11-28'),
    {type:'history',destination:'LinkedIn',collection:'',useSelectedCollection:false});
  await assert.rejects(provider.interpret(['Today?'], '2026-11-28'), /rate limiting/);
  await assert.rejects(provider.interpret([key], '2026-11-28'), /only in Settings/);
  await provider.saveKey('');
  await assert.rejects(provider.interpret(['Today?'], '2026-11-28'), /Add your OpenRouter key/);
  assert.equal(requests, 3);
});
