<script setup lang="ts">
/**
 * 生产管理 · 单据正式开启时间 Tab（平台侧，2026-11-18 批次）
 *
 * 按模块（PURCHASE_SALES / BORROW / OTHER_INBOUND / PRODUCTION）查询·设置·清空天心
 * 「单据正式开启时间」。早于该时刻**首次导入**的历史单按归档落库（wms_archive_flag=1，
 * 直接完成态、不产生库存/条码/待办、不可再作业）；已有表头继承库内标记（归档粘性）。
 *
 * 接口（平台管理员 JWT 鉴权，路由级 isSystemAdmin 覆盖，无按钮级权限码）：
 *   GET  /platform-tianxin/sync-config/query?tenant_id=…
 *   POST /platform-tianxin/sync-config/update（Form：tenant_id/module_code/formal_start_at/dry_run/confirm）
 *
 * 安全边界（前端必须落实，后端契约见 platformTianxin.ts）：
 * - 日期非法后端会 500（parse_formal_start_at 抛 ValueError 未捕获）→ 提交前本地正则 + 真实日期校验。
 * - 未来时间 / 调早必须 confirm=true，否则后端 400 → 前端预判 + 确认框；时钟偏差漏判时按 400 兜底重试一次。
 * - 清空显式传 ''（绝不用 null，null 会被 toUrlEncoded 丢弃变成「不改」）；清空/调早确认框必附「已归档单据不会自动恢复」。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ApiError } from '@/api/http'
import {
  TIANXIN_MODULE_OPTIONS,
  getTianxinSyncConfig,
  tianxinDocKeyName,
  updateTianxinSyncConfig,
  type TianxinModuleCode,
  type TianxinSyncConfigQueryResult,
  type TianxinSyncUpdateResult,
} from '@/api/platformTianxin'

const props = defineProps<{
  tenantId: string
  /** 兄弟 Tab 写成功后的版本号：驱动本 Tab 重新拉取快照 */
  dataVersion: number
}>()

const emit = defineEmits<{ (e: 'changed'): void }>()

/** datetime 选择器默认时刻 00:00:00（建议设为启用日零点，而非当前时刻） */
const DEFAULT_TIME = new Date(2000, 0, 1, 0, 0, 0)

const loading = ref(false)
const loadError = ref('')
const queryResult = ref<TianxinSyncConfigQueryResult | null>(null)

const dialogOpen = ref(false)
const dialogModule = ref<TianxinModuleCode | null>(null)
const dialogValue = ref('')
const previewing = ref(false)
const submitting = ref(false)
const preview = ref<TianxinSyncUpdateResult | null>(null)
const dialogError = ref('')
const clearingModule = ref<TianxinModuleCode | null>(null)

const moduleRows = computed(() => TIANXIN_MODULE_OPTIONS.map(m => ({
  ...m,
  current: queryResult.value?.configs[m.value] ?? null,
})))
/** 查询成功前禁止写操作，避免把「加载失败」误当成「未设置」而误改 */
const canWrite = computed(() => Boolean(queryResult.value) && !loadError.value)
const dialogModuleLabel = computed(() => moduleLabel(dialogModule.value))
const dialogCurrent = computed(() => (dialogModule.value ? queryResult.value?.configs[dialogModule.value] ?? null : null))
const previewAffected = computed(() => preview.value?.affected ?? null)
const previewDocEntries = computed(() => Object.entries(previewAffected.value?.by_doc_key ?? {}))
const previewSamples = computed(() => preview.value?.samples ?? [])
const previewWarnings = computed(() => preview.value?.warnings ?? [])

