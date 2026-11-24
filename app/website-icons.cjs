'use strict';
const https = require('node:https');
const http = require('node:http');
const dns = require('node:dns/promises');
const {isIP} = require('node:net');
const {webUrl} = require('./destinations.cjs');

function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a,b,c] = address.split('.').map(Number);
  return a > 0 && a < 224 && ![10,127].includes(a) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) && !(a === 203 && b === 0 && c === 113);
}

async function resolvePublic(url, lookup = dns.lookup) {
  if (url.port || url.hostname.endsWith('.local') || !url.hostname.includes('.')) throw new Error('Use a public website on a standard port.');
  const results = await lookup(url.hostname,{all:true, family:4});
  if (!results.length || results.some(({address}) => !publicIPv4(address))) throw new Error('Website address is unavailable.');
  return results[0].address;
}

function fetchBounded(url, address, signal, limit) {
  return new Promise((resolve,reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url,{
      signal, agent:false, family:4, autoSelectFamily:false,
      lookup:(_host,_options,callback) => callback(null,address,4),
      headers:{Accept:'image/png,image/jpeg,image/webp,image/x-icon,text/html'},
    }, response => {
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > limit) {
        response.destroy();
        resolve(null);
        return;
      }
      const chunks = [];
      let length = 0;
      response.on('data', chunk => {
        length += chunk.length;
        if (length > limit) {
          request.destroy(new Error('The website response is too large.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({bytes:Buffer.concat(chunks),type:response.headers['content-type'] ?? ''}));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

function iconPath(html, page) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(([,name,quoted,single,bare]) => [name.toLowerCase(),quoted ?? single ?? bare]));
    if (!attributes.rel?.toLowerCase().split(/\s+/).includes('icon') || !attributes.href) continue;
    try {
      const url = new URL(attributes.href,page);
      if (url.origin === page.origin && !url.username && !url.password) return url;
    } catch {}
  }
  return null;
}

async function websiteIcon(value, decode, dependencies = {}) {
  const page = new URL(webUrl(value));
  const signal = AbortSignal.timeout(4500);
  const get = dependencies.fetch ?? fetchBounded;
  const address = await new Promise((resolve,reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    resolvePublic(page,dependencies.lookup).then(resolve,reject).finally(() => signal.removeEventListener('abort',abort));
  });
  const fallback = new URL('/favicon.ico',page);
  // Keep requests on the same checked origin. Redirects and off-site icon links fall back to a local icon.
  const direct = await get(fallback,address,signal,512 * 1024).catch(() => null);
  const decoded = direct && decode(direct.bytes);
  if (decoded) return decoded;
  const response = await get(page,address,signal,256 * 1024).catch(() => null);
  if (!response?.type.toLowerCase().startsWith('text/html')) return null;
  const icon = iconPath(response.bytes.toString('utf8'),page);
  if (!icon || icon.href === fallback.href) return null;
  const candidate = await get(icon,address,signal,512 * 1024);
  return candidate && decode(candidate.bytes);
}
module.exports = {websiteIcon};
