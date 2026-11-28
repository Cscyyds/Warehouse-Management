<template>
  <div class="trial-page">
    <LandingHeader />

    <main class="trial-main">
      <!-- 左侧：产品介绍与特点 -->
      <section class="trial-intro">
        <p class="trial-intro__eyebrow">企业落地智能仓储的最佳伙伴</p>
        <h1 class="trial-intro__title">智星云仓储管理系统</h1>
        <p class="trial-intro__desc">
          覆盖采购、销售、库存、配送、财务全链路，<br />
          以 AI 助手赋能决策，让仓储管理更智能、更高效。
        </p>

        <div class="feature-grid">
          <div v-for="item in features" :key="item.title" class="feature-card">
            <div class="feature-card__head">
              <span class="feature-card__icon" :style="{ background: item.gradient }">
                <el-icon :size="20"><component :is="item.icon" /></el-icon>
              </span>
              <span class="feature-card__title">{{ item.title }}</span>
            </div>
            <p class="feature-card__desc">{{ item.desc }}</p>
            <div class="feature-card__visual">
              <span
                v-for="(bar, i) in item.bars"
                :key="i"
                class="feature-card__bar"
                :style="{ height: bar + '%', background: item.gradient }"
              />
            </div>
          </div>
        </div>

        <ul class="assurance-list">
          <li v-for="text in assurances" :key="text" class="assurance-item">
            <el-icon :size="16" color="#3b82f6"><CircleCheckFilled /></el-icon>
            <span>{{ text }}</span>
          </li>
        </ul>
      </section>

      <!-- 右侧：预约表单 -->
      <aside class="trial-card">
        <template v-if="!submitted">
          <h2 class="trial-card__title">预约试用</h2>
          <p class="trial-card__sub">填写以下信息，客户成功顾问将在 1 个工作日内与您联系</p>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="trial-form"
            @submit.prevent
          >
            <el-form-item label="你的姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入你的姓名" maxlength="20" clearable />
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" clearable>
                <template #prepend><span class="phone-prefix">+86</span></template>
              </el-input>
            </el-form-item>

            <el-form-item label="企业名称" prop="company">
              <el-input v-model="form.company" placeholder="请输入企业名称" maxlength="50" clearable />
            </el-form-item>

            <el-form-item label="行业类型" prop="industry">
              <el-select v-model="form.industry" placeholder="请选择行业类型" class="full-width">
                <el-option v-for="opt in industryOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>

            <el-form-item label="公司规模" prop="scale">
              <el-select v-model="form.scale" placeholder="请选择公司规模" class="full-width">
                <el-option v-for="opt in scaleOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>

            <el-form-item label="你的职位" prop="position">
              <el-select v-model="form.position" placeholder="请选择你的职位" class="full-width">
                <el-option v-for="opt in positionOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>

            <el-form-item label="所在地区" prop="region">
              <el-cascader
                v-model="form.region"
                :options="regionOptions"
                :props="{ expandTrigger: 'hover' }"
                placeholder="请选择省 / 市"
                class="full-width"
                clearable
              />
            </el-form-item>

            <el-form-item prop="agreed" class="agreement-item">
              <el-checkbox v-model="form.agreed">
                <span class="agreement-text">
                  我已阅读并接受<a class="agreement-link" @click.prevent="goPrivacy">《个人信息保护声明》</a>，同意相关个人信息用于试用服务联系。
                </span>
              </el-checkbox>
            </el-form-item>

            <el-button
              type="primary"
              class="submit-btn"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ submitting ? '提交中…' : '立即预约试用' }}
            </el-button>
            <p class="trial-card__tip">* 提交即代表同意我们的顾问通过电话或邮件与您联系</p>
          </el-form>
        </template>

        <!-- 提交成功状态 -->
        <div v-else class="trial-success">
          <span class="trial-success__icon">
            <el-icon :size="40"><CircleCheckFilled /></el-icon>
          </span>
          <h2 class="trial-success__title">预约提交成功</h2>
          <p class="trial-success__desc">
            感谢您的信任，{{ form.name }}！<br />
            我们的客户成功顾问将在 1 个工作日内通过手机 {{ maskedPhone }} 与您联系。
          </p>
          <div class="trial-success__actions">
            <button class="tb-btn tb-btn--primary" @click="goHome">返回首页</button>
            <button class="tb-btn tb-btn--ghost" @click="goLogin">进入控制台</button>
          </div>
        </div>
      </aside>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { Cpu, Box, DataAnalysis, Van, CircleCheckFilled } from '@element-plus/icons-vue'
