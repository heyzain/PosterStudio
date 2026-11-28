'use strict';
const {dateTime} = require('./destinations.cjs');

function dateOnly(value) {
  if (typeof value !== 'string' || value.length !== 10) throw new Error('Use a calendar date.');
  return dateTime(value);
}

function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(part => String(part).padStart(2, '0')).join('-');
}

function activeCollections(data) {
  return data.collections.filter(collection => !collection.archived);
}

function schedulePreview(data, {collectionId, start, intervalDays}) {
  dateOnly(start);
  if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
    throw new Error('Choose a gap between 1 and 365 days between posts.');
  }
  const collection = activeCollections(data).find(entry => entry.id === collectionId);
  if (!collection) throw new Error('Choose an active collection.');
  const destinations = new Map(collection.destinations.map(destination => [destination.id, destination]));
  const items = collection.items.filter(item => !item.archived).sort((a,b) => a.number - b.number);
  const date = new Date(start + 'T00:00:00Z');
  const rows = [];
  let postCount = 0;
  for (const item of items) {
    const records = item.records.filter(record => destinations.has(record.id) && record.selected &&
      record.status !== 'published' && (record.planned || record.status === 'ready'));
    if (!records.length) continue;
    const day = dateOnly(date.toISOString().split('T')[0]);
    postCount++;
    for (const record of records) {
      const planned = day + (record.planned?.slice(10) ?? '');
      if (planned === record.planned && record.status === 'scheduled') continue;
      rows.push({itemId:item.id, title:item.title, number:item.number, destinationId:record.id,
        destination:destinations.get(record.id).name, before:record.planned ?? '', status:record.status, planned});
    }
    date.setUTCDate(date.getUTCDate() + intervalDays);
  }
  return {name:collection.name, rows, postCount};
}

function findCollection(data, id, name) {
  const collections = activeCollections(data);
  if (name) {
    const matches = collections.filter(entry => entry.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (matches.length === 1) return matches[0].id;
    if (matches.some(entry => entry.id === id)) return id;
    throw new Error(matches.length ? 'Several collections have that name. Choose one in the collection picker.' :
      'Could not find that collection. Choose one in the collection picker and ask again.');
  }
  if (collections.some(entry => entry.id === id)) return id;
  if (collections.length === 1) return collections[0].id;
  throw new Error('Choose a collection in the picker or include its name in your message.');
}

function latestPublication(data, collectionId, query) {
  const search = query.trim().toLowerCase();
  let latest;
  let undated = 0;
  for (const collection of activeCollections(data)) {
    if (collectionId && collection.id !== collectionId) continue;
    const destinations = new Map(collection.destinations.map(destination => [destination.id, destination]));
    for (const item of collection.items) {
      if (item.archived) continue;
      for (const record of item.records) {
        if (!record.selected || record.status !== 'published') continue;
        const destination = destinations.get(record.id);
        if (!destination || (destination.type !== search && destination.name.trim().toLowerCase() !== search)) continue;
        const date = record.published || record.planned || '';
        if (!date) undated++;
        if (latest && (latest.date > date || (latest.date === date && latest.actual >= Boolean(record.published)))) continue;
        latest = {collection, item, destination, date, actual:Boolean(record.published)};
      }
    }
  }
  if (!latest || (!latest.date && undated > 1)) return {post:null, undated};
  const {collection, item, destination, date, actual} = latest;
  return {undated, post:{
    collectionId:collection.id, collectionName:collection.name, itemId:item.id, title:item.title,
    destinationId:destination.id, destination:destination.name, date, actual,
    others:item.records.filter(record => record.selected && record.id !== destination.id)
      .flatMap(record => {
        const other = collection.destinations.find(entry => entry.id === record.id);
        return other ? [{id:other.id, name:other.name, status:record.status, published:record.published}] : [];
      }),
  }};
}

module.exports = {dateOnly, today, schedulePreview, findCollection, latestPublication};
