'use strict';
const {randomUUID} = require('node:crypto');

const presets = {
  facebook: ['Facebook', 'f', [['Caption','long'], ['Image','file']]],
  instagram: ['Instagram', 'IG', [['Caption','long'], ['Hashtags','tags'], ['Image','file']]],
  pinterest: ['Pinterest', 'P', [['Pin title','text'], ['Description','long'], ['Tags','tags'], ['Board','text'], ['Image','file']]],
  linkedin: ['LinkedIn', 'in', [['Post text','long'], ['Image','file'], ['Link','url'], ['Hashtags','tags']]],
  youtube: ['YouTube', 'YT', [['Video title','text'], ['Description','long'], ['Tags','tags'], ['Video','file'], ['Thumbnail','file']]],
  x: ['X', 'X', [['Post text','long'], ['Image','file'], ['Link','url']]],
  threads: ['Threads', 'Th', [['Post text','long'], ['Image','file'], ['Link','url']]],
  website: ['Custom website', '◎', []],
};
const types = ['text','long','url','tags','number','datetime','select','checkbox','file'];
const statuses = ['draft','ready','scheduled','published'];
const idPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const assetPattern = /^[a-f\d-]{36}\.(png|jpg|webp|bin)$/;
const text = (value, limit, label) => {
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid ' + label + '.');
  return value;
};
function label(value, limit, name) {
  const result = text(value, limit, name).trim();
  if (!result) throw new Error(name + ' is required.');
  return result;
}
function webUrl(value) {
  const url = new URL(text(value, 2048, 'URL'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS URL without credentials.');
  }
  return url.href;
}
function dateTime(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) throw new Error('Invalid date or time.');
  const iso = value.length === 10 ? value + 'T00:00' : value;
  const parsed = new Date(iso + ':00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,16) !== iso) throw new Error('Invalid date or time.');
  return value;
}
function fieldValue(field, value, artwork, required = false) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
    if (required && field.required) throw new Error(field.label + ' is required.');
    return null;
  }
  const invalid = () => { throw new Error('Invalid value for ' + field.label + '.'); };
  switch (field.type) {
    case 'text':
    case 'long': {
      const result = text(value, field.maxLength ?? (field.type === 'text' ? 1000 : 40000), field.label);
      if (required && field.required && !result.trim()) throw new Error(field.label + ' is required.');
      return result;
    }
    case 'url': return webUrl(value);
    case 'tags':
      if (!Array.isArray(value) || value.length > 100) return invalid();
      return value.map(tag => label(tag, 150, 'Tag'));
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value) || (field.min != null && value < field.min) ||
          (field.max != null && value > field.max)) return invalid();
      return value;
    case 'datetime': return dateTime(value);
    case 'select':
      if (!field.options.some(option => option.id === value)) return invalid();
      return value;
    case 'checkbox':
      if (typeof value !== 'boolean' || (required && field.required && !value)) return invalid();
      return value;
    case 'file':
      if (value === 'shared' && (!required || !field.required || artwork)) return value;
      if (value && assetPattern.test(value.id) && typeof value.name === 'string' && value.name.length <= 255) {
        return {id:value.id, name:value.name};
      }
      return invalid();
    default: return invalid();
  }
}
function cleanField(input, previous) {
  if (!types.includes(input.type) || (previous && previous.type !== input.type)) {
    throw new Error('Choose a field type when creating a field. Add a replacement to change the type.');
  }
  const field = {
    id:previous?.id ?? randomUUID(), type:input.type,
    label:label(input.label, 100, 'Field label'), description:text(input.description ?? '', 500, 'field description'),
    required:input.required === true, archived:previous?.archived ?? false,
  };
  if (['text','long'].includes(field.type) && input.maxLength != null) {
    if (!Number.isInteger(input.maxLength) || input.maxLength < 1 || input.maxLength > 40000) throw new Error('Invalid maximum length.');
    field.maxLength = input.maxLength;
  }
  if (field.type === 'number') {
    for (const key of ['min','max']) {
      if (input[key] != null && !Number.isFinite(input[key])) throw new Error('Invalid number limit.');
      if (input[key] != null) field[key] = input[key];
    }
    if (field.min != null && field.max != null && field.min > field.max) throw new Error('Minimum exceeds maximum.');
  }
  if (field.type === 'select') {
    if (!Array.isArray(input.options) || input.options.length > 100) throw new Error('Invalid select options.');
    const known = new Map(previous?.options.map(option => [option.id, option]) ?? []);
    const seen = new Set();
    field.options = input.options.map(option => {
      const old = known.get(option.id);
      const id = old?.id ?? randomUUID();
      if (seen.has(id)) throw new Error('Duplicate option.');
      seen.add(id);
      return {id, label:label(option.label, 100, 'Option label'), archived:option.archived === true};
    });
    for (const old of known.values()) if (!seen.has(old.id)) field.options.push({...old, archived:true});
  }
  if (input.defaultOptionIndex != null && (field.type !== 'select' ||
      !Number.isInteger(input.defaultOptionIndex) || !input.options[input.defaultOptionIndex])) {
    throw new Error('Invalid default option.');
  }
  const fallback = input.defaultOptionIndex == null ? input.defaultValue ?? null : field.options[input.defaultOptionIndex].id;
  if (field.type === 'file' && fallback != null && fallback !== 'shared') throw new Error('File defaults can reference the shared image.');
  field.defaultValue = fieldValue(field, fallback, true);
  if (field.type === 'select' && field.options.some(option => option.id === field.defaultValue && option.archived)) field.defaultValue = null;
  return field;
}
function createDestination(type) {
  if (!Object.hasOwn(presets, type)) throw new Error('Unknown destination preset.');
  const [name, mark, definitions] = presets[type];
  return {
    id:randomUUID(), type, name, mark, enabled:true, description:'', url:'', icon:null,
    fields:definitions.map(([name, type]) => cleanField({label:name, type, defaultValue:name === 'Image' ? 'shared' : null})),
  };
}
module.exports = {presets, types, statuses, idPattern, assetPattern, text, label, webUrl, dateTime, fieldValue, cleanField, createDestination};
