import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface CreatedRef { id: string; name: string }

export const useCreationContextStore = defineStore('creationContext', () => {
  const tenants = ref<CreatedRef[]>([])
  const menus = ref<CreatedRef[]>([])
  const buttons = ref<CreatedRef[]>([])
  const apis = ref<CreatedRef[]>([])
  const permissions = ref<CreatedRef[]>([])
  const roles = ref<CreatedRef[]>([])
  const organizations = ref<CreatedRef[]>([])
  const posts = ref<CreatedRef[]>([])

  const createdCount = computed(() => [tenants, menus, buttons, apis, permissions, roles, organizations, posts]
    .reduce((total, item) => total + item.value.length, 0))

  function append(target: typeof tenants, item: CreatedRef) {
    if (!target.value.some((current) => current.id === item.id)) target.value.unshift(item)
  }

  const addTenant = (id: string, name: string) => append(tenants, { id, name })
  const addMenu = (id: string, name: string) => append(menus, { id, name })
  const addButton = (id: string, name: string) => append(buttons, { id, name })
  const addApi = (id: string, name: string) => append(apis, { id, name })
  const addPermission = (id: string, name: string) => append(permissions, { id, name })
  const addRole = (id: string, name: string) => append(roles, { id, name })
  const addOrganization = (id: string, name: string) => append(organizations, { id, name })
  const addPost = (id: string, name: string) => append(posts, { id, name })

  function reset() {
    tenants.value = []
    menus.value = []
    buttons.value = []
    apis.value = []
    permissions.value = []
    roles.value = []
    organizations.value = []
    posts.value = []
  }

  return { tenants, menus, buttons, apis, permissions, roles, organizations, posts, createdCount, addTenant, addMenu, addButton, addApi, addPermission, addRole, addOrganization, addPost, reset }
})
