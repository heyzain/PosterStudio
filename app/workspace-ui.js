'use strict';
const api = window.studio;
const notice = document.querySelector('#notice');
const keyDate = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const localDateTime = () => keyDate(new Date()) + 'T' + new Date().toTimeString().slice(0,5);
const statusLabels = {draft:'Draft',ready:'Ready',scheduled:'Scheduled',published:'Published'};
const fieldLabels = {text:'Short text',long:'Long text',url:'URL',tags:'Tags',number:'Number',datetime:'Date and time',select:'Single select',checkbox:'Checkbox',file:'Image or file'};
const activeItems = collection => collection.items.filter(item => !item.archived);
const number = item => '#' + String(item.number).padStart(3,'0');
const source = id => 'poster-media://workspace/' + encodeURIComponent(id);
const markPaths = {
  folder:'M3 6h7l2 2h9v11H3z', story:'M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3z M12 7v14',
  code:'m8 6-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16', photo:'M3 4h18v16H3z M3 17l5-5 4 4 4-6 5 7',
};
const brandPaths = {
  facebook:'M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.098 4.388 23.092 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.696 4.533-4.696 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.49 0-1.955.93-1.955 1.885v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.092 24 18.098 24 12.073z',
  pinterest:'M12 0a12 12 0 0 0-4.37 23.18c-.06-1.02-.01-2.24.25-3.35l1.55-6.55s-.39-.78-.39-1.94c0-1.82 1.06-3.18 2.37-3.18 1.12 0 1.66.84 1.66 1.84 0 1.12-.71 2.79-1.08 4.34-.31 1.3.65 2.35 1.93 2.35 2.31 0 4.09-2.43 4.09-5.94 0-3.1-2.23-5.26-5.41-5.26-3.69 0-5.85 2.77-5.85 5.63 0 1.12.43 2.32.97 2.96.1.13.12.24.09.37l-.36 1.47c-.06.24-.19.29-.44.17-1.64-.76-2.67-3.16-2.67-5.08 0-4.14 3.01-7.94 8.68-7.94 4.56 0 8.11 3.25 8.11 7.6 0 4.54-2.86 8.19-6.83 8.19-1.33 0-2.59-.69-3.02-1.51l-.82 3.12c-.3 1.14-1.1 2.57-1.64 3.44A12 12 0 1 0 12 0z',
  linkedin:'M21 2H3a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM8 19H5V9h3v10zM6.5 7.8a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5zM19 19h-3v-5c0-2.5-3-2.3-3 0v5h-3V9h3v1.3c1.4-2.2 6-2.4 6 2.1z',
  youtube:'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6z',
  x:'M17.3 2H21l-7.9 9 9.3 11h-7.3l-5.7-6.8L3.5 22H0l7.9-9.2L0 2h7.5l5.1 6.1L17.3 2zM16 20h2L6.3 4h-2z',
};
const linePaths = {
  website:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z M2 12h20 M12 2c5 5 5 15 0 20-5-5-5-15 0-20z',
  instagram:'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M17.6 6.5h.1',
  threads:'M20 8c-1-4-4-6-8-6-6 0-9 4-9 10s3 10 9 10c5 0 8-2.5 8-6s-3-5-7-5c-3 0-5 1-5 3.3 0 2 1.6 3 3.5 3 3.2 0 4.5-3 4.5-6.1C16 8 14.8 6 12 6c-1.5 0-2.8.7-3.5 1.7',
  plus:'M12 5v14M5 12h14',
  back:'m14 6-6 6 6 6',
  image:'M4 4h16v16H4z M4 16l5-5 4 4 4-6 3 4 M8 8h.1',
};
const countLabel = (count, noun) => count + ' ' + noun + (count === 1 ? '' : 's');
let state = {collections:[],websites:[],presets:{},types:[]};
let screen = 'home', currentId = '', filter = 'all', search = '', sort = 'newest';
let platform = '';
let postView, collectionEditor;
let selectedDay = keyDate(new Date()), month = new Date();
let calendarCollection = '', calendarDestination = '';
let postEditor, plan, destinationTool, settings = false, settingsNotice = '';
let busy = false, noticeTimer;
let renderWorkspace, ready = false, loadError = '';

