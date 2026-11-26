'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {Workspace} = require('../app/workspace.cjs');
const {parseCsv, readCsv, importColumns, templateCsv, defaultMapping, previewCsv} = require('../app/bulk-import.cjs');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/ngAAAABJRU5ErkJggg==','base64');
const quote = value => '"' + value.replaceAll('"','""') + '"';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'poster-bulk-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const store = new Workspace(path.join(root,'workspace'));
  await store.init();
  const [initial] = (await store.saveCollection(null,{name:'Series'})).collections;
  await store.addDestination(initial.id,'facebook');
  await store.addDestination(initial.id,'instagram');
  await store.addDestination(initial.id,'pinterest');
  const [collection] = store.state().collections;
  return {root,store,collection};
}

test('CSV preserves quoted commas, newlines, quotes, empty fields and source lines', () => {
  const {header,records} = parseCsv('Title,Caption,Image\r\nOne,"Hi, ""there""\r\nNext",\r\n\r\nTwo,,');
  assert.deepEqual(header,['Title','Caption','Image']);
  assert.deepEqual(records,[
    {line:2,values:['One','Hi, "there"\r\nNext','']},
    {line:5,values:['Two','','']},
  ]);
  assert.throws(() => parseCsv('Title\n"abc'),/Unclosed CSV quote on line 2/);
  assert.throws(() => parseCsv('Title\n"abc"def'),/Invalid CSV quoting on line 2/);
});

test('bulk import resolves Windows-style relative paths and full paths, maps platform values and saves a single batch', async t => {
  const {root,store,collection} = await fixture(t);
  const assets = path.join(root,'Artwork files');
  await fs.mkdir(assets);
  const shared = path.join(assets,'shared.png');
  const pin = path.join(assets,'pin, vertical.png');
  await fs.writeFile(shared,png);
  await fs.writeFile(pin,png);
  const csvFile = path.join(root,'posts.csv');
  await fs.writeFile(csvFile,'\uFEFFPost title,Image path,Facebook Caption,Instagram Hashtags,Pinterest Image,Destinations\r\n' +
    ['One','Artwork files\\shared.png','First, caption\nSecond line','art, daily',pin,'Facebook; Instagram; Pinterest'].map(quote).join(',') + '\r\n' +
    ['Two',quote(shared),'','','','Pinterest'].map(quote).join(','));
  const {columns,groups} = importColumns(collection.destinations);
  const csv = await readCsv(csvFile);
  const session = {root,collection,columns,groups,csv,staged:new Set()};
  const {rows,drafts} = await previewCsv(store,session,defaultMapping(columns,csv.header),[]);
  assert.deepEqual(rows.map(row => row.errors),[[],[]]);
  assert.equal(session.staged.size,2);
  assert.equal(rows[0].images.length,2);
  assert.equal(drafts[0].artwork,drafts[1].artwork);
  assert.equal(store.state().collections[0].items.length,0);
  await fs.unlink(shared);
  await fs.unlink(pin);
  const {collections:[saved]} = await store.importDrafts(collection.id,drafts,collection.destinations);
  const [two,one] = saved.items;
  assert.deepEqual([one,two].map(item => [item.number,item.title,item.stage]),[[1,'One','draft'],[2,'Two','draft']]);
  const [facebook,instagram,pinterest] = collection.destinations;
  assert.equal(one.records[0].values[facebook.fields[0].id],'First, caption\nSecond line');
  assert.deepEqual(one.records[1].values[instagram.fields[1].id],['art','daily']);
  assert.equal(two.records[0].values[pinterest.fields.find(field => field.type === 'file').id],'shared');
  assert.deepEqual(await fs.readFile(await store.assetFile(one.artwork)),png);
  assert.deepEqual(await fs.readdir(store.staging),[]);
});

test('preview pinpoints missing files and rejected paths, and failed batches consume no post numbers', async t => {
  const {root,store,collection} = await fixture(t);
  const {columns,groups} = importColumns(collection.destinations);
  const template = templateCsv(collection.destinations);
  const {header} = parseCsv(template.slice(1));
  assert.deepEqual(header,columns.map(column => column.label));
  const csv = parseCsv('Title,Image\nMissing,missing.png\nOutside,../outside.png\nURL,https://example.com/image.png\nFine,');
  const session = {root,collection,columns,groups,csv,staged:new Set()};
  const {rows,drafts} = await previewCsv(store,session,defaultMapping(columns,csv.header),[]);
  assert.match(rows[0].errors[0],/missing\.png.*File not found/);
  assert.match(rows[1].errors[0],/Relative paths must stay inside/);
  assert.match(rows[2].errors[0],/Use a local file path/);
  await assert.rejects(store.importDrafts(collection.id,[...drafts,{title:'',records:[]}],collection.destinations),/required/);
  await store.changeDestination(collection.id,groups[0].id,{enabled:false});
  await assert.rejects(store.importDrafts(collection.id,drafts,collection.destinations),/destinations changed/);
  const [saved] = store.state().collections;
  assert.equal(saved.nextNumber,1);
  assert.deepEqual(saved.items,[]);
});
