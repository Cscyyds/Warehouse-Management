export const FINANCE_SECTION_NAVIGATION_REQUEST =
  'wms-agent:finance-section-navigation-request'
export const FINANCE_SECTION_NAVIGATION_RESULT =
  'wms-agent:finance-section-navigation-result'

export interface FinanceSectionNavigationRequestDetail {
  requestId: string
}

export interface FinanceSectionNavigationResultDetail {
  requestId: string
  ok: boolean
  message: string
}

function abortError(): DOMException {
  return new DOMException('财务管理定位已停止', 'AbortError')
}

export function navigateToFinanceSection(
  signal: AbortSignal,
  timeoutMs = 1500,
): Promise<string> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('当前环境无法定位财务管理'))
  }
  if (signal.aborted) return Promise.reject(abortError())

  const requestId = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener(FINANCE_SECTION_NAVIGATION_RESULT, handleResult)
      signal.removeEventListener('abort', handleAbort)
      window.clearTimeout(timer)
    }

    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<FinanceSectionNavigationResultDetail>).detail
      if (!detail || detail.requestId !== requestId) return

      cleanup()
      if (detail.ok) resolve(detail.message)
      else reject(new Error(detail.message || '财务管理定位失败'))
    }

    const handleAbort = () => {
      cleanup()
      reject(abortError())
    }

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('财务管理定位超时，请稍后重试'))
    }, timeoutMs)

    window.addEventListener(FINANCE_SECTION_NAVIGATION_RESULT, handleResult)
    signal.addEventListener('abort', handleAbort, { once: true })
    window.dispatchEvent(
      new CustomEvent<FinanceSectionNavigationRequestDetail>(
        FINANCE_SECTION_NAVIGATION_REQUEST,
        { detail: { requestId } },
      ),
    )
  })
}