import { provinceAndCityData } from 'element-china-area-data'
import LandingHeader from '@/components/LandingHeader.vue'
import LandingFooter from '@/components/LandingFooter.vue'

const router = useRouter()

function goHome() { router.push('/') }
function goLogin() { router.push('/login') }
function goPrivacy() { router.push('/privacy') }

/* ---------- 左侧展示内容 ---------- */
const features = [
  {
    icon: Cpu,
    title: 'AI 智能助手',
    desc: '7×24h 在线智能问答，辅助经营分析与决策',
    gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    bars: [42, 68, 55, 82, 64, 90]
  },
  {
    icon: Box,
    title: '全链路管理',
    desc: '采购、销售、库存、配送、财务一体化协同',
    gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
    bars: [60, 45, 75, 52, 85, 70]
  },
  {
    icon: DataAnalysis,
    title: '精准库存管控',
    desc: '库位、条码精细化管理，库存实时可视',
    gradient: 'linear-gradient(135deg,#10b981,#059669)',
    bars: [50, 72, 60, 88, 66, 78]
  },
  {
    icon: Van,
    title: '高效配送调度',
    desc: '任务、司机、车辆一体化调度，全程可追踪',
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
    bars: [66, 52, 80, 58, 74, 86]
  }
]

const assurances = ['开箱即用，快速部署上线', '数据加密存储，安全可靠', '专属顾问一对一服务']

/* ---------- 表单 ---------- */
interface TrialForm {
  name: string
  phone: string
  company: string
  industry: string
  scale: string
  position: string
  region: string[]
  agreed: boolean
}

const formRef = ref<FormInstance>()
const submitting = ref(false)
const submitted = ref(false)

const form = reactive<TrialForm>({
  name: '',
  phone: '',
  company: '',
  industry: '',
  scale: '',
  position: '',
  region: [],
  agreed: false
})

const industryOptions = ['制造业', '批发零售', '电商', '物流仓储', '食品饮料', '医药健康', '3C 电子', '其他']
const scaleOptions = ['20 人以下', '20-99 人', '100-499 人', '500-999 人', '1000 人以上']
const positionOptions = ['负责人 / CEO', '仓储 / 物流负责人', '供应链负责人', 'IT / 信息负责人', '采购 / 销售负责人', '其他']

const regionOptions = provinceAndCityData

const rules: FormRules<TrialForm> = {
  name: [{ required: true, message: '请输入你的姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号', trigger: 'blur' }
  ],
  company: [{ required: true, message: '请输入企业名称', trigger: 'blur' }],
  industry: [{ required: true, message: '请选择行业类型', trigger: 'change' }],
  scale: [{ required: true, message: '请选择公司规模', trigger: 'change' }],
  position: [{ required: true, message: '请选择你的职位', trigger: 'change' }],
  region: [{ required: true, message: '请选择所在地区', trigger: 'change' }],
  agreed: [
    {
      validator: (_rule, value: boolean, callback) => {
        value ? callback() : callback(new Error('请先阅读并接受个人信息保护声明'))
      },
      trigger: 'change'
    }
  ]
}

const maskedPhone = computed(() => form.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'))

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  // TODO: 此处对接后端预约接口，将 form 数据提交入库
  setTimeout(() => {
    submitting.value = false
    submitted.value = true
  }, 800)
}
</script>

<style scoped>
.trial-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(102, 126, 234, 0.14), transparent 60%),
    radial-gradient(900px 500px at -10% 30%, rgba(59, 130, 246, 0.10), transparent 60%),
    linear-gradient(165deg, #f2f6ff 0%, #f7f5ff 55%, #eef4ff 100%);
  color: #1f2329;
}


.tb-btn {
  height: 36px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}
