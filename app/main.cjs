'use strict';
const {app,BrowserWindow,dialog,ipcMain,protocol,net,shell,clipboard} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {PosterStore} = require('./storage.cjs');
let mainWindow, store;
protocol.registerSchemesAsPrivileged([{scheme:'poster-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
function createWindow(){
  mainWindow=new BrowserWindow({
    title:'Poster Studio',width:1380,height:900,minWidth:380,minHeight:590,
    backgroundColor:'#171717',autoHideMenuBar:true,show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
  });
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event)=>event.preventDefault());
}
app.whenReady().then(async()=>{
  store=new PosterStore(path.join(app.getPath('userData'),'preferences.json'));
  await store.init();
  protocol.handle('poster-media',async(request)=>{
    try {const {file}=await store.imageFile(request.url);return net.fetch(pathToFileURL(file).toString());}
    catch{return new Response('Not found',{status:404});}
  });
  ipcMain.handle('posters:get-state',()=>store.getState());
  ipcMain.handle('posters:choose-folder',async()=>{
    const result=await dialog.showOpenDialog(mainWindow,{title:'Choose your Poster Studio collection',properties:['openDirectory','createDirectory']});
    if(result.canceled||!result.filePaths[0])return null;
    return store.useFolder(result.filePaths[0]);
  });
  ipcMain.handle('posters:save',(_event,posts)=>store.saveAll(posts));
  ipcMain.handle('posters:open-collection',async()=>{
    const folder=store.requireFolder();return shell.openPath(folder);
  });
  ipcMain.handle('posters:open-poster',async(_event,id)=>{
    const folder=store.posterFolder(Number(id));return shell.openPath(folder);
  });
  ipcMain.handle('posters:copy',(_event,value)=>{if(typeof value!=='string'||value.length>100000)throw new Error('Invalid clipboard content.');clipboard.writeText(value);return true;});
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(err=>{dialog.showErrorBox('Poster Studio could not start',err.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
