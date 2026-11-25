'use strict';
const fs = require('node:fs/promises');
const {COPYFILE_EXCL} = require('node:fs').constants;
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const {idPattern, assetPattern, label, text, statuses, dateTime, webUrl, fieldValue, cleanField, createDestination} = require('./destinations.cjs');
const {readCollectionBackup} = require('./collection-backup.cjs');

const empty = () => ({version:2, collections:[], websites:[]});
const assetMime = {png:'image/png', jpg:'image/jpeg', webp:'image/webp'};
const validAsset = id => typeof id === 'string' && assetPattern.test(id) && idPattern.test(id.split('.')[0]);

function assetReferences({collections, websites}) {
  const ids = new Set();
  const add = id => { if (validAsset(id)) ids.add(id); };
  for (const site of websites) add(site.icon);
  for (const collection of collections) {
    add(collection.cover);
    add(collection.icon);
    for (const destination of collection.destinations) {
      add(destination.icon);
      for (const field of destination.fields) add(field.defaultValue?.id);
    }
    for (const item of collection.items) {
      add(item.artwork);
      for (const record of item.records) {
        for (const value of Object.values(record.values ?? {})) add(value?.id);
      }
    }
  }
  return ids;
}
function find(records, id, name) {
  const record = records.find(entry => entry.id === id);
  if (!record) throw new Error(name + ' was not found.');
  return record;
}
async function writeJSON(file, data) {
  const staged = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(staged, JSON.stringify(data, null, 2) + '\n', {flag:'wx'});
    await fs.rename(staged, file);
  } finally { await fs.rm(staged, {force:true}).catch(() => {}); }
}

