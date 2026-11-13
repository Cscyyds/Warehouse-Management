/**
 * 验证码发送公共逻辑（2026-09-29 双通道批次抽公共，替代 Profile/ChangePassword 两页重复实现）：
 * - 图形验证码加载/刷新（发送成功与失败后均自动刷新）；
 * - 60 秒发送冷却（后端口径：邮箱/短信共享，倒计时秒数取响应 expires_in_seconds）；
 * - 双通道发送：EMAIL（发当前绑定邮箱）/ SMS（发当前绑定手机号，响应 mobile 为脱敏号）；
 * - supportedChannels：purposes 接口下发的服务端支持通道（SMS 是否开启由发送时 503 把关，
 *   本列表不随 SMS_ENABLED 变化，选项禁用与否由页面按账号绑定情况约束）。
 * sendCode 失败（含 429 冷却 / 503 短信未开启）返回 null，错误文案由 request 拦截器统一透出。
 */
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCaptcha, getVerificationPurposes, sendVerificationCode, type VerificationChannel, type VerificationCodeSendData } from '@/api'

const DEFAULT_COOLDOWN = 60

export function useVerificationCode() {
  const captchaId = ref('')
  const captchaImg = ref('')
  const captchaCode = ref('')
  const sendingCode = ref(false)
  const countdown = ref(0)
  const supportedChannels = ref<VerificationChannel[]>(['EMAIL'])
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  async function refreshCaptcha() {
    try {
      const res = await getCaptcha()
      captchaImg.value = res.data.image_data
      captchaId.value = res.data.captcha_id
      captchaCode.value = ''
    } catch {
      // 错误已由 request 拦截器统一处理
    }
  }

  async function loadSupportedChannels() {
    try {
      const res = await getVerificationPurposes()
      const channels = res.data?.supported_channels
      if (Array.isArray(channels) && channels.length) {
        supportedChannels.value = channels as VerificationChannel[]
      }
    } catch {
      // 拉取失败按缺省 EMAIL 通道兜底
    }
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function startCountdown(seconds: number) {
    countdown.value = seconds
    stopCountdown()
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) stopCountdown()
    }, 1000)
  }

  /** 重置验证态（切换验证目标字段时用）；verificationCode 属于页面表单状态，由页面自行清理 */
  function resetState() {
    captchaImg.value = ''
    captchaId.value = ''
    captchaCode.value = ''
    countdown.value = 0
    stopCountdown()
  }

  async function sendCode(purpose: string, channel: VerificationChannel): Promise<VerificationCodeSendData | null> {
    if (countdown.value > 0 || sendingCode.value) return null
    if (!captchaId.value || !captchaCode.value.trim()) {
      ElMessage.warning('请先填写图形验证码')
      return null
    }
    sendingCode.value = true
    try {
      const res = await sendVerificationCode({
        purpose,
        channel,
        captcha_id: captchaId.value,
        captcha_code: captchaCode.value.trim(),
      })
      const data = res.data as VerificationCodeSendData
      // 双通道提示：短信为脱敏手机号（138****1111），邮箱为绑定邮箱
      const target = data.channel === 'SMS'
        ? (data.mobile || '当前绑定手机号')
        : (data.email || '当前绑定邮箱')
      ElMessage.success(`验证码已发送至${target}，请注意查收`)
      await refreshCaptcha()
      startCountdown(data.expires_in_seconds || DEFAULT_COOLDOWN)
      return data
    } catch {
      await refreshCaptcha()
      return null
    } finally {
      sendingCode.value = false
    }
  }

  onBeforeUnmount(stopCountdown)

  return {
    captchaId,
    captchaImg,
    captchaCode,
    sendingCode,
    countdown,
    supportedChannels,
    refreshCaptcha,
    loadSupportedChannels,
    sendCode,
    resetState,
  }
}