function moduleLabel(code: TianxinModuleCode | null): string {
  return TIANXIN_MODULE_OPTIONS.find(m => m.value === code)?.label || code || ''
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/** 本地日期校验（硬性，防后端 500）：正则 + 真实日期合法性（拒 2 月 30 日等溢出）。
 *  接受 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS；纯日期按 00:00:00 处理。非法返回 null。 */
const DT_RE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/
function parseValidDate(text: string): Date | null {
  const m = DT_RE.exec(text.trim())
  if (!m) return null
  const year = +m[1], month = +m[2], day = +m[3]
  const hour = m[4] === undefined ? 0 : +m[4]
  const minute = m[5] === undefined ? 0 : +m[5]
  const second = m[6] === undefined ? 0 : +m[6]
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null
  const dt = new Date(year, month - 1, day, hour, minute, second)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return dt
}

/** confirm 门禁预判：新值晚于当前时刻（未来时间）或早于当前值（调早）→ 需 confirm=true */
function needsConfirmFor(newDate: Date, current: string | null): boolean {
  if (newDate.getTime() > Date.now()) return true
  if (current) {
    const cur = parseValidDate(current)
    if (cur && newDate.getTime() < cur.getTime()) return true
  }
  return false
}

async function load() {
  if (!props.tenantId) return
  loading.value = true
  loadError.value = ''
  try {
    queryResult.value = await getTianxinSyncConfig(props.tenantId)
  } catch (error) {
    queryResult.value = null
    loadError.value = errorMessage(error, '查询失败')
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

watch(() => [props.tenantId, props.dataVersion], load, { immediate: true })

function openSetDialog(module: TianxinModuleCode) {
  dialogModule.value = module
  dialogValue.value = queryResult.value?.configs[module] || ''
  preview.value = null
  dialogError.value = ''
  dialogOpen.value = true
}

/** 高风险确认框：列出未来时间/调早风险 + 归档粘性提示（AC11） */
async function confirmRisk(newDate: Date, text: string, current: string | null): Promise<boolean> {
  const lines: string[] = []
  if (newDate.getTime() > Date.now()) {
    lines.push('• 新值晚于当前时刻（未来时间）：从现在到该时刻之间的单据都会被判为历史单')
  }
  if (current) {
    const cur = parseValidDate(current)
    if (cur && newDate.getTime() < cur.getTime()) lines.push(`• 新值早于当前值（调早）：${current} → ${text}`)
  }
  if (!lines.length) lines.push('• 请核对影响面后再提交')
  lines.push('• 已归档单据不会自动恢复，误设需后端修复脚本（scripts/undo_tianxin_archive.py）处理')
  try {
    await ElMessageBox.confirm(lines.join('\n'), '高风险设置确认', {
      confirmButtonText: '确认提交',
      cancelButtonText: '取消',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

async function doPreview() {
  if (!dialogModule.value) return
  const text = dialogValue.value.trim()
  if (!text) { ElMessage.warning('请选择正式开启时间'); return }
  if (!parseValidDate(text)) { ElMessage.warning('时间格式非法，应为 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS'); return }
  previewing.value = true
  preview.value = null
  dialogError.value = ''
  try {
    preview.value = await updateTianxinSyncConfig({
      tenant_id: props.tenantId,
      module_code: dialogModule.value,
      formal_start_at: text,
      dry_run: true,
    })
  } catch (error) {
    dialogError.value = errorMessage(error, '预览失败')
    ElMessage.error(dialogError.value)
  } finally {
    previewing.value = false
  }
}

/** 实际写入：confirmFlag 由前端预判传入；收到门禁 400 且本次未带 confirm 时弹框重试一次（时钟偏差兜底） */
async function submitValue(confirmFlag: boolean) {
  if (!dialogModule.value) return
  submitting.value = true
  dialogError.value = ''
  try {
    await updateTianxinSyncConfig({
      tenant_id: props.tenantId,
      module_code: dialogModule.value,
      formal_start_at: dialogValue.value.trim(),
      confirm: confirmFlag,
    })
    ElMessage.success('设置已保存')
    dialogOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.message.includes('confirm=true') && !confirmFlag) {
      const newDate = parseValidDate(dialogValue.value)
      if (newDate && await confirmRisk(newDate, dialogValue.value.trim(), dialogCurrent.value)) {
        await submitValue(true)
        return
      }
    } else {
      dialogError.value = errorMessage(error, '设置失败')
      ElMessage.error(dialogError.value)
    }
  } finally {
    submitting.value = false
  }
}

async function doSubmit() {
  if (!dialogModule.value) return
  const text = dialogValue.value.trim()
  if (!text) { ElMessage.warning('请选择正式开启时间'); return }
  const newDate = parseValidDate(text)
  if (!newDate) { ElMessage.warning('时间格式非法，应为 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS'); return }
  const needConfirm = needsConfirmFor(newDate, dialogCurrent.value)
  if (needConfirm && !await confirmRisk(newDate, text, dialogCurrent.value)) return
  await submitValue(needConfirm)
}

async function confirmClear(module: TianxinModuleCode) {
  try {
    await ElMessageBox.confirm(
      `清空后「${moduleLabel(module)}」模块历史单将全部按正常流程导入（归档功能关闭）；已归档单据不会自动恢复。确认清空？`,
      '清空正式开启时间',
      { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  clearingModule.value = module
  try {
    await updateTianxinSyncConfig({ tenant_id: props.tenantId, module_code: module, formal_start_at: '' })
    ElMessage.success('已清空，该模块归档功能关闭')
    await load()
    emit('changed')
  } catch (error) {
    ElMessage.error(errorMessage(error, '清空失败'))
  } finally {
    clearingModule.value = null
  }
}
</script>

<template>
  <div class="sync-config-tab">
    <el-alert
      v-if="loadError"
      class="tab-notice"
      type="error"
      show-icon
      :closable="false"
      title="正式开启时间查询失败，已禁用设置/清空"
      :description="`${loadError}（避免把「加载失败」误当成「未设置」而误改）`"
    >
      <el-button size="small" type="primary" plain @click="load">重试</el-button>
    </el-alert>

    <el-alert
      class="tab-notice"
      type="info"
      show-icon
      :closable="false"
      title="按模块设置「单据正式开启时间」"
      description="早于该时刻首次导入的历史单按归档落库（直接完成态、不产生库存/条码/待办、不可再作业）；已有单据继承库内归档标记，清空或调早不会恢复已归档单。生产销售退回单与贸易销货退回单同单，跟随贸易值。"
    />

    <el-alert
      v-if="queryResult && queryResult.warnings.length"
      class="tab-notice"
      type="warning"
      show-icon
      :closable="false"
      title="部分模块尚未设置正式开启时间"
    >
      <ul class="warn-list">
        <li v-for="(w, i) in queryResult.warnings" :key="i">{{ w }}</li>
      </ul>
    </el-alert>

    <el-table v-loading="loading" :data="moduleRows" stripe table-layout="fixed" empty-text="暂无配置数据">
      <el-table-column label="模块" width="170">
        <template #default="scope"><strong>{{ scope.row.label }}</strong></template>
      </el-table-column>
      <el-table-column label="当前截止时间" width="190">
        <template #default="scope">
          <span v-if="scope.row.current" class="mono-label cutoff-value">{{ scope.row.current }}</span>
          <el-tag v-else size="small" type="info" effect="plain">未设置</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="240" show-overflow-tooltip>
        <template #default="scope"><span class="module-note">{{ scope.row.note }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="scope">
          <el-button link type="primary" :disabled="!canWrite" @click="openSetDialog(scope.row.value)">设置</el-button>
          <el-button
            link
            type="danger"
            :disabled="!canWrite || !scope.row.current"
            :loading="clearingModule === scope.row.value"
            @click="confirmClear(scope.row.value)"
          >清空</el-button>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="queryResult" class="effective-note">
      <span class="mono-label">EFFECTIVE</span>
      生产销售退回单实际生效截止时间：
      <strong>{{ queryResult.effective.production_sales_return || '未设置' }}</strong>
      （跟随贸易 PURCHASE_SALES 值，同单共用）
    </p>

    <el-dialog
      v-model="dialogOpen"
      :title="`设置正式开启时间 · ${dialogModuleLabel}`"
      width="620px"
      :close-on-click-modal="false"
    >
      <div class="dialog-notice">
        <span class="mono-label">FORMAL START AT</span>
        <p>建议设为启用日 00:00:00，不要用当前时刻。早于该时刻首次导入的历史单将按归档落库；已有单据不受影响（归档粘性）。</p>
      </div>
      <el-form label-position="top" class="dense-form">
        <el-form-item label="正式开启时间" required>
          <el-date-picker
            v-model="dialogValue"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :default-time="DEFAULT_TIME"
            placeholder="选择日期时间"
            style="width: 100%"
          />
          <p class="field-hint">当前值：{{ dialogCurrent || '未设置' }}。格式 YYYY-MM-DD HH:MM:SS（纯日期按 00:00:00 处理）。</p>
        </el-form-item>
      </el-form>

      <div v-if="dialogError" class="dialog-error">{{ dialogError }}</div>

      <div v-if="preview" class="preview-result">
        <div class="preview-result__summary">
          <span>受影响单据 <strong>{{ previewAffected?.bills ?? 0 }}</strong> 张</span>
          <span>其中已正常导入 <strong>{{ previewAffected?.already_normal_imported ?? 0 }}</strong> 张</span>
        </div>
        <p class="field-hint">已正常导入的存量单不会回溯归档（仅影响真正首次导入的单据）。</p>

        <div v-if="previewDocEntries.length" class="preview-result__block">
          <span class="mono-label">按单据类型</span>
          <div class="doc-tags">
            <el-tag v-for="[key, count] in previewDocEntries" :key="key" size="small" effect="plain">
              {{ tianxinDocKeyName(key) }} {{ count }}
            </el-tag>
          </div>
        </div>
        <div v-else class="preview-result__empty">
          {{ preview.formal_start_at === null ? '清空后不再归档任何历史单。' : '无早于该时刻的单据，设置后不会归档现有数据。' }}
        </div>

        <div v-if="previewSamples.length" class="preview-result__block">
          <span class="mono-label">样例单号（≤5，日期倒序）</span>
          <div class="doc-tags">
            <el-tag v-for="no in previewSamples" :key="no" size="small" type="info" effect="plain">{{ no }}</el-tag>
          </div>
        </div>

        <el-alert v-if="previewWarnings.length" type="warning" :closable="false" show-icon class="preview-warnings">
          <ul class="warn-list">
            <li v-for="(w, i) in previewWarnings" :key="i">{{ w }}</li>
          </ul>
        </el-alert>
      </div>

      <template #footer>
        <el-button @click="dialogOpen = false">关闭</el-button>
        <el-button :loading="previewing" :disabled="submitting" @click="doPreview">预览影响面</el-button>
        <el-button type="primary" :loading="submitting" :disabled="previewing" @click="doSubmit">确认提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sync-config-tab { display: grid; gap: 16px; }
.tab-notice :deep(.el-alert__title) { font-weight: 700; }
.warn-list { margin: 4px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.8; }
.cutoff-value { color: var(--cargo-ink); font-size: 12px; }
.module-note { color: #68798c; font-size: 12px; }
.effective-note { margin: 0; color: #68798c; font-size: 12px; }
.effective-note .mono-label { margin-right: 8px; color: #8795a4; }
.effective-note strong { color: var(--cargo-ink); }
.field-hint { margin: 6px 0 0; color: #8a98a7; font-size: 11px; line-height: 1.6; }
.dialog-error { margin: 0 0 12px; padding: 8px 12px; border: 1px solid #efcaca; background: #fff0f0; color: #ad3e3e; border-radius: 8px; font-size: 12px; }
.preview-result { margin-top: 4px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: #f7f9fb; }
.preview-result__summary { display: flex; gap: 24px; color: #68798c; font-size: 12px; }
.preview-result__summary strong { color: var(--cargo-ink); font-size: 16px; }
.preview-result__block { margin-top: 12px; }
.preview-result__block .mono-label { color: #8795a4; }
.preview-result__empty { margin-top: 12px; color: #68798c; font-size: 12px; }
.doc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.preview-warnings { margin-top: 12px; }
</style>