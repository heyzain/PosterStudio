'use strict';
const {app,BrowserWindow,dialog,ipcMain,protocol,net,shell,clipboard,nativeImage} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Workspace, assetMime} = require('./workspace.cjs');
const {presets,types} = require('./destinations.cjs');
const {websiteIcon} = require('./website-icons.cjs');
const {validateImageBytes} = require('./storage.cjs');
const {createThumbnailCache} = require('./thumbnail-cache.cjs');

let mainWindow;
const page = path.join(__dirname,'workspace.html');
const customTitleBar = process.platform === 'win32';
protocol.registerSchemesAsPrivileged([{scheme:'poster-media',privileges:{standard:true,secure:true,stream:true}}]);

function createWindow() {
  mainWindow = new BrowserWindow({
    title:'Poster Studio',width:1380,height:900,minWidth:380,minHeight:590,
    backgroundColor:'#171a1c',autoHideMenuBar:true,show:false,
    ...(customTitleBar ? {titleBarStyle:'hidden'} : {}),
    icon:path.join(__dirname,'../assets',process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences:{
      preload:path.join(__dirname,'workspace-preload.cjs'),
      contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,
    },
  });
  const contents = mainWindow.webContents;
  if (customTitleBar) {
    const window = mainWindow;
    const publishMaximized = () => contents.send('window:maximized',window.isMaximized());
    window.on('maximize',publishMaximized);
    window.on('unmaximize',publishMaximized);
    contents.on('did-finish-load',publishMaximized);
  }
  contents.setWindowOpenHandler(() => ({action:'deny'}));
  contents.on('will-navigate',event => event.preventDefault());
  mainWindow.once('ready-to-show',() => mainWindow.show());
  return mainWindow.loadFile(page);
}

function decodeIcon(bytes, allowJpeg = false) {
  const candidates = [bytes];
  if (bytes.length >= 6 && bytes.readUInt32LE() === 0x00010000) {
    const count = Math.min(bytes.readUInt16LE(4),Math.floor((bytes.length - 6) / 16),24);
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const length = bytes.readUInt32LE(entry + 8);
      const offset = bytes.readUInt32LE(entry + 12);
      if (offset + length <= bytes.length) candidates.push(bytes.subarray(offset,offset + length));
    }
  }
  for (const candidate of candidates) {
    const png = candidate.length >= 24 && candidate.subarray(0,8).toString('hex') === '89504e470d0a1a0a';
    const jpeg = candidate.length >= 3 && candidate.subarray(0,3).toString('hex') === 'ffd8ff';
    if (!png && !(allowJpeg && jpeg)) continue;
    if (png && (candidate.readUInt32BE(16) > 512 || candidate.readUInt32BE(20) > 512)) continue;
    const image = nativeImage.createFromBuffer(candidate);
    const {width,height} = image.getSize();
    if (!width || !height || width > 512 || height > 512) continue;
    return (Math.max(width,height) > 96 ? image.resize(width >= height ? {width:96} : {height:96}) : image).toPNG();
  }
  return null;
}

