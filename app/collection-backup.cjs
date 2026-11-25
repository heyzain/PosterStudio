'use strict';
const fs = require('node:fs/promises');
const {createReadStream} = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {idPattern, presets, types, statuses, dateTime, webUrl} = require('./destinations.cjs');

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const isId = value => isString(value) && idPattern.test(value);
const hasUnique = (entries, key) => new Set(entries.map(entry => entry[key])).size === entries.length;
const isTimestamp = value => isString(value) && Number.isFinite(Date.parse(value));

function requireBackup(condition) {
  if (!condition) throw new Error('This file is not a supported Poster Studio collection backup.');
}

async function backupAssetChecksum(file) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    size += chunk.length;
    if (size > 30 * 1024 * 1024) throw new Error('Invalid asset size.');
    hash.update(chunk);
  }
  if (!size) throw new Error('Invalid asset size.');
  return hash.digest('hex');
}

async function readCollectionBackup(file, validAsset) {
  const info = await fs.lstat(file);
  requireBackup(info.isFile() && info.size <= 128 * 1024 * 1024);
  let backup;
  try { backup = JSON.parse(await fs.readFile(file,'utf8')); }
  catch (error) { if (!(error instanceof SyntaxError)) throw error; requireBackup(false); }
  const collection = backup?.collection;
  const image = id => id == null || (validAsset(id) && !id.endsWith('.bin'));
  const validDate = value => isString(value) && dateTime(value) === value;
  const validUrl = value => isString(value) && (!value || Boolean(webUrl(value)));
  const validValue = value => value == null || ['string','number','boolean'].includes(typeof value) ||
    (Array.isArray(value) && value.every(isString)) ||
    (isObject(value) && validAsset(value.id) && isString(value.name));
  requireBackup(backup?.version === 2 && isObject(collection) && isId(collection.id) &&
    isString(collection.name) && collection.name.trim() && isString(collection.description) && image(collection.cover) &&
    image(collection.icon) && Array.isArray(collection.items) && Array.isArray(collection.destinations));

  for (const destination of collection.destinations) {
    requireBackup(isObject(destination) && isId(destination.id) && Object.hasOwn(presets,destination.type) &&
      isString(destination.name) && isString(destination.description) && validUrl(destination.url) &&
      (destination.type !== 'website' || destination.url) && image(destination.icon) && Array.isArray(destination.fields));
    for (const field of destination.fields) {
      requireBackup(isObject(field) && isId(field.id) && types.includes(field.type) && isString(field.label) &&
        isString(field.description) && validValue(field.defaultValue));
      if (field.type === 'select') {
        requireBackup(Array.isArray(field.options) && field.options.every(option => isObject(option) &&
          isId(option.id) && isString(option.label)) && hasUnique(field.options,'id'));
      }
    }
    requireBackup(hasUnique(destination.fields,'id'));
  }
  requireBackup(hasUnique(collection.destinations,'id'));
  const destinations = new Set(collection.destinations.map(destination => destination.id));
  let lastNumber = 0;
  for (const item of collection.items) {
    requireBackup(isObject(item) && isId(item.id) && Number.isSafeInteger(item.number) && item.number > 0 &&
      isString(item.title) && isString(item.master) && isString(item.notes) && image(item.artwork) &&
      isTimestamp(item.created) && isTimestamp(item.updated) && ['draft','ready'].includes(item.stage) && Array.isArray(item.records));
    lastNumber = Math.max(lastNumber,item.number);
    for (const record of item.records) {
      requireBackup(isObject(record) && destinations.has(record.id) && statuses.includes(record.status) &&
        validDate(record.planned) && validDate(record.published) && validUrl(record.url) &&
        isObject(record.values) && Object.values(record.values).every(validValue));
      const prior = record.beforePublication;
      if (prior != null) requireBackup(isObject(prior) && ['draft','ready','scheduled'].includes(prior.status) &&
        validDate(prior.planned) && validDate(prior.published));
    }
    requireBackup(hasUnique(item.records,'id'));
  }
  requireBackup(hasUnique(collection.items,'id') && hasUnique(collection.items,'number') &&
    Number.isSafeInteger(collection.nextNumber) && collection.nextNumber > lastNumber);

  const checksums = backup.assetChecksums;
  if (checksums !== undefined) {
    requireBackup(isObject(checksums) && Object.entries(checksums).every(([id,hash]) =>
      validAsset(id) && isString(hash) && /^[a-f\d]{64}$/.test(hash)));
  }
  return {collection, checksums, assetDirectory:path.join(path.dirname(file),'assets')};
}

module.exports = {readCollectionBackup, backupAssetChecksum};