const current = () => state.collections.find(collection => collection.id === currentId);
function notify(message) {
  if (settings) {
    settingsNotice = message;
    renderPage();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { settingsNotice = ''; renderPage(); }, 4200);
    return;
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; },4200);
}
function failure(error) {
  notify(error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
}
async function run(task) {
  if (busy) return;
  busy = true;
  try { return await task(); } catch (error) { failure(error); } finally { busy = false; }
}
function apply(data) {
  state.collections = data.collections;
  state.websites = data.websites;
  renderPage();
}
function isLightTheme() {
  return localStorage.getItem('poster-studio-ui-theme') !== 'dark';
}
function itemStatus(item) {
  const records = item.records.filter(record => record.selected);
  if (records.length && records.every(record => record.status === 'published')) return 'published';
  if (records.some(record => record.status === 'scheduled')) return 'scheduled';
  if (records.length && records.every(record => ['ready','published'].includes(record.status))) return 'ready';
  return item.stage;
}
const icons = {...linePaths,...markPaths};
function renderPage() {
  const viewedCollection = postView && state.collections.find(entry => entry.id === postView.collectionId);
  const viewedItem = viewedCollection?.items.find(item => item.id === postView.itemId && !item.archived);
  const light = isLightTheme();
  document.documentElement.dataset.uiTheme = light ? 'light' : 'dark';
  const candidate = screen === 'collection' ? current() : undefined;
  const collection = candidate && !candidate.archived ? candidate : undefined;
  const selected = collection ? currentPlatform(collection) : undefined;
  if (collection && !selected) platform = '';
  const posts = collection ? activeItems(collection) : [];
  const status = item => selected ? platformRecord(item,selected.id)?.status : itemStatus(item);

  renderWorkspace({
    screen, light, ready, error:loadError, dispatchAction,
    collections:state.collections,
    postView:viewedItem && { ...postView, collection:viewedCollection, item:viewedItem },
    itemStatus,
    collectionEditor, postEditor, plan, settings, settingsNotice, destinationTool:destinationDialogProps(),
    pickAsset:kind => api.pickAsset(kind), fetchIcon:url => api.fetchIcon(url),
    destinationPresets:Object.entries(state.presets).filter(([type]) => type !== 'website').map(([type,[name]]) => ({type,name})),
    savedWebsites:state.websites,
    calendar:screen === 'calendar' && ready ? calendarView() : undefined,
    collection, selected, posts, filteredPosts:filterPosts(posts,status),
    status, statusLabels, postNumber:number, search, filter, sort,
    icons, solidIcons:brandPaths, source, countLabel, activeItems, platformRecord,
    choosePlatform:id => { platform = id; renderPage(); },
    updatePosts:({search:query = search,filter:nextFilter = filter,sort:nextSort = sort}) => {
      search = query;
      filter = nextFilter;
      sort = nextSort;
      renderPage();
    },
  });
}
function currentPlatform(collection = current()) {
  return collection.destinations.find(d => d.id === platform && d.enabled);
}
function platformRecord(item, id) {
  return item.records.find(record => record.id === id && record.selected);
}
function filterPosts(posts,status) {
  const query = search.trim().toLowerCase();
  const items = posts.filter(item => {
    const postStatus = status(item);
    return postStatus && (filter === 'all' || filter === postStatus) &&
      [item.title,item.master,item.notes,number(item),String(item.number)].some(value => value.toLowerCase().includes(query));
  });
  items.sort((a,b) => {
    if (sort === 'oldest') return a.number-b.number;
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'updated') return b.updated.localeCompare(a.updated);
    return b.number-a.number;
  });
  return items;
}

function editCollection(collection) {
  if (collection) {
    settings = false;
    settingsNotice = '';
  }
  collectionEditor = {
    collection,
    close: () => {
      collectionEditor = undefined;
      if (collection) showSettings();
      else renderPage();
    },
    save: async draft => {
      const result = await api.saveCollection(collection?.id ?? null, draft);
      collectionEditor = undefined;
      if (collection) {
        filter = 'all';
        search = '';
        apply(result);
        showSettings();
      } else {
        state.collections = result.collections;
        state.websites = result.websites;
        openCollection(result.collections.at(-1).id);
      }
    },
  };
  renderPage();
}
function showSettings() {
  destinationTool = undefined;
  settings = true;
  settingsNotice = '';
  renderPage();
}
function leaveSettings() {
  settings = false;
  settingsNotice = '';
  renderPage();
}
function openDestinationTool(mode, id) {
  settings = false;
  settingsNotice = '';
  destinationTool = { mode, id };
  renderPage();
}