.tb-btn--ghost {
  background: transparent;
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.45);
}
.tb-btn--ghost:hover { background: rgba(59, 130, 246, 0.08); }
.tb-btn--primary {
  background: linear-gradient(135deg, #3b82f6, #667eea);
  color: #fff;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.32);
}
.tb-btn--primary:hover { filter: brightness(1.06); transform: translateY(-1px); }

/* ---------- 主体两栏 ---------- */
.trial-main {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 120px 32px 72px;
  display: flex;
  gap: 56px;
  align-items: flex-start;
}

/* ---------- 左侧介绍 ---------- */
.trial-intro { flex: 1; min-width: 0; padding-top: 24px; }
.trial-intro__eyebrow {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
  letter-spacing: 1px;
  margin-bottom: 16px;
}
.trial-intro__title {
  font-size: 44px;
  line-height: 1.2;
  font-weight: 800;
  margin: 0 0 18px;
  background: linear-gradient(120deg, #1f2329 30%, #3b82f6 90%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.trial-intro__desc {
  font-size: 16px;
  line-height: 1.8;
  color: #5a616b;
  margin: 0 0 36px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}
.feature-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 35, 41, 0.05);
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 6px 24px rgba(31, 35, 41, 0.05);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 34px rgba(59, 130, 246, 0.14);
}
.feature-card__head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.feature-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.feature-card__title { font-size: 16px; font-weight: 700; }
.feature-card__desc { font-size: 13px; color: #6b7280; line-height: 1.7; margin: 0 0 16px; }
.feature-card__visual {
  height: 56px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 0 4px;
}
.feature-card__bar {
  flex: 1;
  border-radius: 4px 4px 0 0;
  opacity: 0.75;
  transition: opacity 0.2s ease;
}
.feature-card:hover .feature-card__bar { opacity: 1; }

.assurance-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  margin: 0;
  padding: 0;
}
.assurance-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #41474f;
}

/* ---------- 右侧表单卡片 ---------- */
.trial-card {
  width: 420px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 20px;
  padding: 34px 32px 28px;
  box-shadow: 0 16px 48px rgba(31, 35, 41, 0.10);
  position: sticky;
  top: 88px;
}
.trial-card__title { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
.trial-card__sub { font-size: 13px; color: #8a919c; margin: 0 0 24px; }

.trial-form :deep(.el-form-item) { margin-bottom: 18px; }
.trial-form :deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 600;
  color: #2b3038;
  padding-bottom: 4px;
}
.trial-form :deep(.el-input__wrapper),
.trial-form :deep(.el-select__wrapper),
.trial-form :deep(.el-cascader .el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}
.trial-form :deep(.el-input__wrapper:hover),
.trial-form :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #3b82f6 inset;
}
.trial-form :deep(.el-input-group__prepend) {
  background: #f5f7fa;
  border-radius: 10px 0 0 10px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  padding: 0 14px;
  color: #41474f;
}
.phone-prefix { font-size: 14px; }
.full-width { width: 100%; }

.agreement-item { margin-bottom: 20px; }
.agreement-item :deep(.el-form-item__error) { padding-top: 4px; }
.agreement-item :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.agreement-text { font-size: 12px; color: #6b7280; }
.agreement-link { color: #3b82f6; cursor: pointer; }
.agreement-link:hover { text-decoration: underline; }

.submit-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #667eea);
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.35);
  transition: filter 0.2s ease, transform 0.2s ease;
}
.submit-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
.trial-card__tip { font-size: 12px; color: #a2a8b1; text-align: center; margin: 14px 0 0; }

/* ---------- 成功状态 ---------- */
.trial-success { text-align: center; padding: 48px 8px; }
.trial-success__icon {
  display: inline-flex;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  color: #10b981;
  background: rgba(16, 185, 129, 0.10);
  margin-bottom: 22px;
}
.trial-success__title { font-size: 22px; font-weight: 800; margin: 0 0 12px; }
.trial-success__desc { font-size: 14px; color: #6b7280; line-height: 1.8; margin: 0 0 30px; }
.trial-success__actions { display: flex; justify-content: center; gap: 14px; }

/* ---------- 响应式 ---------- */
@media (max-width: 1024px) {
  .trial-main { flex-direction: column; gap: 40px; padding-top: 96px; }
  .trial-card { width: 100%; position: static; }
  .trial-intro { padding-top: 0; }
  .trial-intro__title { font-size: 34px; }
}
@media (max-width: 560px) {
  .feature-grid { grid-template-columns: 1fr; }
  .trial-header__inner { padding: 0 20px; }
  .trial-main { padding: 28px 20px 56px; }
  .trial-card { padding: 28px 22px 24px; }
}
</style>
