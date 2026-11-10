'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('posterDesktop',Object.freeze({
  getState:()=>ipcRenderer.invoke('posters:get-state'),
  chooseFolder:()=>ipcRenderer.invoke('posters:choose-folder'),
  savePosters:(posters)=>ipcRenderer.invoke('posters:save',posters),
  openCollection:()=>ipcRenderer.invoke('posters:open-collection'),
  openPoster:(id)=>ipcRenderer.invoke('posters:open-poster',id),
  copy:(text)=>ipcRenderer.invoke('posters:copy',text)
}));
