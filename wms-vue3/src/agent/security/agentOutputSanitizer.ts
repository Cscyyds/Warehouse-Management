const absoluteUrlPattern = /\bhttps?:\/\/[^\s<>"'`，。！？；、（）()\[\]{}]+/giu
const localAddressPattern = /\b(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?\/[^\s<>"'`，。！？；、（）()\[\]{}]*/giu
const internalPageRoutePattern = /\/(?:#\/)?wms(?:\/[A-Za-z0-9._~!$&()*+=:@%?#-]+)*/giu
const internalApiRoutePattern = /\/api(?:\/[A-Za-z0-9._~!$&()*+=:@%?#-]+)*/giu

function redactAbsoluteUrl(value: string): string {
  try {
    return new URL(value).pathname.startsWith('/api/') ? '内部地址' : '当前页面'
  } catch {
    return '内部地址'
  }
}

export function sanitizeAgentDisplayText(content: string): string {
  return content
    .replace(absoluteUrlPattern, redactAbsoluteUrl)
    .replace(localAddressPattern, '当前页面')
    .replace(internalPageRoutePattern, '当前页面')
    .replace(internalApiRoutePattern, '内部地址')
}
