'use strict';
const {app,BrowserWindow,dialog,ipcMain,protocol,net,shell,clipboard,nativeImage} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const {Workspace, assetMime} = require('./workspace.cjs');
const {presets,types} = require('./destinations.cjs');
const {websiteIcon} = require('./website-icons.cjs');
const {decodeIcon} = require('./icon-image.cjs');
const {validateImageBytes} = require('./storage.cjs');
const {createThumbnailCache} = require('./thumbnail-cache.cjs');
const {readCsv, importColumns, templateCsv, defaultMapping, previewCsv} = require('./bulk-import.cjs');

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

function registerWorkspace(store) {
  let restorePreview;
  let bulkSession, bulkPending = false;
  const bulkCollection = id => {
    const collection = store.state().collections.find(entry => entry.id === id && !entry.archived);
    if (!collection) throw new Error('Open an active collection first.');
    return collection;
  };
  const clearBulkPreview = async session => {
    session.preview = undefined;
    await store.discardDraftAssets([...session.staged]);
    session.staged.clear();
  };
  const bulkOperation = async operation => {
    if (bulkPending) throw new Error('A bulk import operation is already running.');
    bulkPending = true;
    try { return await operation(); }
    finally { bulkPending = false; }
  };
  const activeBulkSession = token => {
    if (!bulkSession || bulkSession.token !== token) throw new Error('Choose a CSV first.');
    return bulkSession;
  };
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
    saveBulkTemplate:async collectionId => {
      const {destinations} = bulkCollection(collectionId);
      const result = await dialog.showSaveDialog(mainWindow,{title:'Save bulk post template',defaultPath:'poster-studio-posts.csv',
        filters:[{name:'CSV',extensions:['csv']}]});
      if (result.canceled || !result.filePath) return false;
      await fs.writeFile(result.filePath,templateCsv(destinations),'utf8');
      return true;
    },
    chooseBulkCsv:collectionId => bulkOperation(async () => {
      const collection = bulkCollection(collectionId);
      const result = await dialog.showOpenDialog(mainWindow,{title:'Choose a post CSV',
        properties:['openFile','dontAddToRecent'],filters:[{name:'CSV UTF-8',extensions:['csv']}]});
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      const csv = await readCsv(file);
      if (bulkSession) await clearBulkPreview(bulkSession);
      const {columns,groups} = importColumns(collection.destinations);
      const token = randomUUID(), root = path.dirname(file);
      bulkSession = {token,collection,csv,columns,groups,root,staged:new Set()};
      return {token,name:path.basename(file),root,headers:csv.header,columns,
        groups:groups.map(({id,name}) => ({id,name})),mapping:defaultMapping(columns,csv.header)};
    }),
    chooseBulkFolder:token => bulkOperation(async () => {
      const session = activeBulkSession(token);
      const result = await dialog.showOpenDialog(mainWindow,{title:'Choose the folder for relative image paths',
        defaultPath:session.root,properties:['openDirectory','dontAddToRecent']});
      const root = result.filePaths[0];
      if (result.canceled || !root) return null;
      await clearBulkPreview(session);
      session.root = root;
      return root;
    }),
    previewBulkCsv:(token,mapping,selected) => bulkOperation(async () => {
      const session = activeBulkSession(token);
      await clearBulkPreview(session);
      try {
        const {rows,drafts} = await previewCsv(store,session,mapping,selected);
        session.preview = {drafts,valid:drafts.length === rows.length};
        return {rows,valid:session.preview.valid};
      } catch (error) {
        await clearBulkPreview(session);
        throw error;
      }
    }),
    importBulkCsv:token => bulkOperation(async () => {
      const session = activeBulkSession(token);
      if (!session.preview?.valid || !session.preview.drafts.length) throw new Error('Preview a CSV with no row errors first.');
      const {collection,preview} = session;
      const result = await store.importDrafts(collection.id,preview.drafts,collection.destinations);
      bulkSession = undefined;
      return {state:result,count:preview.drafts.length};
    }),
    closeBulkCsv:token => bulkOperation(async () => {
      if (bulkSession?.token !== token) return;
      await clearBulkPreview(bulkSession);
      bulkSession = undefined;
    }),
    setPublication:(...args) => store.setPublication(...args),
    archiveItem:(...args) => store.archiveItem(...args),
    openStorage:async collectionId => {
      const error = await shell.openPath(await store.collectionFolder(collectionId));
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
      if (kind === 'file') return store.storeAsset(bytes,file,'bin',{draft:true});
      if (kind === 'icon') {
        const icon = decodeIcon(bytes,nativeImage,true);
        if (!icon) throw new Error('Choose a PNG, JPG, or ICO icon up to 512 × 512 pixels.');
        return store.storeAsset(icon,file,'png',{draft:true});
      }
      const ext = path.extname(file).slice(1).toLowerCase().replace(/^jpeg$/,'jpg');
      if (!Object.hasOwn(assetMime,ext)) throw new Error('Choose a PNG, JPG, or WebP image.');
      const image = validateImageBytes(bytes,assetMime[ext]);
      return store.storeAsset(image.bytes,file,image.ext,{draft:true});
    },
    fetchIcon:async value => {
      const icon = await websiteIcon(value,bytes => decodeIcon(bytes,nativeImage)).catch(() => null);
      return icon ? store.storeAsset(icon,'Website icon','png',{draft:true}) : null;
    },
    discardDraftAssets:ids => store.discardDraftAssets(ids),
    cleanUnusedAssets:() => store.cleanUnusedAssets(file => shell.trashItem(file)),
    exportCollection:async (collectionId,itemId) => {
      const result = await dialog.showOpenDialog(mainWindow,{title:'Choose an export destination',properties:['openDirectory','createDirectory']});
      if (result.canceled || !result.filePaths[0]) return null;
      return store.exportCollection(result.filePaths[0],collectionId,itemId);
    },
    chooseCollectionBackup:async () => {
      restorePreview = undefined;
      const result = await dialog.showOpenDialog(mainWindow,{title:'Choose a Poster Studio collection backup',
        properties:['openFile'],filters:[{name:'Collection backup',extensions:['json']}]});
      if (result.canceled || !result.filePaths[0]) return null;
      const picked = result.filePaths[0];
      const file = path.join(await fs.realpath(path.dirname(picked)),path.basename(picked));
      const backup = await store.inspectCollectionBackup(file);
      const {collection,assets} = backup;
      const token = randomUUID();
      restorePreview = {token,file,backup};
      return {token,name:collection.name,description:collection.description,posts:collection.items.length,
        archivedPosts:collection.items.filter(item => item.archived).length,
        destinations:collection.destinations.map(destination => destination.name),files:assets.size};
    },
    restoreCollectionBackup:async token => {
      const preview = restorePreview;
      if (!preview || preview.token !== token || preview.pending) throw new Error('Choose a collection backup first.');
      preview.pending = true;
      try {
        const result = await store.restoreCollectionBackup(preview.file,preview.backup);
        if (restorePreview === preview) restorePreview = undefined;
        return result;
      } finally { preview.pending = false; }
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
