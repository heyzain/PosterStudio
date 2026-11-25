'use strict';

function bitmapFrame(bytes, width, height, nativeImage) {
  if (bytes.length < 40) return null;
  const header = bytes.readUInt32LE(0);
  const depth = bytes.readUInt16LE(14);
  if (header < 40 || bytes.readInt32LE(4) !== width || bytes.readInt32LE(8) !== 2 * height ||
      bytes.readUInt16LE(12) !== 1 || ![24,32].includes(depth) || bytes.readUInt32LE(16) !== 0) return null;

  const pixelSize = depth / 8;
  const stride = Math.ceil(width * pixelSize / 4) * 4;
  const maskOffset = header + stride * height;
  const maskStride = Math.ceil(width / 32) * 4;
  if (maskOffset > bytes.length) return null;
  const hasMask = maskOffset + maskStride * height <= bytes.length;
  let hasAlpha = false;
  if (depth === 32) {
    for (let offset = header + 3; offset < maskOffset && !hasAlpha; offset += 4) hasAlpha = bytes[offset] !== 0;
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const source = header + row * stride + x * pixelSize;
      const target = (y * width + x) * 4;
      const masked = hasMask && (bytes[maskOffset + row * maskStride + (x >> 3)] & (0x80 >> (x % 8)));
      const alpha = hasAlpha ? bytes[source + 3] : masked ? 0 : 255;
      for (let channel = 0; channel < 3; channel++) {
        pixels[target + channel] = Math.round(bytes[source + channel] * alpha / 255);
      }
      pixels[target + 3] = alpha;
    }
  }
  return nativeImage.createFromBitmap(pixels,{width,height});
}

function decodeIcon(bytes, nativeImage, allowJpeg = false) {
  const candidates = [{bytes}];
  if (bytes.length >= 6 && bytes.readUInt32LE(0) === 0x00010000) {
    const count = bytes.readUInt16LE(4);
    const directoryEnd = 6 + count * 16;
    if (directoryEnd > bytes.length) return null;
    for (let i = 0; i < Math.min(count,24); i++) {
      const entry = 6 + i * 16;
      const length = bytes.readUInt32LE(entry + 8);
      const offset = bytes.readUInt32LE(entry + 12);
      if (offset >= directoryEnd && length && offset + length <= bytes.length) {
        candidates.push({bytes:bytes.subarray(offset,offset + length),width:bytes[entry] || 256,height:bytes[entry + 1] || 256});
      }
    }
    candidates.sort((a,b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  }
  for (const {bytes: candidate,width,height} of candidates) {
    const png = candidate.length >= 24 && candidate.subarray(0,8).toString('hex') === '89504e470d0a1a0a';
    const jpeg = candidate.length >= 3 && candidate.subarray(0,3).toString('hex') === 'ffd8ff';
    if (png && (candidate.readUInt32BE(16) > 512 || candidate.readUInt32BE(20) > 512)) continue;
    const image = png || (allowJpeg && jpeg) ? nativeImage.createFromBuffer(candidate) :
      width && bitmapFrame(candidate,width,height,nativeImage);
    if (!image) continue;
    const size = image.getSize();
    if (!size.width || !size.height || size.width > 512 || size.height > 512) continue;
    const normalized = Math.max(size.width,size.height) > 96 ?
      image.resize(size.width >= size.height ? {width:96} : {height:96}) : image;
    return normalized.toPNG();
  }
  return null;
}

module.exports = {decodeIcon};
