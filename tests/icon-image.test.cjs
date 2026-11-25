'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {decodeIcon} = require('../app/icon-image.cjs');

function bitmapIcon() {
  const icon = Buffer.alloc(22 + 40 + 16 + 8);
  icon.writeUInt16LE(1,2);
  icon.writeUInt16LE(1,4);
  icon[6] = icon[7] = 2;
  icon.writeUInt32LE(icon.length - 22,14);
  icon.writeUInt32LE(22,18);
  icon.writeUInt32LE(40,22);
  icon.writeInt32LE(2,26);
  icon.writeInt32LE(4,30);
  icon.writeUInt16LE(1,34);
  icon.writeUInt16LE(32,36);
  return icon;
}

const nativeImage = {
  createFromBitmap(pixels, size) {
    assert.deepEqual(size,{width:2,height:2});
    return {getSize:() => size, toPNG:() => pixels};
  },
};

test('bitmap ICO frames decode bottom-up and preserve partial alpha',() => {
  const icon = bitmapIcon();
  Buffer.from([0,90,100,255, 0,0,200,128, 200,100,0,128, 200,200,200,0]).copy(icon,62);
  assert.deepEqual(decodeIcon(icon,nativeImage),Buffer.from([
    100,50,0,128, 0,0,0,0, 0,90,100,255, 0,0,100,128,
  ]));
});

test('legacy bitmap ICOs use the transparency mask and malformed frames are rejected',() => {
  const icon = bitmapIcon();
  Buffer.from([10,20,30,0]).copy(icon,62);
  Buffer.from([60,70,80,0]).copy(icon,70);
  icon[78] = 0x80;
  const pixels = decodeIcon(icon,nativeImage);
  assert.deepEqual(pixels.subarray(0,4),Buffer.from([60,70,80,255]));
  assert.deepEqual(pixels.subarray(8,12),Buffer.alloc(4));
  assert.equal(decodeIcon(icon.subarray(0,70),nativeImage),null);
  icon.writeUInt32LE(6,18);
  assert.equal(decodeIcon(icon,nativeImage),null);
});
