'use strict';
const {contextBridge,ipcRenderer} = require('electron');
const methods = [
  'getState','saveCollection','archiveCollection','addDestination','changeDestination','changeField',
  'saveItem','setPublication','archiveItem','pickAsset','fetchIcon','copy','openStorage','showArtwork','copyArtworkFolder','exportCollection',
  'discardDraftAssets','cleanUnusedAssets','chooseCollectionBackup','restoreCollectionBackup',
  'saveBulkTemplate','chooseBulkCsv','chooseBulkFolder','previewBulkCsv','importBulkCsv','closeBulkCsv',
];
contextBridge.exposeInMainWorld('studio',Object.freeze(Object.fromEntries(
  methods.map(name => [name,(...args) => ipcRenderer.invoke('workspace:' + name,...args)])
)));

if (process.platform === 'win32') {
  let maximized = false;
  const subscribers = new Set();
  ipcRenderer.on('window:maximized',(_event,value) => {
    maximized = value;
    for (const notify of subscribers) notify();
  });
  contextBridge.exposeInMainWorld('studioWindow',Object.freeze({
    control:action => ipcRenderer.invoke('workspace:windowControl',action),
    isMaximized:() => maximized,
    subscribe:notify => {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
  }));
}
