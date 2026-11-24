'use strict';
// Pure Node storage module: easy to test without an Electron installation.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const META_NAME = '.poster-studio.json';
const EXTENSIONS = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' };
const MIME_BY_EXT = {png:'image/png', jpg:'image/jpeg', webp:'image/webp'};
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const fields = ['title','coverText','theme','idea','status','fbCaption','pinTitle','pinDescription','pinTags','fbDate','pinDate'];
const limits = {title:100, coverText:300, theme:30, idea:20000, status:25, fbCaption:40000, pinTitle:1000, pinDescription:40000, pinTags:10000, fbDate:10, pinDate:10};
const artworkName = /^(?:artwork|pinterest|facebook|instagram)\.(png|jpg|webp)$/;
const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value+'T12:00:00').getTime()));
const folderName = id => String(id).padStart(3,'0');
const imageUrl = (id, filename, modified) => `poster-media://assets/${id}/${filename}?v=${modified||0}`;

async function writeJSONAtomic(file, obj) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try { await fs.writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', {encoding:'utf8',flag:'wx'}); await fs.rename(tmp,file); }
  catch(e) { await fs.rm(tmp,{force:true}).catch(()=>{}); throw e; }
}
async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file,'utf8')); }
  catch(e) { if(e.code === 'ENOENT') return fallback; throw new Error(`Unable to read ${path.basename(file)}: ${e.message}`); }
}
function cleanPoster(p) {
  if (!p || typeof p!=='object' || !Number.isSafeInteger(p.id) || p.id<1 || p.id>9999999) throw new Error('Invalid poster number.');
  const o={id:p.id};
  for(const f of fields){ const val=p[f]==null?'':p[f]; if(typeof val!=='string'||val.length>limits[f]) throw new Error(`Invalid ${f} for poster #${p.id}.`); o[f]=val; }
  if(!['draft','ready','published'].includes(o.status)) throw new Error('Invalid creative status.');
  if(!validDate(o.fbDate)||!validDate(o.pinDate)) throw new Error('Invalid publishing date.');
  o.fbPosted=p.fbPosted===true; o.pinPosted=p.pinPosted===true;
  return o;
}
function readPoster(info) {
  if(Object.hasOwn(info,'fbPosted')) return cleanPoster(info);
  const wasPosted=info.igPosted===true;
  return cleanPoster({
    ...info,
    fbCaption:info.igCaption,
    fbDate:wasPosted?'':info.igDate,
    status:wasPosted&&info.status==='published'?'ready':info.status,
  });
}
async function findArtwork(dir, info) {
  const candidates=Object.hasOwn(info,'artwork')
    ? [info.artwork]
    : [info.pinImage, info.fbImage, info.igImage];
  for(const filename of candidates){
    if(typeof filename!=='string'||!artworkName.test(filename))continue;
    const stats=await fs.stat(path.join(dir,filename)).catch(()=>null);
    if(stats?.isFile())return {filename,mtime:stats.mtimeMs};
  }
  return null;
}
function parseImageInput(input) {
  if(typeof input!=='string'||!input.startsWith('data:')) return null;
  const m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if(!m) throw new Error('Images must be PNG, JPG, or WebP.');
  if(m[2].length>Math.ceil(MAX_IMAGE_BYTES*4/3)+4) throw new Error('Artwork is too large (30 MB maximum).');
  return validateImageBytes(Buffer.from(m[2],'base64'),m[1]);
}
function validateImageBytes(bytes,mime) {
  if(bytes.length>MAX_IMAGE_BYTES||bytes.length===0) throw new Error('Artwork is too large or empty.');
  const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
     mime==='image/jpeg'?bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:
     bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid) throw new Error('Selected image format does not match its contents.');
  return {bytes,ext:EXTENSIONS[mime]};
}
class PosterStore {
  constructor(settingsPath){this.settingsPath=settingsPath;this.folder=null;this.nextId=1;}
  async init(){
    const settings=await readJSON(this.settingsPath,{});
    if(settings.collectionFolder && typeof settings.collectionFolder==='string') {
      try {const stats=await fs.stat(settings.collectionFolder); if(stats.isDirectory()) await this.useFolder(settings.collectionFolder,false); }
      catch {} // A removed/disconnected drive must never wipe the saved preference.
    }
    return this.getState();
  }
  async useFolder(folder,remember=true){
    const resolved=path.resolve(folder);
    const stats=await fs.stat(resolved);
    if(!stats.isDirectory()) throw new Error('Please select a folder.');
    const newPostersDir=path.join(resolved,'Posters');
    await fs.mkdir(newPostersDir,{recursive:true});
    const manifestFile=path.join(resolved,META_NAME);
    const meta=await readJSON(manifestFile,null);
    let initialNextId=1;
    if(meta===null) {
      // Respect existing numbered directories even if they were manually created.
      const entries=await fs.readdir(newPostersDir,{withFileTypes:true});
      for(const entry of entries)if(entry.isDirectory() && /^\d{3,7}$/.test(entry.name))initialNextId=Math.max(initialNextId,Number(entry.name)+1);
      await writeJSONAtomic(manifestFile,{schemaVersion:1,nextId:initialNextId,order:[]});
    }
    else if(meta.schemaVersion!==1) throw new Error('This collection uses an unsupported data format.');
    this.folder=resolved;
    this.nextId=meta?.nextId||initialNextId;
    if(remember) await writeJSONAtomic(this.settingsPath,{collectionFolder:resolved});
    return this.getState();
  }
  requireFolder(){if(!this.folder) throw new Error('Choose a collection folder first.');return this.folder;}
  posterFolder(id){if(!Number.isSafeInteger(id)||id<1)throw new Error('Invalid poster ID.');return path.join(this.requireFolder(),'Posters',folderName(id));}
  async getState(){
    if(!this.folder) return {folder:null,posters:[],nextId:1};
    const meta=await readJSON(path.join(this.folder,META_NAME),{schemaVersion:1,nextId:this.nextId,order:[]});
    const parent=path.join(this.folder,'Posters');
    const entries=await fs.readdir(parent,{withFileTypes:true});
    const result=[];
    for(const entry of entries){
      if(!entry.isDirectory()||!/^\d{3,7}$/.test(entry.name))continue;
      const dir=path.join(parent,entry.name);
      const info=await readJSON(path.join(dir,'poster.json'),null);
      if(!info)continue;
      const p=readPoster(info);
      if(String(p.id).padStart(3,'0')!==entry.name) continue;
      const artwork=await findArtwork(dir,info);
      p.artwork=artwork?imageUrl(p.id,artwork.filename,artwork.mtime):'';
      result.push(p);
    }
    const order=Array.isArray(meta.order)?meta.order:[];
    result.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return(ai===-1?1e9:ai)-(bi===-1?1e9:bi) || b.id-a.id;});
    this.nextId=Math.max(Number(meta.nextId)||1,1,...result.map(x=>x.id+1));
    return {folder:this.folder,posters:result,nextId:this.nextId};
  }
  async saveAll(posters) {
    this.requireFolder();
    if(!Array.isArray(posters)||posters.length>10000) throw new Error('Invalid poster collection.');
    const seen=new Set(), cleaned=[];
    for(const input of posters){const p=cleanPoster(input);if(seen.has(p.id))throw new Error('Duplicate poster number.');seen.add(p.id);cleaned.push({p,input});}
    const current=await this.getState();
    const oldIds=new Set(current.posters.map(p=>p.id));
    const newIds=new Set(cleaned.map(x=>x.p.id));
    for(const {p,input} of cleaned){
      const dir=this.posterFolder(p.id);
      await fs.mkdir(dir,{recursive:true});
      const existing=await readJSON(path.join(dir,'poster.json'),{});
      if(existing.igPosted===true){
        p.igPosted=true;
        p.igDate=existing.igDate||'';
      }
      const previous=(await findArtwork(dir,existing))?.filename||'';
      const decoded=parseImageInput(input.artwork);
      p.artwork=input.removeArtwork===true?'':previous;
      if(decoded){
        p.artwork=`artwork.${decoded.ext}`;
        const target=path.join(dir,p.artwork);
        const temp=`${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
        try {
          await fs.writeFile(temp,decoded.bytes,{flag:'wx'});
          await fs.rename(temp,target);
        } catch(e) {
          await fs.rm(temp,{force:true}).catch(()=>{});
          throw e;
        }
      }
      await writeJSONAtomic(path.join(dir,'poster.json'),p);
      if(previous.startsWith('artwork.')&&previous!==p.artwork) await fs.rm(path.join(dir,previous),{force:true});
    }
    // Safe soft delete. Nothing is irrevocably lost: folder moves to .PosterStudioTrash.
    for(const id of oldIds){
      if(newIds.has(id))continue;
      const source=this.posterFolder(id);
      const trash=path.join(this.folder,'.PosterStudioTrash');
      await fs.mkdir(trash,{recursive:true});
      await fs.rename(source,path.join(trash,`${folderName(id)}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`));
    }
    this.nextId=Math.max(this.nextId,...cleaned.map(x=>x.p.id+1),1);
    await writeJSONAtomic(path.join(this.folder,META_NAME),{schemaVersion:1,nextId:this.nextId,order:cleaned.map(x=>x.p.id)});
    return this.getState();
  }
  async imageFile(url){
    this.requireFolder();
    const u=new URL(url);
    if(u.protocol!=='poster-media:'||u.hostname!=='assets')throw new Error('Invalid artwork address.');
    const match=/^\/(\d{1,7})\/([^/]+)$/.exec(decodeURIComponent(u.pathname));
    const image=match&&artworkName.exec(match[2]);
    if(!image)throw new Error('Invalid artwork address.');
    const dir=this.posterFolder(Number(match[1]));
    const info=await readJSON(path.join(dir,'poster.json'),{});
    const artwork=await findArtwork(dir,info);
    const [filename,ext]=image;
    if(artwork?.filename!==filename)throw new Error('Image not registered for this poster.');
    return {file:path.join(dir,filename),mime:MIME_BY_EXT[ext]};
  }
}
module.exports={PosterStore,cleanPoster,parseImageInput,validateImageBytes};