function folderLabel(value, fallback) {
  return typeof value === 'string'
    ? value.replace(/[^\p{L}\p{N}\p{M} &,_()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim() || fallback
    : fallback;
}

async function managedDirectory(parent, name) {
  if (await fs.realpath(parent) !== parent) throw new Error('Invalid collection folder.');
  const directory = path.join(parent, name);
  await fs.mkdir(directory).catch(error => { if (error.code !== 'EEXIST') throw error; });
  if (!(await fs.lstat(directory)).isDirectory() || await fs.realpath(directory) !== directory) {
    throw new Error('Invalid collection folder.');
  }
  return directory;
}

async function saveArtworkCopy(source, folder, label) {
  const extension = path.extname(source);
  for (let version = 1; ; version++) {
    const target = path.join(folder, label + (version === 1 ? '' : ` (${version})`) + extension);
    try {
      await fs.copyFile(source, target, COPYFILE_EXCL);
      return target;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = await fs.lstat(target);
      if (existing.isFile() && await fs.realpath(target) === target && existing.size === (await fs.stat(source)).size) {
        const [original, copy] = await Promise.all([fs.readFile(source), fs.readFile(target)]);
        if (original.equals(copy)) return target;
      }
    }
  }
}

class Workspace {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, 'workspace.json');
    this.assets = path.join(root, 'assets');
    this.pending = Promise.resolve();
    this.data = empty();
    this.stagedIds = new Set();
  }

  async init() {
    await fs.mkdir(this.assets, {recursive:true});
    this.root = await fs.realpath(this.root);
    this.file = path.join(this.root, 'workspace.json');
    this.assets = path.join(this.root, 'assets');
    let data;
    try { data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; data = empty(); }
    if (data?.version !== 2 || !Array.isArray(data.collections) || !Array.isArray(data.websites) ||
        !data.collections.every(c => c && idPattern.test(c.id) && typeof c.name === 'string' &&
          Number.isSafeInteger(c.nextNumber) && Array.isArray(c.destinations) && Array.isArray(c.items) &&
          c.destinations.every(d => d && idPattern.test(d.id) && Array.isArray(d.fields)) &&
          c.items.every(i => i && idPattern.test(i.id) && Number.isSafeInteger(i.number) && Array.isArray(i.records)))) {
      throw new Error('The workspace file uses an unsupported or invalid format.');
    }
    this.data = data;
    this.staging = await managedDirectory(this.root, '.draft-assets');
    const references = assetReferences(data);
    for (const entry of await fs.readdir(this.staging, {withFileTypes:true})) {
      if (entry.isFile() && validAsset(entry.name) && !references.has(entry.name)) {
        await fs.unlink(path.join(this.staging,entry.name)).catch(error => {
          if (error.code !== 'ENOENT') console.warn('Could not clear abandoned draft artwork:',error.code);
        });
      }
    }
  }

  state() { return structuredClone(this.data); }

  enqueue(operation) {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  change(mutate) {
    return this.enqueue(async () => {
      const draft = this.state();
      await mutate(draft);
      const promotions = this.stagedIds.size ? [...assetReferences(draft)].filter(id => this.stagedIds.has(id)) : [];
      for (const id of promotions) {
        const source = await this.assetFile(id);
        if (path.dirname(source) === this.staging) {
          if (await fs.realpath(this.assets) !== this.assets) throw new Error('Invalid asset path.');
          await fs.rename(source,path.join(this.assets,id));
        }
      }
      await writeJSON(this.file, draft);
      this.data = draft;
      for (const id of promotions) this.stagedIds.delete(id);
      return this.state();
    });
  }

  async assetFile(id) {
    if (!validAsset(id)) throw new Error('Invalid asset reference.');
    try { return await this.checkedAsset(this.assets,id); }
    catch (error) {
      if (error.code !== 'ENOENT' || !this.stagedIds.has(id)) throw error;
      // Saving can move a draft into assets while a preview is resolving it.
      try { return await this.checkedAsset(this.staging,id); }
      catch (failure) { if (failure.code !== 'ENOENT') throw failure; return this.checkedAsset(this.assets,id); }
    }
  }

  async checkedAsset(directory, id) {
    const file = path.join(directory, id);
    const info = await fs.lstat(file);
    if (!info.isFile() || await fs.realpath(directory) !== directory || await fs.realpath(file) !== file) {
      throw new Error('Invalid asset path.');
    }
    return file;
  }

  async storeAsset(bytes, name, ext, {draft = false} = {}) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 30 * 1024 * 1024 ||
        !['png','jpg','webp','bin'].includes(ext)) throw new Error('Choose a file up to 30 MB.');
    const id = randomUUID() + '.' + ext;
    const directory = draft ? this.staging : this.assets;
    if (await fs.realpath(directory) !== directory) throw new Error('Invalid asset path.');
    await fs.writeFile(path.join(directory,id), bytes, {flag:'wx'});
    if (draft) this.stagedIds.add(id);
    return {id, name:path.basename(name).slice(0,255)};
  }

  discardDraftAssets(ids) {
    if (!Array.isArray(ids)) throw new Error('Invalid draft assets.');
    return this.enqueue(async () => {
      for (const id of ids) {
        if (!this.stagedIds.has(id)) continue;
        const file = await this.assetFile(id).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (file) await fs.unlink(file);
        this.stagedIds.delete(id);
      }
    });
  }

  cleanUnusedAssets(trash) {
    return this.enqueue(async () => {
      if (await fs.realpath(this.assets) !== this.assets) throw new Error('Invalid asset path.');
      const references = assetReferences(this.data);
      const result = {moved:0, failed:0};
      for (const entry of await fs.readdir(this.assets, {withFileTypes:true})) {
        const id = entry.name;
        if (!entry.isFile() || !validAsset(id) || references.has(id) || this.stagedIds.has(id)) continue;
        try { await trash(await this.checkedAsset(this.assets,id)); result.moved++; }
        catch { result.failed++; }
      }
      return result;
    });
  }

  async imageReference(id) {
    if (id == null || id === '') return null;
    if (!Object.hasOwn(assetMime, String(id).split('.').at(-1))) throw new Error('Choose a supported image.');
    await this.assetFile(id);
    return id;
  }

  async collectionFolder(collectionId) {
    const collection = find(this.data.collections, collectionId, 'Collection');
    const collections = await managedDirectory(this.root, 'Collections');
    return managedDirectory(collections, `${folderLabel(collection.name, 'Collection')} (${collection.id.slice(0, 8)})`);
  }

  revealArtwork(collectionId, itemId, assetId) {
    return this.enqueue(async () => {
      const collection = find(this.data.collections, collectionId, 'Collection');
      const item = find(collection.items, itemId, 'Post');
      const artwork = new Map();
      if (item.artwork) artwork.set(item.artwork, 'Shared artwork');
      for (const record of item.records.filter(entry => entry.selected)) {
        const destination = collection.destinations.find(entry => entry.id === record.id);
        for (const field of destination?.fields ?? []) {
          const id = record.values?.[field.id]?.id;
          if (field.type !== 'file' || field.archived || typeof id !== 'string' ||
              !Object.hasOwn(assetMime, path.extname(id).slice(1)) || artwork.has(id)) continue;
          artwork.set(id, folderLabel(`${destination.name} - ${field.label}`, 'Destination artwork'));
        }
      }
      if (!artwork.has(assetId)) throw new Error('Save the post before showing this artwork in its folder.');
      const selectedSource = await this.assetFile(assetId);
      const collectionFolder = await this.collectionFolder(collectionId);
      const posts = await managedDirectory(collectionFolder, 'Posts');
      const folder = await managedDirectory(posts, `${String(item.number).padStart(3, '0')} - ${folderLabel(item.title, 'Post')}`);
      const selected = await saveArtworkCopy(selectedSource, folder, artwork.get(assetId));
      for (const [id, name] of artwork) {
        if (id === assetId) continue;
        const source = await this.assetFile(id).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (source) await saveArtworkCopy(source, folder, name);
      }
      return selected;
    });
  }

  saveCollection(id, input) {
    return this.change(async data => {
      const collection = id ? find(data.collections,id,'Collection') :
        {id:randomUUID(), nextNumber:1, archived:false, destinations:[], items:[]};
      collection.name = label(input.name, 100, 'Collection name');
      collection.description = text(input.description ?? '', 1000, 'collection description');
      collection.mark = ['folder','story','code','photo'].includes(input.mark) ? input.mark : 'folder';
      collection.cover = await this.imageReference(input.cover);
      if ('icon' in input) collection.icon = await this.imageReference(input.icon);
      if (!id) {
        for (const entry of input.destinations ?? []) {
          await this.appendDestination(data,collection,entry.type,entry.profile);
        }
        data.collections.push(collection);
      }
    });
  }

  archiveCollection(id, archived) {
    return this.change(data => { find(data.collections,id,'Collection').archived = archived === true; });
  }

  addDestination(collectionId, type, profile) {
    return this.change(data => this.appendDestination(data,find(data.collections,collectionId,'Collection'),type,profile));
  }

  async appendDestination(data, collection, type, profile) {
    const destination = createDestination(type);
    if (type === 'website') {
      const saved = profile?.id && find(data.websites,profile.id,'Website');
      const site = saved ?? {
        id:randomUUID(), name:label(profile?.name, 100, 'Website name'),
        url:webUrl(profile?.url), description:text(profile?.description ?? '', 500, 'website description'),
        icon:await this.imageReference(profile?.icon),
      };
      if (collection.destinations.some(d => d.profileId === site.id || (d.type === type && d.url === site.url))) {
        throw new Error('This website already exists in the collection.');
      }
      if (!saved) data.websites.push(site);
      const {name,url,description,icon} = site;
      Object.assign(destination,{profileId:site.id,name,url,description,icon});
    } else if (collection.destinations.some(d => d.type === type)) {
      throw new Error('This destination already exists in the collection.');
    }
    collection.destinations.push(destination);
  }

  changeDestination(collectionId, destinationId, input) {
    return this.change(async data => {
      const destination = find(find(data.collections,collectionId,'Collection').destinations,destinationId,'Destination');
      if ('enabled' in input) destination.enabled = input.enabled === true;
      if ('name' in input) destination.name = label(input.name, 100, 'Destination name');
      if ('icon' in input) destination.icon = await this.imageReference(input.icon);
    });
  }

  changeField(collectionId, destinationId, fieldId, action, input) {
    return this.change(data => {
      const fields = find(find(data.collections,collectionId,'Collection').destinations,destinationId,'Destination').fields;
      const previous = fieldId ? find(fields,fieldId,'Field') : null;
      switch (action) {
        case 'save': {
          const field = cleanField(input,previous);
          if (previous) fields[fields.indexOf(previous)] = field;
          else fields.push(field);
          break;
        }
        case 'archive':
          if (!previous) throw new Error('Choose a field.');
          previous.archived = true;
          break;
        case 'restore':
          if (!previous) throw new Error('Choose a field.');
          previous.archived = false;
          break;
        case 'up':
        case 'down': {
          if (!previous) throw new Error('Choose a field.');
          const index = fields.indexOf(previous);
          const target = index + (action === 'up' ? -1 : 1);
          if (fields[target]) [fields[index], fields[target]] = [fields[target], fields[index]];
          break;
        }
        default: throw new Error('Unknown field action.');
      }
    });
  }

  saveItem(collectionId, input) {
    return this.change(async data => {
      const collection = find(data.collections,collectionId,'Collection');
      if (collection.archived) throw new Error('Restore this collection before editing.');
      const existing = input.id ? find(collection.items,input.id,'Content') : null;
      if (existing?.archived) throw new Error('Restore this content before editing.');
      const now = new Date().toISOString();
      const item = {
        id:existing?.id ?? randomUUID(), number:existing?.number ?? collection.nextNumber++,
        title:label(input.title, 150, 'Content title'),
        master:text(input.master ?? '', 40000, 'master text'), notes:text(input.notes ?? '', 20000, 'notes'),
        artwork:await this.imageReference(input.artwork), created:existing?.created ?? now, updated:now,
        stage:input.stage === 'ready' ? 'ready' : 'draft', archived:false,
        records:existing?.records ?? [],
      };
      if (!Array.isArray(input.records) || input.records.length > collection.destinations.length) throw new Error('Invalid destination records.');
      const seen = new Set();
      for (const record of input.records) {
        if (seen.has(record.id)) throw new Error('Duplicate destination record.');
        seen.add(record.id);
        const destination = find(collection.destinations,record.id,'Destination');
        const previous = item.records.find(entry => entry.id === record.id);
        if (!previous?.selected && record.selected && !destination.enabled) throw new Error('This destination is disabled.');
        if (!record.selected) {
          if (previous) previous.selected = false;
          continue;
        }
        const result = await this.cleanRecord(record, previous, destination, item.artwork);
        if (previous) item.records[item.records.indexOf(previous)] = result;
        else item.records.push(result);
      }
      for (const [index, record] of item.records.entries()) {
        if (!record.selected || seen.has(record.id) || !['ready','scheduled'].includes(record.status)) continue;
        const destination = find(collection.destinations,record.id,'Destination');
        item.records[index] = await this.cleanRecord(record, record, destination, item.artwork);
      }
      if (existing) collection.items[collection.items.indexOf(existing)] = item;
      else collection.items.unshift(item);
    });
  }

  async cleanRecord(record, previous, destination, artwork, undo = false) {
    if (!statuses.includes(record.status)) throw new Error('Invalid publishing status.');
    const planned = dateTime(record.planned ?? '');
    if (record.status === 'scheduled' && !planned) throw new Error('Pick a planned date for ' + destination.name + '.');
    const published = record.status === 'published' ? dateTime(record.published ?? '') : '';
    if (record.status === 'published' && !published &&
        (previous?.status !== 'published' || previous.published || (previous.planned && !planned))) {
      throw new Error('Pick a published date for ' + destination.name + '.');
    }
    const result = {
      id:record.id, selected:true, status:record.status, planned, published,
      url:record.url ? webUrl(record.url) : '', values:{...previous?.values},
    };
    if (result.status === 'published') {
      if (previous?.status === 'published') {
        if (previous.beforePublication) result.beforePublication = previous.beforePublication;
      } else if (previous) {
        result.beforePublication = {status:previous.status, planned:previous.planned, published:previous.published};
      }
    }
    const enforceRequired = !undo && ['ready','scheduled'].includes(result.status);
    const enteringStatus = enforceRequired && result.status !== previous?.status;
    for (const field of destination.fields.filter(field => !field.archived)) {
      const value = Object.hasOwn(record.values ?? {},field.id) ? record.values[field.id] :
        Object.hasOwn(result.values,field.id) ? result.values[field.id] : field.defaultValue;
      const unchanged = Object.hasOwn(result.values,field.id) && isDeepStrictEqual(value,result.values[field.id]);
      if (unchanged && !enteringStatus && !(enforceRequired && field.required)) continue;
      const checked = fieldValue(field,value,artwork,enforceRequired);
      if (field.type === 'file' && checked?.id) await this.assetFile(checked.id);
      result.values[field.id] = checked;
    }
    return result;
  }

  setPublication(collectionId, itemId, destinationId, status, date) {
    return this.change(async data => {
      const collection = find(data.collections,collectionId,'Collection');
      const item = find(collection.items,itemId,'Content');
      const destination = find(collection.destinations,destinationId,'Destination');
      const record = item.records.find(entry => entry.id === destinationId);
      if (collection.archived || item.archived) throw new Error('This publication is unavailable.');
      const addToPlan = status === 'plan' && Boolean(date) && destination.enabled && record?.status !== 'published';
      if (!record?.selected && !addToPlan) throw new Error('This publication is unavailable.');
      if ((status === 'undo' && record.status !== 'published') ||
          (status === 'published' && record.status === 'published')) return;
      let update;
      if (status === 'plan') {
        update = {...record,id:destinationId,planned:date,status:record?.status === 'published' ? 'published' : date ? 'scheduled' : 'ready'};
      } else if (status === 'undo') {
        const previous = record.beforePublication ?? {status:record.planned ? 'scheduled' : 'ready', published:''};
        update = {...record,status:previous.status,planned:previous.planned ?? record.planned,published:previous.published};
      } else {
        update = {...record,status,published:date};
      }
      const checked = await this.cleanRecord(update,record,destination,item.artwork,status === 'undo');
      if (record) item.records[item.records.indexOf(record)] = checked;
      else item.records.push(checked);
      item.updated = new Date().toISOString();
    });
  }

  archiveItem(collectionId, itemId, archived) {
    return this.change(data => {
      const collection = find(data.collections,collectionId,'Collection');
      if (collection.archived) throw new Error('Restore this collection first.');
      find(collection.items,itemId,'Content').archived = archived === true;
    });
  }

  exportCollection(parent, collectionId, itemId) {
    return this.enqueue(() => this.writeCollectionExport(parent,collectionId,itemId));
  }

  async inspectCollectionBackup(file) {
    const {collection, assetDirectory} = await readCollectionBackup(file,validAsset);
    const assets = new Map();
    for (const id of assetReferences({collections:[collection],websites:[]})) {
      try {
        const source = await this.checkedAsset(assetDirectory,id);
        const {size} = await fs.stat(source);
        if (!size || size > 30 * 1024 * 1024) throw new Error('Invalid asset size.');
        assets.set(id,source);
      } catch {
        throw new Error('The backup has a missing or invalid file in its assets folder.');
      }
    }
    return {collection,assets};
  }

  restoreCollectionBackup(file, preview) {
    return this.enqueue(async () => {
      const {collection, assets} = await this.inspectCollectionBackup(file);
      if (!isDeepStrictEqual(collection,preview)) throw new Error('This backup changed. Choose it again to review the latest version.');
      if (await fs.realpath(this.assets) !== this.assets) throw new Error('Invalid workspace asset folder.');

      const draft = this.state();
      const copied = new Map();
      const collectionId = randomUUID();
      try {
        for (const [id, source] of assets) {
          const target = randomUUID() + path.extname(id);
          await fs.copyFile(source,path.join(this.assets,target),COPYFILE_EXCL);
          copied.set(id,target);
        }
        const destinations = new Map();
        collection.id = collectionId;
        collection.archived = false;
        const names = new Set(draft.collections.map(entry => entry.name.toLowerCase()));
        const originalName = collection.name;
        for (let copy = 1; names.has(collection.name.toLowerCase()); copy++) {
          const suffix = copy === 1 ? ' (restored)' : ` (restored ${copy})`;
          collection.name = originalName.slice(0,100 - suffix.length).trimEnd() + suffix;
        }
        collection.cover = copied.get(collection.cover) ?? null;
        collection.icon = copied.get(collection.icon) ?? null;
        for (const destination of collection.destinations) {
          const id = randomUUID();
          destinations.set(destination.id,id);
          destination.id = id;
          destination.icon = copied.get(destination.icon) ?? null;
          if (destination.type === 'website') {
            let site = draft.websites.find(entry => entry.url === destination.url);
            if (!site) {
              const {name,url,description,icon} = destination;
              site = {id:randomUUID(),name,url,description,icon};
              draft.websites.push(site);
            }
            destination.profileId = site.id;
          }
          for (const field of destination.fields) {
            if (copied.has(field.defaultValue?.id)) field.defaultValue.id = copied.get(field.defaultValue.id);
          }
        }
        for (const item of collection.items) {
          item.id = randomUUID();
          item.artwork = copied.get(item.artwork) ?? null;
          for (const record of item.records) {
            record.id = destinations.get(record.id);
            for (const value of Object.values(record.values)) {
              if (copied.has(value?.id)) value.id = copied.get(value.id);
            }
          }
        }
        draft.collections.push(collection);
        await writeJSON(this.file,draft);
      } catch (error) {
        await Promise.all([...copied.values()].map(id => fs.unlink(path.join(this.assets,id)).catch(() => {})));
        throw error;
      }
      this.data = draft;
      return {state:this.state(),collectionId};
    });
  }

  async writeCollectionExport(parent, collectionId, itemId) {
    const collection = structuredClone(find(this.data.collections,collectionId,'Collection'));
    if (itemId) collection.items = [find(collection.items,itemId,'Content')];
    const files = assetReferences({collections:[collection], websites:[]});
    const destination = await fs.realpath(parent);
    const staging = await fs.mkdtemp(path.join(destination,'.poster-studio-export-'));
    const folder = path.join(destination,'Poster-Studio-' + randomUUID());
    try {
      await fs.mkdir(path.join(staging,'assets'));
      for (const id of files) await fs.copyFile(await this.assetFile(id),path.join(staging,'assets',id));
      await writeJSON(path.join(staging,'collection.json'),{version:2, collection});
      if (await fs.realpath(staging) !== staging) throw new Error('Invalid export folder.');
      await fs.rename(staging,folder);
      return folder;
    } catch (error) {
      try {
        if (await fs.realpath(staging) !== staging) throw new Error('Invalid export folder.');
        await fs.rm(staging,{recursive:true,force:true});
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          throw new Error(`${error.message} The unfinished export could not be removed from ${staging}.`,{cause:error});
        }
      }
      throw error;
    }
  }
}
module.exports = {Workspace, assetMime};
