import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCropRotation, rotateCropBox } from './cropRotation.ts';

const rounded = box => box.map(value => Number(value.toFixed(8)));

test('a sideways crop can be rotated without changing its saved source region', () => {
  const source = [0.518, 0.12, 0.738, 0.845];
  assert.deepEqual(rounded(rotateCropBox(source, -90)), [0.12, 0.262, 0.845, 0.482]);
  for (const angle of [-90, 90, 180, 270]) {
    assert.deepEqual(rounded(rotateCropBox(rotateCropBox(source, angle), -angle)), source);
  }
});

test('a cropped fallback image can rotate from its already saved orientation', () => {
  const source = [0.11, 0.23, 0.71, 0.53];
  const previous = rotateCropBox(source, 270);
  assert.deepEqual(rounded(rotateCropBox(previous, normalizeCropRotation(90 - 270))),
    rounded(rotateCropBox(source, 90)));
});
