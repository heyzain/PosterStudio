'use strict';
const {contextBridge,ipcRenderer} = require('electron');
const methods = [
  'getState','saveCollection','archiveCollection','addDestination','changeDestination','changeField',
  'saveItem','setPublication','archiveItem','pickAsset','fetchIcon','copy','openStorage','exportCollection',
];
contextBridge.exposeInMainWorld('studio',Object.freeze(Object.fromEntries(
  methods.map(name => [name,(...args) => ipcRenderer.invoke('workspace:' + name,...args)])
)));