function registerWorkspace(store) {
  const handlers = {
    windowControl:action => {
      if (!customTitleBar) return;
      switch (action) {
        case 'minimize': mainWindow.minimize(); break;
        case 'toggle-maximize':
          if (mainWindow.isMaximized()) mainWindow.unmaximize();
          else mainWindow.maximize();
          break;
        case 'close': mainWindow.close(); break;
        default: throw new Error('Invalid window control.');
      }
    },
    getState:() => ({...store.state(),presets,types}),
    saveCollection:(...args) => store.saveCollection(...args),
    archiveCollection:(...args) => store.archiveCollection(...args),
    addDestination:(...args) => store.addDestination(...args),
    changeDestination:(...args) => store.changeDestination(...args),
    changeField:(...args) => store.changeField(...args),
    saveItem:(...args) => store.saveItem(...args),
    setPublication:(...args) => store.setPublication(...args),
    archiveItem:(...args) => store.archiveItem(...args),
    openStorage:async () => {
      const error = await shell.openPath(store.root);
      if (error) throw new Error(error);
    },
    showArtwork:async (collectionId, itemId, assetId) => {
      shell.showItemInFolder(await store.revealArtwork(collectionId, itemId, assetId));
    },
    copy:value => {
      if (typeof value !== 'string' || value.length > 100000) throw new Error('Invalid clipboard text.');
      clipboard.writeText(value);
    },
    pickAsset:async kind => {
      if (!['image','icon','file'].includes(kind)) throw new Error('Invalid file picker.');
      const options = {
        title:kind === 'icon' ? 'Choose an icon' : kind === 'image' ? 'Choose an image' : 'Choose a file',
        properties:['openFile','dontAddToRecent'],
      };
      if (kind !== 'file') options.filters = [{name:'Images',extensions:kind === 'icon' ? ['png','jpg','jpeg','ico'] : ['png','jpg','jpeg','webp']}];
      const result = await dialog.showOpenDialog(mainWindow,options);
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      const limit = kind === 'icon' ? 512 * 1024 : 30 * 1024 * 1024;
      const info = await fs.stat(file);
      if (!info.isFile() || info.size > limit) throw new Error(kind === 'icon' ? 'Choose an icon up to 512 KB.' : 'Choose a file up to 30 MB.');
      const bytes = await fs.readFile(file);
      if (bytes.length > limit) throw new Error('The selected file is too large.');
      if (kind === 'file') return store.storeAsset(bytes,file,'bin');
      if (kind === 'icon') {
        const icon = decodeIcon(bytes,true);
        if (!icon) throw new Error('Choose a PNG, JPG, or ICO icon up to 512 × 512 pixels.');
        return store.storeAsset(icon,file,'png');
      }
      const ext = path.extname(file).slice(1).toLowerCase().replace(/^jpeg$/,'jpg');
      if (!Object.hasOwn(assetMime,ext)) throw new Error('Choose a PNG, JPG, or WebP image.');
      const image = validateImageBytes(bytes,assetMime[ext]);
      return store.storeAsset(image.bytes,file,image.ext);
    },
    fetchIcon:async value => {
      const icon = await websiteIcon(value,decodeIcon).catch(() => null);
      return icon ? store.storeAsset(icon,'Website icon','png') : null;
    },
    exportCollection:async (collectionId,itemId) => {
      const result = await dialog.showOpenDialog(mainWindow,{title:'Choose an export destination',properties:['openDirectory','createDirectory']});
      if (result.canceled || !result.filePaths[0]) return null;
      return store.exportCollection(result.filePaths[0],collectionId,itemId);
    },
  };
  for (const [name,handler] of Object.entries(handlers)) {
    ipcMain.handle('workspace:' + name,(event,...args) => {
      if (event.sender !== mainWindow?.webContents || event.senderFrame?.url !== pathToFileURL(page).href) {
        throw new Error('Invalid workspace request.');
      }
      return handler(...args);
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance',() => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(async () => {
    const store = new Workspace(path.join(app.getPath('userData'),'workspace-v2'));
    await store.init();
    const thumbnail = createThumbnailCache(nativeImage);
    protocol.handle('poster-media',async request => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'workspace' || !Object.hasOwn(assetMime,url.pathname.split('.').at(-1))) throw new Error('Invalid image.');
        const file = await store.assetFile(url.pathname.slice(1));
        const variant = url.searchParams.get('thumbnail');
        if (variant) {
          const result = await thumbnail(file,variant).catch(() => null);
          if (result) return new Response(result.bytes,{headers:{'content-type':result.type}});
        }
        return await net.fetch(pathToFileURL(file).href);
      } catch { return new Response('Not found',{status:404}); }
    });
    registerWorkspace(store);
    await createWindow();
    app.on('activate',() => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
    });
  }).catch(error => {
    dialog.showErrorBox('Poster Studio could not start',error.message);
    app.quit();
  });
}
app.on('window-all-closed',() => { if (process.platform !== 'darwin') app.quit(); });
