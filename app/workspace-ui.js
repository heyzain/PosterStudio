'use strict';
const api = window.studio;
const modal = document.querySelector('#modal');
const notice = document.querySelector('#notice');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const e = escapeHtml;
const keyDate = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const localDateTime = () => keyDate(new Date()) + 'T' + new Date().toTimeString().slice(0,5);
const statusLabels = {draft:'Draft',ready:'Ready',scheduled:'Scheduled',published:'Published'};
const fieldLabels = {text:'Short text',long:'Long text',url:'URL',tags:'Tags',number:'Number',datetime:'Date and time',select:'Single select',checkbox:'Checkbox',file:'Image or file'};
const activeItems = collection => collection.items.filter(item => !item.archived);
const number = item => '#' + String(item.number).padStart(3,'0');
const source = id => 'poster-media://workspace/' + encodeURIComponent(id);
const options = (choices, selected) => choices.map(([value,label]) =>
  '<option value="' + e(value) + '"' + (value === selected ? ' selected' : '') + '>' + e(label) + '</option>').join('');
const field = (label, markup, description = '') =>
  '<label class="field"><span>' + e(label) + '</span>' + markup + (description ? '<small>' + e(description) + '</small>' : '') + '</label>';
const input = (name, value, attrs = '') => '<input name="' + e(name) + '" value="' + e(value) + '" ' + attrs + '>';
const area = (name, value, attrs = '') => '<textarea name="' + e(name) + '" ' + attrs + '>' + e(value) + '</textarea>';
const button = (label, action, cls = '', value = '') =>
  '<button type="button" class="button ' + cls + '" data-action="' + e(action) + '" data-value="' + e(value) + '">' + e(label) + '</button>';
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
  arrow:'M4 12h15m-6-6 6 6-6 6', plus:'M12 5v14M5 12h14', close:'m6 6 12 12M18 6 6 18',
  back:'m14 6-6 6 6 6',
  image:'M4 4h16v16H4z M4 16l5-5 4 4 4-6 3 4 M8 8h.1',
};
const glyph = path => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
const countLabel = (count, noun) => count + ' ' + noun + (count === 1 ? '' : 's');
let state = {collections:[],websites:[],presets:{},types:[]};
let screen = 'home', currentId = '', filter = 'all', search = '', sort = 'newest';
let platform = '';
let selectedDay = keyDate(new Date()), month = new Date();
let calendarCollection = '', calendarDestination = '';
let editor, selectedRecord, settingsDestination = '';
let dialogAction, busy = false, noticeTimer;
let renderWorkspace, ready = false, loadError = '';

