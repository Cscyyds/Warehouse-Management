import { computed, onActivated, onDeactivated, ref, shallowRef, watch } from 'vue'
import { sensitiveFormBindings } from '@/config/sensitivePageBindings'
import { useSensitiveFieldStore } from '@/stores/sensitiveField'
import { createSensitiveFormPolicy, missingFormFields } from '@/utils/sensitiveForm'
import { responseSensitiveRestrictions } from '@/utils/sensitiveFields'

export function useSensitiveForm(scene: string, enabled: () => boolean) {
  const binding = sensitiveFormBindings[scene]
  const store = useSensitiveFieldStore()
  const responseHidden = shallowRef<string[]>([])
  const missing = shallowRef<string[]>([])
  const session = ref(localStorage.getItem('token'))
  let active = true
  const endpoints = binding ? [...new Set([binding.detail, ...Object.values(binding.fields).flatMap(field => field.input ? [field.input.interfacePath] : [])])] : []
  const policy = computed(() => enabled() && binding ? createSensitiveFormPolicy(binding, store.entries, responseHidden.value, missing.value) : null)
  async function refresh() {
    if (!enabled() || !binding) return
    const token = localStorage.getItem('token')
    await Promise.all(endpoints.map(path => store.load(path, true)))
    if (localStorage.getItem('token') !== token || token !== session.value) throw new Error('登录会话已变化，请重新打开表单')
  }
  function reload() { if (active) void refresh().catch(() => {}) }
  watch(() => store.revision, reload, { immediate: true })
  onActivated(() => { active = true; reload() })
  onDeactivated(() => { active = false })
  return {
    binding, policy, refresh,
    setResponse(data: Record<string, any>) {
      if (!binding) return
      responseHidden.value = responseSensitiveRestrictions(data).flatMap(field => field.param_names)
      missing.value = missingFormFields(data, binding)
    },
  }
}
