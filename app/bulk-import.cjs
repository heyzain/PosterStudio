'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {fieldValue, label, text} = require('./destinations.cjs');
const {validateImageBytes} = require('./storage.cjs');
const {assetMime} = require('./workspace.cjs');

const MB = 1024 * 1024;
const normalize = value => value.trim().toLowerCase();
const unquotedCell = /[^",\r\n]*/y;
const lineBreak = /\r\n|\n|\r/g;

function parseCsv(content) {
  const records = [];
  let values = [], offset = 0, line = 1, startLine = 1;
  while (offset < content.length) {
    const start = offset;
    if (content[offset] === '"') {
      let end = content.indexOf('"',offset + 1);
      while (end >= 0 && content[end + 1] === '"') end = content.indexOf('"',end + 2);
      if (end < 0) throw new Error('Unclosed CSV quote on line ' + line + '.');
      const raw = content.slice(start + 1,end);
      for (const _ of raw.matchAll(lineBreak)) line++;
      values.push(raw.replaceAll('""','"'));
      offset = end + 1;
    } else {
      unquotedCell.lastIndex = offset;
      values.push(unquotedCell.exec(content)[0]);
      offset = unquotedCell.lastIndex;
    }
    const separator = content[offset++];
    if (separator === ',') {
      if (values.length >= 300) throw new Error('The CSV can contain up to 300 columns.');
      if (offset < content.length) continue;
      values.push('');
    } else if (separator === '\r' || separator === '\n') {
      if (separator === '\r' && content[offset] === '\n') offset++;
      line++;
    } else if (separator !== undefined) {
      throw new Error('Invalid CSV quoting on line ' + line + '.');
    }
    if (values.some(value => value.trim())) records.push({line:startLine, values});
    if (records.length > 501) throw new Error('Import up to 500 posts per CSV.');
    values = [];
    startLine = line;
  }
  const header = records.shift()?.values.map(value => value.trim());
  if (!header || header.some(value => !value) || header.length > 300) {
    throw new Error('Start the CSV with a header row. Give each column a name.');
  }
  return {header, records};
}

async function readBounded(file, limit, reserve = () => {}) {
  if (!(await fs.stat(file)).isFile()) throw new Error('Choose a regular file.');
  const handle = await fs.open(file,'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || !info.size || info.size > limit) {
      throw new Error('Choose a nonempty file up to ' + limit / MB + ' MB.');
    }
    reserve(info.size);
    const bytes = Buffer.allocUnsafe(info.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const {bytesRead} = await handle.read(bytes,length,bytes.length - length,length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== info.size) throw new Error('The file changed while reading it.');
    return bytes.subarray(0,length);
  } finally {
    await handle.close();
  }
}

async function readCsv(file) {
  const bytes = await readBounded(file,16 * MB);
  let content;
  try { content = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { throw new Error('Save the spreadsheet as CSV UTF-8.'); }
  return parseCsv(content);
}

function importColumns(destinations) {
  const columns = [
    {key:'title', label:'Post title', aliases:['Title']},
    {key:'artwork', label:'Shared image', aliases:['Image', 'Image path', 'Shared image path', 'Artwork']},
    {key:'master', label:'Master text'},
    {key:'notes', label:'Notes'},
    {key:'destinations', label:'Destinations'},
  ];
  const groups = [];
  const names = new Set();
  for (const destination of destinations.filter(entry => entry.enabled)) {
    let name = destination.name, suffix = 2;
    while (names.has(normalize(name))) name = destination.name + ' (' + suffix++ + ')';
    names.add(normalize(name));
    groups.push({id:destination.id, name, fields:destination.fields.filter(field => !field.archived)});
  }
  const used = new Set(columns.map(column => normalize(column.label)));
  for (const group of groups) {
    for (const field of group.fields) {
      const header = group.name + ' ' + field.label;
      const label = /^[=+@-]/.test(header) ? 'Destination ' + header : header;
      let unique = label, suffix = 2;
      while (used.has(normalize(unique))) unique = label + ' (' + suffix++ + ')';
      used.add(normalize(unique));
      columns.push({key:field.id, label:unique, destinationId:group.id});
    }
  }
  return {columns, groups};
}

function templateCsv(destinations) {
  const {columns} = importColumns(destinations);
  return '\uFEFF' + columns.map(({label}) => '"' + label.replaceAll('"','""') + '"').join(',') + '\r\n';
}

function defaultMapping(columns, header) {
  return Object.fromEntries(columns.map(column => {
    const labels = [column.label,...(column.aliases ?? [])].map(normalize);
    for (const label of labels) {
      const index = header.findIndex(value => normalize(value) === label);
      if (index >= 0 && index === header.findLastIndex(value => normalize(value) === label)) return [column.key,index];
    }
    return [column.key,-1];
  }));
}

function localAssetPath(root, value) {
  if (/[\x00-\x1F]/.test(value) || /^[\\/]{2}/.test(value) || /^(?![a-z]:[\\/]).+:/i.test(value) ||
      (process.platform === 'win32' && /[:*?<>|"]/.test(value.replace(/^[a-z]:/i,'')))) {
    throw new Error('Use a local file path.');
  }
  const filename = value.replace(/[\\/]/g,path.sep);
  if (process.platform === 'win32' &&
      (/^[\\/](?![\\/])/.test(filename) || filename.split(/[\\/]/).some(part => /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:[. ]|$)/i.test(part)))) {
    throw new Error('Use a local file path.');
  }
  if (process.platform !== 'win32' && /^[a-z]:/i.test(filename)) throw new Error('Use a path from this computer.');
  const absolute = path.isAbsolute(filename);
  const file = path.resolve(root,filename);
  if (!absolute && outside(root,file)) throw new Error('Relative paths must stay inside the images folder.');
  return {file, absolute};
}

function outside(root, file) {
  const relative = path.relative(root,file);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

function convertField(field, raw) {
  if (field.type === 'tags') return raw.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
  if (field.type === 'checkbox') {
    if (/^(true|yes|1)$/i.test(raw)) return true;
    if (/^(false|no|0)$/i.test(raw)) return false;
    throw new Error('Enter yes or no.');
  }
  if (field.type === 'number') return Number(raw);
  if (field.type === 'select') {
    const options = field.options.filter(option => !option.archived && normalize(option.label) === normalize(raw));
    if (options.length !== 1) throw new Error('Use the label of an available option.');
    return options[0].id;
  }
  return ['text','long'].includes(field.type) ? raw : raw.trim();
}

async function previewCsv(store, session, mapping, selected) {
  const {csv, columns, groups, collection, root, staged} = session;
  if (!mapping || !Array.isArray(selected) || selected.some(id => !groups.some(group => group.id === id))) {
    throw new Error('Choose valid columns and destinations.');
  }
  const indexes = new Map(columns.map(({key}) => [key,mapping[key] ?? -1]));
  if ([...indexes.values()].some(index => !Number.isInteger(index) || index < -1 || index >= csv.header.length) ||
      indexes.get('title') < 0) throw new Error('Map a CSV column to Post title.');
  if (!csv.records.length) throw new Error('Add at least one post row beneath the CSV headers.');
  if (/^[\\/]{2}/.test(root)) throw new Error('Choose a local folder for relative paths.');
  const directory = await fs.realpath(root);
  if (/^[\\/]{2}/.test(directory)) throw new Error('Choose a local folder for relative paths.');
  let bytesUsed = 0;
  const files = new Map();
  const resolvedPaths = new Map();
  async function asset(raw, kind) {
    const value = raw.trim().replace(/^"([^"]+)"$/,'$1');
    const {file, absolute} = localAssetPath(directory,value);
    const ext = path.extname(file).slice(1).toLowerCase().replace(/^jpeg$/,'jpg');
    const image = Object.hasOwn(assetMime,ext);
    if (kind === 'image' && !image) throw new Error('Choose a PNG, JPG, or WebP image.');
    if (!resolvedPaths.has(file)) {
      resolvedPaths.set(file,fs.realpath(file).catch(() => { throw new Error('File not found.'); }));
    }
    const resolved = await resolvedPaths.get(file);
    if (/^[\\/]{2}/.test(resolved) || (!absolute && outside(directory,resolved))) {
      throw new Error('Choose a local file inside the images folder or enter a full local path.');
    }
    if (!files.has(resolved)) {
      files.set(resolved,(async () => {
        const bytes = await readBounded(resolved,30 * MB,size => {
          if (bytesUsed + size > 512 * MB) throw new Error('Import up to 512 MB of files per batch.');
          bytesUsed += size;
        });
        const data = image ? validateImageBytes(bytes,assetMime[ext]) : {bytes,ext:'bin'};
        const entry = await store.storeAsset(data.bytes,file,data.ext,{draft:true});
        staged.add(entry.id);
        return entry;
      })());
    }
    const entry = await files.get(resolved);
    if (kind === 'image' && !Object.hasOwn(assetMime,entry.id.split('.').at(-1))) {
      throw new Error('Choose a PNG, JPG, or WebP image.');
    }
    return entry;
  }
  const titles = new Set(collection.items.map(item => normalize(item.title)));
  const rows = [], drafts = [];
  for (const {line, values} of csv.records) {
    const read = key => values[indexes.get(key)] ?? '';
    const title = read('title').trim();
    const row = {line,title:title.slice(0,150),images:[],destinations:[],errors:[],duplicate:false};
    rows.push(row);
    if (values.length !== csv.header.length) {
      row.errors.push('Expected ' + csv.header.length + ' columns, found ' + values.length + '.');
      continue;
    }
    const draft = {title,master:read('master'),notes:read('notes'),artwork:null,records:[]};
    try {
      label(read('title'),150,'Post title');
      text(draft.master,40000,'master text');
      text(draft.notes,20000,'notes');
    } catch (error) { row.errors.push(error.message); }
    row.duplicate = titles.has(normalize(title));
    titles.add(normalize(title));
    if (read('artwork').trim()) {
      try {
        const image = await asset(read('artwork'),'image');
        draft.artwork = image.id;
        row.images.push({...image,label:'Shared'});
      } catch (error) { row.errors.push('Shared image (' + read('artwork').trim().slice(0,240) + '): ' + error.message); }
    }
    const choices = read('destinations').split(/[;|\n]/).map(normalize).filter(Boolean);
    for (const name of new Set(choices)) {
      if (!groups.some(group => normalize(group.name) === name)) row.errors.push('Unknown destination: ' + name);
    }
    for (const group of groups) {
      if (choices.length ? !choices.includes(normalize(group.name)) : !selected.includes(group.id)) continue;
      row.destinations.push(group.name);
      const record = {id:group.id,status:'draft',selected:true,values:{}};
      draft.records.push(record);
      for (const field of group.fields) {
        const raw = read(field.id);
        if (!raw.trim()) continue;
        try {
          let value;
          if (field.type !== 'file') value = convertField(field,raw);
          else if (normalize(raw) === 'shared') value = 'shared';
          else {
            value = await asset(raw,'file');
            if (Object.hasOwn(assetMime,value.id.split('.').at(-1))) {
              row.images.push({...value,label:group.name + ' ' + field.label});
            }
          }
          record.values[field.id] = fieldValue(field,value,draft.artwork);
        } catch (error) {
          const value = field.type === 'file' ? ' (' + raw.trim().slice(0,240) + ')' : '';
          row.errors.push(group.name + ' ' + field.label + value + ': ' + error.message);
        }
      }
    }
    if (!row.errors.length) drafts.push(draft);
  }
  return {rows,drafts};
}

module.exports = {readCsv, parseCsv, importColumns, templateCsv, defaultMapping, previewCsv};
