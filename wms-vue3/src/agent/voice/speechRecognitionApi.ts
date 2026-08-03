import { post } from '@/utils/request'

export interface SpeechTranscriptionResult {
  text: string
  provider: string
  duration_ms: number | null
}

export async function transcribeAgentSpeech(audio: Blob): Promise<SpeechTranscriptionResult> {
  const form = new FormData()
  form.append('file', audio, `wms-voice-${Date.now()}.wav`)
  const response = await post<SpeechTranscriptionResult>(
    '/api/v1/page-agent/speech/transcriptions',
    form,
    { timeout: 310_000 },
  )
  const result = response.data
  if (!result?.text?.trim()) throw new Error('语音识别未返回有效文字')
  return { ...result, text: result.text.trim() }
}
