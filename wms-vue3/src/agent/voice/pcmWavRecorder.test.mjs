import assert from 'node:assert/strict'
import test from 'node:test'
import { encodePcm16Wav, mergeAudioChunks, resampleAudio } from './pcmWavRecorder.ts'

test('merges and downsamples captured audio for speech recognition', () => {
  const input = mergeAudioChunks([
    new Float32Array([1, 1, 1]),
    new Float32Array([-1, -1, -1]),
  ])
  const output = resampleAudio(input, 48_000, 16_000)

  assert.equal(input.length, 6)
  assert.equal(output.length, 2)
  assert.equal(output[0], 1)
  assert.equal(output[1], -1)
})

test('encodes mono 16-bit 16kHz WAV data', async () => {
  const blob = encodePcm16Wav(new Float32Array([0, 1, -1]), 16_000)
  const view = new DataView(await blob.arrayBuffer())

  assert.equal(blob.type, 'audio/wav')
  assert.equal(blob.size, 50)
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 16_000)
  assert.equal(view.getUint16(34, true), 16)
})