const current = () => state.collections.find(collection => collection.id === currentId);
const destination = () => current().destinations.find(entry => entry.id === settingsDestination);
function notify(message) {
  if (modal.open) {
    const status = modal.querySelector('[data-dialog-notice]');
    if (status) {
      status.textContent = message;
      status.hidden = false;
      setTimeout(() => { status.hidden = true; },4200);
      return;
    }
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; },4200);
}
function failure(error) {
  const message = error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
  const inline = modal.querySelector('[data-error]');
  if (modal.open && inline) {
    inline.textContent = message;
    inline.hidden = false;
  } else notify(message);
}
async function run(task) {
  if (busy) return;
  busy = true;
  try { await task(); } catch (error) { failure(error); } finally { busy = false; }
}
function apply(data) {
  state.collections = data.collections;
  state.websites = data.websites;
  renderPage();
}
function showDialog(title, body, submit, action, layout = '') {
  dialogAction = action;
  modal.className = layout;
  const submitButton = submit ? '<button class="button primary" type="submit">' + e(submit) + '</button>' : '';
  modal.innerHTML = '<form><header class="dialog-head"><h2 id="modal-title">' + e(title) + '</h2><div class="actions">' +
    (layout ? '<button class="button icon-only" type="button" data-action="close" aria-label="Close">' + glyph(linePaths.close) + '</button>' :
      submitButton + button('Close','close','quiet')) +
    '</div></header><div class="dialog-body"><p class="error" data-error role="alert" hidden></p>' +
    '<p class="muted" data-dialog-notice role="status" hidden></p>' + body + '</div>' +
    (layout && submit ? '<footer class="dialog-footer">' + button('Cancel','close','quiet') + submitButton + '</footer>' : '') + '</form>';
  if (!modal.open) modal.showModal();
}
function isLightTheme() {
  return localStorage.getItem('poster-studio-ui-theme') === 'light';
}
function art(id, title) {
  return '<span class="art' + (id ? ' has-image"><img alt="" src="' + source(id) + '">' : '">' + e(title)) + '</span>';
}
function collectionIcon(mark, icon) {
  return icon ? '<img alt="" src="' + source(icon) + '">' : glyph(markPaths[mark] ?? markPaths.folder);
}
function badge(destination, full = false) {
  const brand = Object.hasOwn(brandPaths,destination.type);
  const path = brand ? brandPaths[destination.type] : (linePaths[destination.type] ?? linePaths.website);
  return '<span class="badge platform" data-platform="' + e(destination.type) + '" title="' + e(destination.name) + '">' +
    '<span class="platform-icon' + (brand && !destination.icon ? ' solid' : '') + '">' +
    (destination.icon ? '<img src="' + source(destination.icon) + '" alt="">' : glyph(path)) +
    '</span><span' + (full ? '' : ' class="sr-only"') + '>' + e(destination.name) + '</span></span>';
}
function itemStatus(item) {
  const records = item.records.filter(record => record.selected);
  if (records.length && records.every(record => record.status === 'published')) return 'published';
  if (records.some(record => record.status === 'scheduled')) return 'scheduled';
  if (records.length && records.every(record => ['ready','published'].includes(record.status))) return 'ready';
  return item.stage;
}
function pill(status) {
  return '<span class="pill ' + e(status) + '">' + statusLabels[status] + '</span>';
}
const icons = {...linePaths,...markPaths};
function renderPage() {
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

async function pickWithFeedback(trigger, status, kind) {
  const idleLabel = trigger.textContent;
  trigger.disabled = true;
  trigger.textContent = 'Opening…';
  status.textContent = 'Opening the file picker…';
  try {
    // Present the pending state before the native dialog takes focus.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const picked = await api.pickAsset(kind);
    status.textContent = picked ? 'Selected ' + picked.name + '.' : 'Selection canceled.';
    return picked;
  } catch (error) {
    status.textContent = '';
    throw error;
  } finally {
    trigger.disabled = false;
    trigger.textContent = idleLabel;
    trigger.focus();
  }
}
function collectionForm(collection) {
  let image = collection?.cover ?? null;
  let icon = collection?.icon ?? null;
  const marks = [['folder','Folder'],['story','Story'],['code','Code'],['photo','Photo']];
  const selectedMark = collection?.mark ?? 'folder';
  showDialog(collection ? 'Edit collection' : 'Create collection',
    '<div class="collection-form-layout"><div class="collection-fields">' +
    field('Name',input('name',collection?.name,'maxlength="100" placeholder="e.g. Zavi, Pip and Mira" required autofocus')) +
    field('Description (optional)',area('description',collection?.description,'rows="3" maxlength="1000" placeholder="What goes in this collection?"')) +
    '<fieldset class="mark-picker"><legend>Collection icon</legend><div class="mark-options">' + marks.map(([value,label]) =>
      '<label><input type="radio" name="mark" value="' + value + '"' + (value === selectedMark ? ' checked' : '') +
      '><span>' + collectionIcon(value) + label + '</span></label>').join('') + '</div></fieldset>' +
    '<div class="inline icon-upload"><span class="collection-icon" id="collection-icon-preview"></span>' +
    button('Upload logo','pick-logo') + button('Remove logo','clear-logo','quiet') + '</div>' +
    '<p class="picker-status" id="logo-status" role="status"></p></div>' +
    '<section class="cover-field" aria-labelledby="cover-label"><h3 id="cover-label">Cover image <small>(optional)</small></h3>' +
    '<div id="collection-preview"></div><div class="actions">' +
    button('Choose cover','pick-cover') + button('Remove','clear-cover','quiet') + '</div>' +
    '<p class="picker-status" id="cover-status" role="status"></p></section></div>',
    collection ? 'Save changes' : 'Create collection', async data => {
      const result = await api.saveCollection(collection?.id ?? null,{
        name:data.get('name'),description:data.get('description'),mark:data.get('mark'),cover:image,icon,
      });
      currentId = collection?.id ?? result.collections.at(-1).id;
      screen = 'collection';
      filter = 'all'; search = '';
      modal.close();
      apply(result);
      if (collection) showSettings();
    },'collection-dialog');
  const form = modal.querySelector('form');
  const coverStatus = form.querySelector('#cover-status');
  const logoStatus = form.querySelector('#logo-status');
  const clearCover = form.querySelector('[data-action=clear-cover]');
  const clearLogo = form.querySelector('[data-action=clear-logo]');
  const preview = () => {
    const mark = form.elements.mark.value;
    form.querySelector('#collection-icon-preview').innerHTML = collectionIcon(mark,icon);
    form.querySelector('#collection-preview').innerHTML = image ? cover({cover:image,mark}) :
      '<span class="cover-placeholder">' + glyph(linePaths.image) + '<span>PNG, JPG or WebP</span></span>';
    clearCover.hidden = !image;
    clearLogo.hidden = !icon;
  };
  const pickCover = form.querySelector('[data-action=pick-cover]');
  const pickLogo = form.querySelector('[data-action=pick-logo]');
  pickCover.onclick = () => run(async () => {
    const picked = await pickWithFeedback(pickCover,coverStatus,'image');
    if (picked) { image = picked.id; preview(); }
  });
  pickLogo.onclick = () => run(async () => {
    const picked = await pickWithFeedback(pickLogo,logoStatus,'icon');
    if (picked) { icon = picked.id; preview(); }
  });
  clearCover.onclick = () => {
    image = null;
    coverStatus.textContent = 'Cover removed.';
    preview();
    pickCover.focus();
  };
  clearLogo.onclick = () => {
    icon = null;
    logoStatus.textContent = 'Custom logo removed.';
    preview();
    pickLogo.focus();
  };
  form.querySelector('.mark-options').onchange = () => {
    if (icon) logoStatus.textContent = 'The uploaded logo takes priority over the selected preset.';
    preview();
  };
  preview();
  form.elements.name.focus();
}
function showSettings() {
  const collection = current();
  const archived = collection.items.filter(i => i.archived);
  const available = Object.entries(state.presets).filter(([type]) => type !== 'website' && !collection.destinations.some(d => d.type === type));
  showDialog('Collection settings','<div class="block"><div class="row"><div><h3>' + e(collection.name) + '</h3><p class="muted">' + e(collection.description) +
    '</p></div>' + button('Edit details','edit-collection') + '</div></div><div class="block"><h3>Publishing destinations</h3>' +
    '<div class="destination-options">' + available.map(([type,[name]]) =>
      '<button type="button" class="button destination-option" data-action="add-preset" data-value="' + e(type) + '" aria-label="Add ' + e(name) + '">' +
      badge({type,name},true) + glyph(linePaths.plus) + '</button>').join('') + button('Add custom website','add-website') + '</div>' +
    collection.destinations.map(d => '<div class="row"><div>' + badge(d,true) + ' <small>' + (d.enabled ? 'Enabled' : 'Disabled') +
      '</small></div><div class="actions">' + button('Change icon','destination-icon','quiet',d.id) + button('Manage fields','manage-fields','quiet',d.id) +
      button(d.enabled ? 'Disable' : 'Enable','toggle-destination','',d.id) + '</div></div>').join('') +
    '</div><div class="block"><h3>Local storage</h3><p class="muted">Collection data and assets are stored on this device.</p><div class="actions">' +
    button('Open storage folder','open-storage') + button('Export collection backup','export-collection') +
    button('Archive collection','archive-collection','danger') + '</div></div>' +
    (archived.length ? '<div class="block"><h3>Archived content</h3>' + archived.map(i => '<div class="row"><span>' + e(i.title) +
      '</span>' + button('Restore','restore-item','',i.id) + '</div>').join('') + '</div>' : ''));
}
function destinationIconForm(id) {
  const entry = current().destinations.find(d => d.id === id);
  let icon = entry.icon;
  showDialog('Change destination icon','<div class="block"><div id="destination-icon-preview"></div><div class="actions">' +
    button('Upload icon','upload-destination-icon') + button('Use default','reset-destination-icon','quiet') + '</div>' +
    '<p class="picker-status" role="status"></p></div>','Save icon',async () => {
      apply(await api.changeDestination(currentId,id,{icon}));
      showSettings();
    },'icon-dialog');
  const trigger = modal.querySelector('[data-action=upload-destination-icon]');
  const status = modal.querySelector('.picker-status');
  const preview = () => {
    modal.querySelector('#destination-icon-preview').innerHTML = badge({...entry,icon},true);
  };
  trigger.onclick = () => run(async () => {
    const picked = await pickWithFeedback(trigger,status,'icon');
    if (picked) { icon = picked.id; preview(); }
  });
  modal.querySelector('[data-action=reset-destination-icon]').onclick = () => {
    icon = null;
    status.textContent = 'Default icon selected.';
    preview();
  };
  preview();
}
function websiteForm() {
  let icon = null;
  let iconChoice = '';
  const saved = state.websites.filter(site => !current().destinations.some(d => d.profileId === site.id));
  showDialog('Add custom website', (saved.length ? '<div class="block"><h3>Reuse a saved website</h3><div class="actions"><select id="saved-site" aria-label="Saved website">' +
    options(saved.map(site => [site.id,site.name])) + '</select>' + button('Add saved website','reuse-site') + '</div></div>' : '') +
    field('Website name',input('name','','maxlength="100" required')) + field('Website URL',input('url','','type="url" placeholder="https://example.com" required')) +
    field('Description',area('description','','rows="2" maxlength="500"')) + '<div class="block"><div class="site-preview inline" id="icon-preview">' +
    badge({type:'website',name:'Globe icon'},true) + '</div><div class="actions">' +
    button('Fetch favicon','fetch-icon') + button('Upload icon','upload-icon') + button('Use globe','clear-icon','quiet') +
    '</div><p class="picker-status" role="status"></p></div>', 'Add website',async data => {
      const url = data.get('url');
      if (!icon && !iconChoice) icon = (await api.fetchIcon(url))?.id ?? null;
      apply(await api.addDestination(currentId,'website',{name:data.get('name'),url,description:data.get('description'),icon}));
      showSettings();
    });
  const setIcon = (id, message, choice) => {
    icon = id;
    iconChoice = choice;
    modal.querySelector('#icon-preview').innerHTML = badge({type:'website',name:message,icon:id},true);
  };
  modal.querySelector('[data-action=fetch-icon]').onclick = event => run(async () => {
    const trigger = event.target;
    const url = modal.querySelector('[name=url]');
    if (!url.reportValidity()) return;
    trigger.disabled = true;
    try {
      const result = await api.fetchIcon(url.value);
      if (modal.open) setIcon(result?.id ?? null,result ? 'Website favicon' : 'Globe icon · favicon unavailable','fetched');
    } finally { trigger.disabled = false; }
  });
  const upload = modal.querySelector('[data-action=upload-icon]');
  const status = modal.querySelector('.picker-status');
  upload.onclick = () => run(async () => {
    const result = await pickWithFeedback(upload,status,'icon');
    if (result && modal.open) setIcon(result.id,'Uploaded icon','upload');
  });
  modal.querySelector('[data-action=clear-icon]').onclick = () => {
    status.textContent = '';
    setIcon(null,'Globe icon','globe');
  };
  modal.querySelector('[name=url]').onchange = () => {
    if (iconChoice === 'fetched') setIcon(null,'Globe icon','');
  };
}
function showFields() {
  const dest = destination();
  showDialog(dest.name + ' fields', '<div class="actions">' + button('Back to settings','settings','quiet') +
    button('Add field','add-field','primary') + '</div>' + (dest.fields.length ? '<div class="block">' +
    dest.fields.map((definition,index) => '<div class="row"><div><strong>' + e(definition.label) + '</strong><br><small>' +
      fieldLabels[definition.type] + (definition.archived ? ' · Archived' : '') + '</small></div><div class="actions">' +
      button('Edit','edit-field','',definition.id) + (index ? button('↑','field-up','quiet',definition.id) : '') +
      (index < dest.fields.length-1 ? button('↓','field-down','quiet',definition.id) : '') +
      button(definition.archived ? 'Restore' : 'Archive',definition.archived ? 'field-restore' : 'field-archive','quiet',definition.id) +
      '</div></div>').join('') + '</div>' : '<p class="muted">Add fields for the content you prepare for this destination.</p>'));
}
function fieldForm(previous) {
  let draftOptions = structuredClone(previous?.options ?? []);
  const fieldsMarkup = type => {
    const limits = type === 'number' ? '<div class="columns">' +
      field('Minimum',input('min',previous?.min,'type="number" step="any"')) +
      field('Maximum',input('max',previous?.max,'type="number" step="any"')) + '</div>' :
      ['text','long'].includes(type) ? field('Maximum length',input('maxLength',previous?.maxLength,'type="number" min="1" max="40000"')) : '';
    if (type === 'select') return '<div class="block"><h3>Options</h3><div id="option-list" class="option-list"></div>' +
      '<div class="actions">' + button('Add option','add-option','quiet') + '</div></div>';
    return limits + field('Default',displayInput({id:'default',type},previous?.defaultValue,true));
  };
  function renderOptions() {
    modal.querySelector('#option-list').innerHTML = draftOptions.map((option,index) =>
      '<div class="option-row">' + input('option-label-' + index,option.label,'maxlength="100" aria-label="Option label" required') +
      '<label class="check"><input type="checkbox" name="option-archive-' + index + '"' + (option.archived ? ' checked' : '') + '> Archived</label></div>').join('') +
      field('Default option','<select name="default">' + options([['','No default'],...draftOptions.map((option,index) =>
        [String(index),option.label || 'Option ' + (index+1)])],String(draftOptions.findIndex(o => o.id && o.id === previous?.defaultValue))) + '</select>');
  }
  function updateOptions() {
    draftOptions = draftOptions.map((option,index) => ({
      ...option,label:modal.querySelector('[name=option-label-' + index + ']').value,
      archived:modal.querySelector('[name=option-archive-' + index + ']').checked,
    }));
  }
  showDialog(previous ? 'Edit field' : 'Add field',
    '<div class="actions">' + button('Back to fields','back-fields','quiet') + '</div>' +
    field('Label',input('label',previous?.label,'maxlength="100" required')) +
    field('Description',input('description',previous?.description,'maxlength="500"')) +
    field('Type','<select name="type"' + (previous ? ' disabled' : '') + '>' + options(state.types.map(type => [type,fieldLabels[type]]),previous?.type ?? 'text') + '</select>') +
    '<label class="check"><input type="checkbox" name="required"' + (previous?.required ? ' checked' : '') + '> Required for Ready and Scheduled</label>' +
    '<div class="fields" id="field-configuration"></div>', 'Save field',async data => {
      const type = previous?.type ?? data.get('type');
      const value = {label:data.get('label'),description:data.get('description'),type,required:data.has('required')};
      for (const key of ['min','max','maxLength']) if (data.get(key)) value[key] = Number(data.get(key));
      if (type === 'select') {
        updateOptions();
        value.options = draftOptions;
        if (data.get('default') !== '') value.defaultOptionIndex = Number(data.get('default'));
      } else value.defaultValue = readControl(modal.querySelector('[name=default]'),type);
      apply(await api.changeField(currentId,settingsDestination,previous?.id ?? null,'save',value));
      showFields();
    });
  function configuration() {
    const type = modal.querySelector('[name=type]').value;
    modal.querySelector('#field-configuration').innerHTML = fieldsMarkup(type);
    if (type === 'select') {
      renderOptions();
      modal.querySelector('[data-action=add-option]').onclick = () => {
        const oldDefault = modal.querySelector('[name=default]').value;
        updateOptions();
        draftOptions.push({label:'',archived:false});
        renderOptions();
        modal.querySelector('[name=default]').value = oldDefault;
        modal.querySelector('[name=option-label-' + (draftOptions.length-1) + ']').focus();
      };
    }
  }
  modal.querySelector('[name=type]').onchange = configuration;
  configuration();
}
function dateInput(value) {
  return value?.length === 10 ? value + 'T00:00' : value;
}
function displayInput(def, value, isDefault = false) {
  const name = def.id;
  switch (def.type) {
    case 'text': return input(name,value,'maxlength="' + (def.maxLength ?? 1000) + '"');
    case 'long': return area(name,value,'rows="3" maxlength="' + (def.maxLength ?? 40000) + '"');
    case 'tags': return area(name,value?.join(', '),'rows="2" placeholder="Separate tags with commas or new lines"');
    case 'datetime': return input(name,dateInput(value),'type="datetime-local"');
    case 'number': return input(name,value,'type="number" step="any"');
    case 'url': return input(name,value,'type="url"');
    case 'checkbox': return '<input type="checkbox" name="' + name + '"' + (value ? ' checked' : '') + '>';
    case 'select': return '<select name="' + name + '">' + options([['','Choose…'],...def.options.filter(o => !o.archived || o.id === value)
      .map(o => [o.id,o.label + (o.archived ? ' (archived)' : '')])],value ?? '') + '</select>';
    case 'file':
      if (isDefault) return '<select name="' + name + '">' + options([['','None'],['shared','Use shared artwork']],value ?? '') + '</select>';
      return '<span class="inline"><small>' + e(value === 'shared' ? 'Shared artwork' : value?.name ?? 'No file selected') + '</small>' +
        button('Choose file','pick-field-file','',name) + button('Choose image','pick-field-image','quiet',name) +
        button('Use shared artwork','use-shared','quiet',name) +
        (value ? button('Clear','clear-file','quiet',name) : '') + '</span>';
    default: throw new Error('Unsupported field type.');
  }
}
function readControl(control,type) {
  if (type === 'checkbox') return control.checked;
  const value = control.value.trim();
  if (!value) return null;
  if (type === 'number') return Number(value);
  if (type === 'tags') return value.split(/[,\n]+/).map(tag => tag.trim()).filter(Boolean);
  return ['text','long'].includes(type) ? control.value : value;
}

function newRecord(destination) {
  return {id:destination.id,status:'draft',planned:'',published:'',url:'',values:Object.fromEntries(
    destination.fields.filter(f => !f.archived).map(f => [f.id,f.defaultValue]))};
}
function openEditor(item) {
  editor = item ? structuredClone(item) : {title:'',master:'',notes:'',stage:'draft',artwork:null,records:[]};
  const selected = screen === 'collection' ? currentPlatform() : undefined;
  if (!item && selected) editor.records.push({...newRecord(selected),selected:true});
  selectedRecord = (selected ? platformRecord(editor,selected.id)?.id : undefined) ??
    editor.records.find(record => record.selected)?.id ?? '';
  renderEditor();
}
function retainDate(value, previous) {
  return value === dateInput(previous) ? previous ?? '' : value;
}
function syncEditor() {
  const form = modal.querySelector('form');
  if (!form?.elements.title) return;
  for (const key of ['title','stage','master','notes']) editor[key] = form.elements[key].value;
  const record = editor.records.find(r => r.selected && r.id === selectedRecord);
  const dest = current().destinations.find(d => d.id === selectedRecord);
  if (!record || !form.elements.publication) return;
  record.status = form.elements.publication.value;
  record.planned = retainDate(form.elements.planned.value,record.planned);
  record.published = retainDate(form.elements.published.value,record.published);
  record.url = form.elements.publishedUrl.value;
  for (const def of dest.fields.filter(def => !def.archived && def.type !== 'file')) {
    record.values[def.id] = readControl(form.elements[def.id],def.type);
  }
}
function renderEditor() {
  const collection = current();
  const record = editor.records.find(r => r.selected && r.id === selectedRecord);
  const dest = collection.destinations.find(d => d.id === selectedRecord);
  const available = collection.destinations.filter(d => d.enabled || editor.records.some(r => r.id === d.id && r.selected));
  const tabs = editor.records.filter(r => r.selected).map(r => {
    const d = collection.destinations.find(d => d.id === r.id);
    return button(d.name,'record-tab',r === record ? 'tab active' : 'tab quiet',d.id);
  }).join('');
  const dynamic = record && dest ? '<div class="block"><h3>' + e(dest.name) + '</h3>' +
    dest.fields.filter(def => !def.archived).map(def => field(def.label + (def.required ? ' *' : ''),
      displayInput(def,Object.hasOwn(record.values,def.id) ? record.values[def.id] : def.defaultValue),def.description)).join('') +
    '<div class="columns">' + field('Publishing status','<select name="publication">' + options(Object.entries(statusLabels),record.status) + '</select>') +
    field('Planned for',input('planned',dateInput(record.planned),'type="datetime-local"')) +
    field('Published at',input('published',dateInput(record.published),'type="datetime-local"')) +
    field('Published URL',input('publishedUrl',record.url,'type="url"')) + '</div></div>' : '';
  const body = '<div class="editor-layout"><div class="preview">' + art(editor.artwork,editor.title || 'Shared artwork') + '<div class="actions">' +
    button(editor.artwork ? 'Replace image' : 'Choose image','pick-artwork') +
    (editor.artwork ? button('Remove','remove-artwork','quiet') : '') + '</div></div><div class="fields">' +
    field('Title',input('title',editor.title,'maxlength="150" required')) +
    field('Creative stage','<select name="stage">' + options([['draft','Draft'],['ready','Ready']],editor.stage) + '</select>') +
    field('Master text',area('master',editor.master,'rows="4" maxlength="40000"')) +
    field('Internal notes',area('notes',editor.notes,'rows="2" maxlength="20000"')) +
    '<div class="block"><h3>Destinations</h3>' +
    (available.length ? '<div class="actions">' + available.map(d =>
      '<label class="check"><input type="checkbox" data-destination="' + d.id + '"' +
      (editor.records.some(r => r.id === d.id && r.selected) ? ' checked' : '') + '> ' + e(d.name) + '</label>').join('') +
      '</div>' : '<p class="muted">Add destinations in collection settings.</p>') +
    (tabs ? '<div class="record-tabs">' + tabs + '</div>' : '') + '</div>' + dynamic + '</div></div>';
  showDialog(editor.id ? 'Edit post' : 'Add post',body,'Save post',async () => {
    syncEditor();
    const id = editor.id;
    const result = await api.saveItem(currentId,editor);
    apply(result);
    viewItem(id ?? current().items[0].id);
    notify('Post saved');
  },'post-editor');
}
function copyButton(value,label = 'Copy') {
  return button(label,'copy','quiet',value);
}
function viewField(def, value, item) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  let display = value;
  if (def.type === 'checkbox') display = value ? 'Yes' : 'No';
  if (def.type === 'select') display = def.options.find(o => o.id === value)?.label ?? value;
  if (def.type === 'file') {
    if (value === 'shared' && !item.artwork) return '';
    display = value === 'shared' ? 'Shared artwork' : value.name;
  }
  const preview = def.type === 'file' && value?.id && /\.(png|jpg|webp)$/.test(value.id) ? art(value.id,display) : '';
  return '<div class="block"><div class="copy-line"><strong>' + e(def.label) + '</strong>' +
    (def.type === 'file' ? '' : copyButton(Array.isArray(display) ? display.join(', ') : String(display))) + '</div>' +
    (Array.isArray(display) ? '<div class="badges">' + display.map(tag => copyButton(tag,tag)).join('') +
      '</div>' : '<p class="pre">' + e(display) + '</p>') + preview + '</div>';
}
function viewItem(id) {
  const collection = current();
  const item = collection.items.find(i => i.id === id);
  const text = (label,value) => value ? viewField({label,type:'long'},value,item) : '';
  const selected = screen === 'collection' ? currentPlatform(collection) : undefined;
  const records = item.records.filter(r => r.selected);
  if (selected) records.sort((a,b) => Number(b.id === selected.id) - Number(a.id === selected.id));
  const status = selected ? platformRecord(item,selected.id)?.status ?? itemStatus(item) : itemStatus(item);
  showDialog(item.title,'<div class="actions"><span class="muted">' + number(item) + '</span>' + pill(status) +
    button('Edit post','edit-item','primary',id) + button('Export','export-item','',id) +
    button('Archive','archive-item','quiet danger',id) + '</div><div class="editor-layout"><div class="preview">' +
    art(item.artwork,item.title) + '</div><div class="stack">' + text('Master text',item.master) + text('Internal notes',item.notes) +
    records.map(record => {
      const d = collection.destinations.find(entry => entry.id === record.id);
      const published = record.status === 'published';
      return '<section class="block"><div class="copy-line">' + badge(d,true) + pill(record.status) + '</div>' +
        (record.planned ? '<small>Planned ' + e(record.planned.replace('T',' ')) + '</small>' : '') +
        (record.published ? '<small>Published ' + e(record.published.replace('T',' ')) + '</small>' : '') +
        '<div class="actions">' + button(published ? 'Undo published' : 'Mark published',
          published ? 'undo-published' : 'mark-published','quiet',[collection.id,item.id,d.id].join(':')) + '</div>' +
        text('Published URL',record.url) +
        d.fields.filter(def => !def.archived).map(def => viewField(def,record.values[def.id],item)).join('') + '</section>';
    }).join('') + '</div></div>',null,null,'post-detail');
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
  const eligible = calendarEvents();
  if (!eligible.length) {
    showDialog('Plan a post','<p class="muted">Add a publishing destination to a content item to schedule it here.</p>');
    return;
  }
  showDialog('Plan a post',field('Content and destination','<select name="post">' +
    options(eligible.map(({collection,item,destination},index) => [String(index),collection.name + ' · ' + item.title + ' · ' + destination.name])) + '</select>') +
    field('Date and time',input('date',selectedDay + 'T09:00','type="datetime-local" required')) +
    '<p class="muted">Plans appear in your calendar. Mark them published after sharing.</p>','Save plan',async data => {
    const {collection,item,destination} = eligible[Number(data.get('post'))];
    const date = data.get('date');
    const result = await api.setPublication(collection.id,item.id,destination.id,'plan',date);
    selectedDay = date.slice(0,10);
    month = new Date(selectedDay + 'T12:00');
    modal.close();
    apply(result);
  });
}
function openCollection(id) {
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
function editRecordFile(action,id) {
  syncEditor();
  const record = editor.records.find(r => r.id === selectedRecord);
  if (action === 'use-shared' || action === 'clear-file') {
    record.values[id] = action === 'use-shared' ? 'shared' : null;
    renderEditor();
    return;
  }
  return api.pickAsset(action === 'pick-field-image' ? 'image' : 'file').then(result => {
    if (!result || !modal.open) return;
    record.values[id] = result;
    renderEditor();
  });
}
const actions = {
  home:() => { screen = 'home'; renderPage(); },
  calendar:() => { screen = 'calendar'; renderPage(); },
  theme:() => {
    const light = document.documentElement.dataset.uiTheme === 'light';
    localStorage.setItem('poster-studio-ui-theme',light ? 'dark' : 'light');
    renderPage();
  },
  close:() => modal.close(),
  create:() => collectionForm(),
  'open-collection':openCollection,
  'edit-collection':() => collectionForm(current()),
  settings:showSettings,
  'open-storage':() => api.openStorage(),
  'export-collection':() => exportData(),
  'export-item':exportData,
  'archive-collection':async () => {
    if (!confirm('Archive this collection? You can restore it from Collections.')) return;
    const result = await api.archiveCollection(currentId,true);
    screen = 'home'; modal.close(); apply(result);
  },
  'restore-collection':async id => apply(await api.archiveCollection(id,false)),
  'add-preset':async type => { apply(await api.addDestination(currentId,type)); showSettings(); },
  'destination-icon':destinationIconForm,
  'add-website':websiteForm,
  'reuse-site':async () => {
    apply(await api.addDestination(currentId,'website',{id:modal.querySelector('#saved-site').value}));
    showSettings();
  },
  'toggle-destination':async id => {
    const dest = current().destinations.find(d => d.id === id);
    apply(await api.changeDestination(currentId,id,{enabled:!dest.enabled})); showSettings();
  },
  'manage-fields':id => { settingsDestination = id; showFields(); },
  'back-fields':showFields,
  'add-field':() => fieldForm(),
  'edit-field':id => fieldForm(destination().fields.find(f => f.id === id)),
  'new-item':() => openEditor(),
  'view-item':viewItem,
  'edit-item':id => openEditor(current().items.find(i => i.id === id)),
  'archive-item':async id => {
    if (!confirm('Archive this content? You can restore it in collection settings.')) return;
    const result = await api.archiveItem(currentId,id,true);
    modal.close(); apply(result);
  },
  'restore-item':async id => { apply(await api.archiveItem(currentId,id,false)); showSettings(); },
  'record-tab':id => { syncEditor(); selectedRecord = id; renderEditor(); },
  'pick-artwork':async () => {
    syncEditor();
    const result = await api.pickAsset('image');
    if (!result || !modal.open) return;
    editor.artwork = result.id;
    renderEditor();
  },
  'remove-artwork':() => { syncEditor(); editor.artwork = null; renderEditor(); },
  copy:async value => { await api.copy(value); notify('Copied to clipboard'); },
  'prev-month':() => changeMonth(-1),
  'next-month':() => changeMonth(1),
  today:() => { month = new Date(); selectedDay = keyDate(month); renderPage(); },
  day:key => { selectedDay = key; month = new Date(key + 'T12:00'); renderPage(); },
  plan:planForm,
  'calendar-item':value => { const [collection,id] = value.split(':'); currentId = collection; viewItem(id); },
};
for (const action of ['archive','restore','up','down']) {
  actions['field-' + action] = async id => {
    apply(await api.changeField(currentId,settingsDestination,id,action)); showFields();
  };
}
for (const action of ['pick-field-file','pick-field-image','use-shared','clear-file']) actions[action] = id => editRecordFile(action,id);
for (const action of ['mark-published','undo-published']) {
  actions[action] = async value => {
    const [collection,item,destination] = value.split(':');
    const published = action === 'mark-published';
    apply(await api.setPublication(collection,item,destination,published ? 'published' : 'undo',published ? localDateTime() : ''));
    if (modal.open) viewItem(item);
  };
}
function dispatchAction(name, value) {
  if (Object.hasOwn(actions,name)) return run(() => actions[name](value));
}

modal.addEventListener('click',event => {
  const target = event.target.closest('[data-action]');
  if (target) dispatchAction(target.dataset.action,target.dataset.value);
});
modal.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
modal.addEventListener('submit',event => {
  event.preventDefault();
  const form = event.target;
  if (!dialogAction || busy) return;
  const action = dialogAction;
  const submit = form.querySelector('[type=submit]');
  const error = form.querySelector('[data-error]');
  error.hidden = true;
  submit.disabled = true;
  run(async () => {
    try { await action(new FormData(form)); }
    finally { submit.disabled = false; }
  });
});
modal.addEventListener('change',event => {
  if (busy || !event.target.dataset.destination) return;
  syncEditor();
  const id = event.target.dataset.destination;
  let record = editor.records.find(r => r.id === id);
  if (!record) {
    const destination = current().destinations.find(d => d.id === id);
    record = newRecord(destination);
    editor.records.push(record);
  }
  record.selected = event.target.checked;
  if (record.selected) selectedRecord = id;
  else if (selectedRecord === id) selectedRecord = editor.records.find(r => r.selected)?.id ?? '';
  renderEditor();
});
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