function destinationDialogProps() {
  if (!destinationTool) return undefined;
  const { mode, id } = destinationTool;
  const collection = current();
  return {
    mode, fieldLabels, close:showSettings,
    destination:collection.destinations.find(destination => destination.id === id),
    websites:state.websites.filter(site => !collection.destinations.some(destination => destination.profileId === site.id)),
    saveWebsite:async profile => {
      apply(await api.addDestination(collection.id, 'website', profile));
      showSettings();
    },
    saveIcon:async icon => {
      apply(await api.changeDestination(collection.id, id, { icon }));
      showSettings();
    },
    changeField:async (field, action, input) => {
      apply(await api.changeField(collection.id, id, field ?? null, action, input));
    },
  };
}

function openEditor(item) {
  const collection = current();
  const initialDestination = item && postView?.itemId === item.id
    ? postView.destinationId : screen === 'collection' ? currentPlatform()?.id : undefined;
  postEditor = {
    collection, item, initialDestination,
    close: () => { postEditor = undefined; renderPage(); },
    save: async (collectionId, draft, destinationId) => {
      const result = await api.saveItem(collectionId, draft);
      const savedCollection = result.collections.find(entry => entry.id === collectionId);
      postEditor = undefined;
      apply(result);
      viewItem(draft.id ?? savedCollection.items[0].id, destinationId);
      notify('Post saved');
    },
  };
  renderPage();
}
function viewItem(id, destinationId) {
  const item = current()?.items.find(entry => entry.id === id && !entry.archived);
  if (!item) return;
  const preferred = destinationId ?? (screen === 'collection' ? currentPlatform()?.id : undefined);
  postView = {
    collectionId:currentId, itemId:id,
    destinationId:platformRecord(item,preferred)?.id ?? item.records.find(record => record.selected)?.id,
    backLabel:screen === 'calendar' ? 'Calendar' : screen === 'collection' ? current().name : 'All collections',
  };
  renderPage();
}

