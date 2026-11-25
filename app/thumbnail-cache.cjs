'use strict';
const fs = require('node:fs/promises');

const sizes = Object.freeze({ small: 160, cover: 768 });

function createThumbnailCache(nativeImage, platform = process.platform) {
  const cache = new Map();
  const pending = new Map();
  const budget = 16 * 1024 * 1024;
  let cacheBytes = 0;
  let last = Promise.resolve();

  async function render(file, size) {
    const original = await fs.readFile(file);
    const jpeg = file.endsWith('.jpg');
    let image = nativeImage.createFromBuffer(original);
    if (image.isEmpty() && file.endsWith('.webp') && ['win32','darwin'].includes(platform)) {
      image = await nativeImage.createThumbnailFromPath(file, {width:size,height:size}).catch(() => null);
    }
    if (!image || image.isEmpty()) return null;
    const {width,height} = image.getSize();
    if (Math.max(width,height) > size) {
      image = image.resize(width >= height ? {width:size,quality:'good'} : {height:size,quality:'good'});
    }
    const bytes = jpeg ? image.toJPEG(82) : image.toPNG();
    return bytes.length > 0 && bytes.length < original.length
      ? {bytes,type:jpeg ? 'image/jpeg' : 'image/png'} : null;
  }

  return function thumbnail(file, variant) {
    if (!Object.hasOwn(sizes,variant)) throw new Error('Unknown thumbnail size.');
    const key = `${variant}:${file}`;
    if (cache.has(key)) {
      const result = cache.get(key);
      cache.delete(key);
      cache.set(key,result);
      return Promise.resolve(result);
    }
    if (pending.has(key)) return pending.get(key);
    const task = last.then(async () => {
      const result = await render(file,sizes[variant]);
      const bytes = result?.bytes.length ?? 0;
      if (bytes > budget) return result;
      while (cacheBytes + bytes > budget || cache.size >= 256) {
        const oldest = cache.keys().next().value;
        cacheBytes -= cache.get(oldest)?.bytes.length ?? 0;
        cache.delete(oldest);
      }
      cache.set(key,result);
      cacheBytes += bytes;
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key,task);
    last = task.catch(() => {});
    return task;
  };
}

module.exports = {createThumbnailCache};
