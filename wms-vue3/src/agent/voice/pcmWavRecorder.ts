const TARGET_SAMPLE_RATE = 16_000

type AudioContextConstructor = typeof AudioContext

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext
    || (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
}

export function mergeAudioChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

export function resampleAudio(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = TARGET_SAMPLE_RATE,
): Float32Array {
  if (!input.length || inputSampleRate === outputSampleRate) return input.slice()
  if (inputSampleRate < outputSampleRate) {
    const outputLength = Math.max(1, Math.round(input.length * outputSampleRate / inputSampleRate))
    const output = new Float32Array(outputLength)
    const ratio = inputSampleRate / outputSampleRate
    for (let index = 0; index < outputLength; index += 1) {
      const sourcePosition = index * ratio
      const left = Math.floor(sourcePosition)
      const right = Math.min(left + 1, input.length - 1)
      const weight = sourcePosition - left
      output[index] = input[left] * (1 - weight) + input[right] * weight
    }
    return output
  }

  // Downsampling by averaging each source window reduces aliasing for speech.
  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outputLength)
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.max(start + 1, Math.min(input.length, Math.floor((index + 1) * ratio)))
    let sum = 0
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += input[sourceIndex]
    }
    output[index] = sum / (end - start)
  }
  return output
}

export function encodePcm16Wav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Blob {
  const bytesPerSample = 2
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  function writeAscii(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = 44
  for (const sample of samples) {
    const normalized = Math.max(-1, Math.min(1, sample))
    view.setInt16(
      offset,
      normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff,
      true,
    )
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function encodePcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  let offset = 0
  for (const sample of samples) {
    const normalized = Math.max(-1, Math.min(1, sample))
    view.setInt16(
      offset,
      normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff,
      true,
    )
    offset += 2
  }
  return buffer
}

export class PcmStreamRecorder {
  private stream?: MediaStream
  private context?: AudioContext
  private source?: MediaStreamAudioSourceNode
  private processor?: ScriptProcessorNode
  private silentGain?: GainNode
  private readonly onChunk: (chunk: ArrayBuffer) => void

  constructor(onChunk: (chunk: ArrayBuffer) => void) {
    this.onChunk = onChunk
  }

  static isSupported(): boolean {
    return PcmWavRecorder.isSupported()
  }

  async start(): Promise<void> {
    if (!PcmStreamRecorder.isSupported()) {
      throw new Error('当前浏览器不支持麦克风录音')
    }
    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) throw new Error('当前浏览器不支持音频处理')

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      this.context = new AudioContextClass()
      await this.context.resume()
      this.source = this.context.createMediaStreamSource(this.stream)
      this.processor = this.context.createScriptProcessor(4096, 1, 1)
      this.silentGain = this.context.createGain()
      this.silentGain.gain.value = 0
      this.processor.onaudioprocess = (event) => {
        const sourceSamples = new Float32Array(event.inputBuffer.getChannelData(0))
        const samples = resampleAudio(sourceSamples, this.context?.sampleRate || TARGET_SAMPLE_RATE)
        if (samples.length) this.onChunk(encodePcm16(samples))
      }
      this.source.connect(this.processor)
      this.processor.connect(this.silentGain)
      this.silentGain.connect(this.context.destination)
    } catch (error) {
      await this.cancel()
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('麦克风权限被拒绝，请在浏览器中允许访问麦克风')
      }
      throw error
    }
  }

  async stop(): Promise<void> {
    await this.release()
  }

  async cancel(): Promise<void> {
    await this.release()
  }

  private async release(): Promise<void> {
    if (this.processor) this.processor.onaudioprocess = null
    this.source?.disconnect()
    this.processor?.disconnect()
    this.silentGain?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.stream = undefined
    this.context = undefined
    this.source = undefined
    this.processor = undefined
    this.silentGain = undefined
  }
}

export class PcmWavRecorder {
  private stream?: MediaStream
  private context?: AudioContext
  private source?: MediaStreamAudioSourceNode
  private processor?: ScriptProcessorNode
  private silentGain?: GainNode
  private chunks: Float32Array[] = []

  static isSupported(): boolean {
    const mediaDevices = typeof navigator === 'undefined'
      ? undefined
      : (navigator as unknown as {
          mediaDevices?: { getUserMedia?: unknown }
        }).mediaDevices
    return !!(
      mediaDevices
      && typeof mediaDevices.getUserMedia === 'function'
      && getAudioContextConstructor()
    )
  }

  async start(): Promise<void> {
    if (!PcmWavRecorder.isSupported()) {
      throw new Error('当前浏览器不支持麦克风录音')
    }

    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) throw new Error('当前浏览器不支持音频处理')

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      this.context = new AudioContextClass()
      await this.context.resume()
      this.source = this.context.createMediaStreamSource(this.stream)
      this.processor = this.context.createScriptProcessor(4096, 1, 1)
      this.silentGain = this.context.createGain()
      this.silentGain.gain.value = 0
      this.chunks = []
      this.processor.onaudioprocess = (event) => {
        this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
      }
      this.source.connect(this.processor)
      this.processor.connect(this.silentGain)
      this.silentGain.connect(this.context.destination)
    } catch (error) {
      await this.cancel()
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('麦克风权限被拒绝，请在浏览器中允许访问麦克风')
      }
      throw error
    }
  }

  async stop(): Promise<Blob> {
    const inputSampleRate = this.context?.sampleRate || TARGET_SAMPLE_RATE
    const samples = mergeAudioChunks(this.chunks)
    await this.release()
    const resampled = resampleAudio(samples, inputSampleRate)
    return encodePcm16Wav(resampled)
  }

  async cancel(): Promise<void> {
    this.chunks = []
    await this.release()
  }

  private async release(): Promise<void> {
    if (this.processor) this.processor.onaudioprocess = null
    this.source?.disconnect()
    this.processor?.disconnect()
    this.silentGain?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.stream = undefined
    this.context = undefined
    this.source = undefined
    this.processor = undefined
    this.silentGain = undefined
  }
}