function calendarEvents() {
  return state.collections.filter(c => !c.archived).flatMap(collection => activeItems(collection).flatMap(item =>
    item.records.filter(record => record.selected).map(record => ({
      collection,item,record,destination:collection.destinations.find(d => d.id === record.id),
      date:(record.planned || record.published).slice(0,10),
      time:(record.planned || record.published).slice(11),
    })))).filter(event => event.destination &&
      (!calendarCollection || event.collection.id === calendarCollection) &&
      (!calendarDestination || event.destination.id === calendarDestination));
}
function calendarView() {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const first = new Date(year,monthIndex,1);
  const today = keyDate(new Date());
  const events = calendarEvents();
  const collections = state.collections.filter(c => !c.archived);
  const destinationChoices = collections.filter(c => !calendarCollection || c.id === calendarCollection)
    .flatMap(c => c.destinations.map(d => [d.id,calendarCollection ? d.name : c.name + ' · ' + d.name]));
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({length:42},(_,index) => {
    const date = new Date(year,monthIndex,index - offset + 1);
    const key = keyDate(date);
    return {
      date:date.getDate(), key, count:events.filter(event => event.date === key).length,
      today:key === today, outside:date.getMonth() !== monthIndex, selected:key === selectedDay,
    };
  });
  return {
    monthTitle:first.toLocaleDateString(undefined,{month:'long',year:'numeric'}),
    heading:new Date(selectedDay + 'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}),
    rows:events.filter(event => event.date === selectedDay).sort((a,b) => a.time.localeCompare(b.time)),
    collections, destinationChoices, calendarCollection, calendarDestination, days,
    updateCalendar:({collection,destination}) => {
      if (collection !== undefined) {
        calendarCollection = collection;
        calendarDestination = '';
      } else calendarDestination = destination;
      renderPage();
    },
  };
}
function planForm() {
  plan = {
    entries: calendarEvents().filter(({ record }) => record.status !== 'published'),
    date: selectedDay,
    close: () => { plan = undefined; renderPage(); },
    save: async ({ collection, item, destination }, date) => {
      const result = await api.setPublication(collection.id, item.id, destination.id, 'plan', date);
      selectedDay = date.slice(0, 10);
      month = new Date(selectedDay + 'T12:00');
      plan = undefined;
      apply(result);
    },
  };
  renderPage();
}
function openCollection(id) {
  postView = undefined;
  currentId = id;
  screen = 'collection';
  platform = ''; filter = 'all'; search = ''; sort = 'newest';
  renderPage();
}
function changeMonth(offset) {
  month = new Date(month.getFullYear(),month.getMonth()+offset,1);
  selectedDay = keyDate(month);
  renderPage();
}
async function exportData(item) {
  const result = await api.exportCollection(currentId,item);
  if (result) notify('Export saved');
}
const actions = {
  home:() => { postView = undefined; screen = 'home'; renderPage(); },
  calendar:() => { postView = undefined; screen = 'calendar'; renderPage(); },
  theme:() => {
    const light = document.documentElement.dataset.uiTheme === 'light';
    localStorage.setItem('poster-studio-ui-theme',light ? 'dark' : 'light');
    renderPage();
  },
  create:() => { if (ready) editCollection(); },
  'open-collection':openCollection,
  'edit-collection':() => editCollection(current()),
  settings:showSettings,
  'close-settings':leaveSettings,
  'open-storage':() => api.openStorage(),
  'show-artwork':id => api.showArtwork(id),
  'export-collection':() => exportData(),
  'export-item':exportData,
  'archive-collection':async () => {
    if (!confirm('Archive this collection? You can restore it from Collections.')) return;
    const result = await api.archiveCollection(currentId,true);
    screen = 'home'; settings = false; settingsNotice = ''; apply(result);
  },
  'restore-collection':async id => apply(await api.archiveCollection(id,false)),
  'add-preset':async type => { apply(await api.addDestination(currentId,type)); showSettings(); },
  'destination-icon':id => openDestinationTool('icon', id),
  'add-website':() => openDestinationTool('website'),
  'toggle-destination':async id => {
    const dest = current().destinations.find(d => d.id === id);
    apply(await api.changeDestination(currentId,id,{enabled:!dest.enabled})); showSettings();
  },
  'manage-fields':id => openDestinationTool('fields', id),
  'new-item':() => openEditor(),
  'view-item':id => viewItem(id),
  'recent-item':value => {
    const [collection,id] = value.split(':');
    currentId = collection;
    viewItem(id);
  },
  'back-to-posts':() => { postView = undefined; renderPage(); },
  'preview-destination':id => { postView.destinationId = id; renderPage(); },
  'edit-item':id => openEditor(current().items.find(i => i.id === id)),
  'archive-item':async id => {
    if (!confirm('Archive this post? You can restore it from the collection.')) return;
    const result = await api.archiveItem(currentId,id,true);
    postView = undefined;
    apply(result);
  },
  'restore-item':async id => apply(await api.archiveItem(currentId,id,false)),
  copy:async value => { await api.copy(value); notify('Copied to clipboard'); return true; },
  'prev-month':() => changeMonth(-1),
  'next-month':() => changeMonth(1),
  today:() => { month = new Date(); selectedDay = keyDate(month); renderPage(); },
  day:key => { selectedDay = key; month = new Date(key + 'T12:00'); renderPage(); },
  plan:planForm,
  'calendar-item':value => {
    const [collection,id,destination] = value.split(':');
    currentId = collection;
    viewItem(id,destination);
  },
};
for (const action of ['mark-published','undo-published']) {
  actions[action] = async value => {
    const [collection,item,destination] = value.split(':');
    const published = action === 'mark-published';
    apply(await api.setPublication(collection,item,destination,published ? 'published' : 'undo',published ? localDateTime() : ''));
  };
}
function dispatchAction(name, value) {
  if (Object.hasOwn(actions,name)) return run(() => actions[name](value));
}

export function connectWorkspace(render) {
  renderWorkspace = render;
  if (!api) {
    loadError = 'Open Poster Studio in Electron.';
    renderPage();
    return;
  }
  renderPage();
  run(async () => {
    try {
      state = await api.getState();
      ready = true;
    } catch (error) {
      loadError = error.message || 'Close Poster Studio and try opening it again.';
    }
    renderPage();
  });
}
