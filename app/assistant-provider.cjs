'use strict';
const fs = require('node:fs/promises');
const {randomUUID} = require('node:crypto');
const {dateOnly} = require('./assistant-schedule.cjs');

const collectionName = {type:'string', description:'Exact collection name only if typed by the user.'};
const useSelectedCollection = {type:'boolean', description:'True only when the user asks for the current or selected collection.'};
const tool = (name, description, properties, required) => ({type:'function', function:{
  name, description, parameters:{type:'object', properties, required, additionalProperties:false},
}});
const tools = [
  tool('pending_publications', 'Look up pending publications for one calendar day.', {
    date:{type:'string', description:'YYYY-MM-DD'}, collectionName,
    useSelectedCollection,
  }, ['date']),
  tool('preview_collection_schedule', 'Preview rescheduling the pending posts of one collection in post-number order.', {
    start:{type:'string', description:'YYYY-MM-DD for the first post'}, collectionName,
    intervalDays:{type:'integer', description:'Days between posts. Skipping one day means 2. Daily means 1.'},
  }, ['start','intervalDays']),
  tool('latest_publication', 'Find the latest published post on a destination and show the other destinations on the same post. Use for questions like "LinkedIn pe last post kab ki thi aur us ke saath aur konsa platform tha?"', {
    destination:{type:'string', description:'Platform type or destination name, e.g. LinkedIn, Facebook, Pinterest, or a named website.'},
    collectionName, useSelectedCollection,
  }, ['destination']),
];
const keyPattern = /^sk-or-[A-Za-z0-9_-]{12,240}$/;

function providerError(code) {
  if (code === 401 || code === 403) return new Error('OpenRouter rejected the key. Check it in Settings.');
  if (code === 429) return new Error('OpenRouter is rate limiting requests. Try again later.');
  return new Error('OpenRouter is temporarily unavailable. Try again later.');
}

function assistantProvider(file, safeStorage, request = fetch) {
  const canEncrypt = () => safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || !['basic_text','unknown'].includes(safeStorage.getSelectedStorageBackend()));
  async function readKey() {
    const encrypted = await fs.readFile(file).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (!encrypted) throw new Error('Add your OpenRouter key in Settings to send a message.');
    if (!canEncrypt()) throw new Error('Secure key storage is unavailable. Unlock your system key store and try again.');
    try {
      const key = safeStorage.decryptString(encrypted);
      if (keyPattern.test(key)) return key;
    } catch { /* Let Settings replace a key that can no longer be read. */ }
    throw new Error('Open Settings and replace the saved OpenRouter key.');
  }
  return {
    async settings() {
      const configured = await fs.stat(file).then(() => true, error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      });
      return {configured, secureStorage:canEncrypt()};
    },
    async saveKey(value) {
      if (value === '') return fs.rm(file, {force:true});
      const key = typeof value === 'string' ? value.trim() : '';
      if (!keyPattern.test(key)) throw new Error('Enter a valid OpenRouter API key.');
      if (!canEncrypt()) throw new Error('Secure key storage is unavailable on this device.');
      const staged = file + '.' + randomUUID() + '.tmp';
      try {
        await fs.writeFile(staged, safeStorage.encryptString(key), {flag:'wx', mode:0o600});
        await fs.rename(staged, file);
      } finally { await fs.rm(staged, {force:true}).catch(() => {}); }
    },
    async interpret(messages, currentDay) {
      if (!Array.isArray(messages) || !messages.length || messages.length > 6 ||
          messages.some(message => typeof message !== 'string' || !message.trim() || message.length > 1200 || /sk-or-[a-z0-9_-]{12,}/i.test(message))) {
        throw new Error('Use messages up to 1,200 characters and enter API keys only in Settings.');
      }
      const key = await readKey();
      let response;
      try {
        response = await request('https://openrouter.ai/api/v1/chat/completions', {
          method:'POST', redirect:'error', signal:AbortSignal.timeout(25000),
          headers:{Authorization:'Bearer ' + key, 'Content-Type':'application/json'},
          body:JSON.stringify({
            model:'openrouter/free', max_tokens:700, tools,
            messages:[{role:'system', content:`You interpret Poster Studio schedule requests. The local date is ${currentDay}.
Understand English and Roman Urdu. "Aaj" is today, "kal" in a future schedule is tomorrow, "parson" in a future schedule is two days from today. "Aik din chor ke" means every other day.
Interpret the latest message. Use earlier user messages to resolve follow-ups such as a correction to the start date.
Call exactly one tool for supported requests. Default to today when no date was given. For rescheduling, default to one post per day when no interval was given.
Omit the collection name unless the user actually typed a specific name. If a request is unsupported or ambiguous, respond without calling a tool.`},
            ...messages.map(content => ({role:'user',content}))],
          }),
        });
      } catch { throw new Error('Could not reach OpenRouter. Check your connection and try again.'); }
      if (!response.ok) throw providerError(response.status);
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error('Could not read the OpenRouter response. Try again.'); }
      const choice = payload?.choices?.[0];
      const error = payload?.error ?? choice?.error;
      if (error) throw providerError(error.code);
      if (!choice?.message) throw new Error('Could not read the OpenRouter response. Try again.');
      const calls = choice.message.tool_calls;
      if (!Array.isArray(calls) || calls.length !== 1) return null;
      try {
        const call = calls[0].function;
        const args = JSON.parse(call.arguments);
        if (args.collectionName !== undefined && (typeof args.collectionName !== 'string' || args.collectionName.length > 150)) return null;
        const collection = args.collectionName?.trim() || '';
        if (call.name === 'pending_publications') {
          return {type:'agenda', date:dateOnly(args.date), collection, useSelectedCollection:args.useSelectedCollection === true};
        }
        if (call.name === 'preview_collection_schedule' && Number.isInteger(args.intervalDays)) {
          return {type:'schedule', start:dateOnly(args.start), intervalDays:args.intervalDays, collection};
        }
        if (call.name === 'latest_publication' && typeof args.destination === 'string' &&
            args.destination.trim() && args.destination.length <= 150) {
          return {type:'history', destination:args.destination.trim(), collection, useSelectedCollection:args.useSelectedCollection === true};
        }
      } catch { /* Unexpected arguments cannot trigger an action. */ }
      return null;
    },
  };
}

module.exports = {assistantProvider};
