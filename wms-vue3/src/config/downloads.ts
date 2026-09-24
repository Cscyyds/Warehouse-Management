/**
 * 打印客户端软件下载地址（精臣打印服务 / USB 虚拟串口驱动 / 芯烨打印代理）。
 *
 * 背景：这些安装包原先作为静态资源放在 `public/downloads/` 下随前端一起分发
 * （精臣 SDK 单个 36MB、驱动 12MB，仓库与构建产物都被撑大），现统一迁到百度云 BOS。
 * 云地址由环境变量 `VITE_DOWNLOAD_BASE_URL` 提供，与后端 `.env` 的
 * `BAIDU_BOS_ENDPOINT` / `BAIDU_BOS_BUCKET`（bucket=nuomiwms）是同一个桶。
 *
 * 取值：`VITE_DOWNLOAD_BASE_URL` 有值则用它（结尾斜杠会被规整掉），否则用下面内置的默认域名兜底，
 * 避免漏配时下载链接退化成站内相对路径（必然 404）。
 *
 * ⚠️ 各常量拼接的对象 Key 必须与云桶里的**实际文件名完全一致**（BOS 的 Key 区分大小写）。
 *    换版本时改这里的 Key 即可，无需动组件。
 */

/** 百度云 BOS 桶地址（与 nuomi_wms/.env 的 BAIDU_BOS_ENDPOINT 保持一致） */
const DEFAULT_CLOUD_BASE = 'https://nuomiwms.gz.bcebos.com'

const DOWNLOAD_BASE = (import.meta.env.VITE_DOWNLOAD_BASE_URL || DEFAULT_CLOUD_BASE).trim().replace(/\/+$/, '')

/** 精臣标签打印服务（jcPrinter SDK）：安装后本机提供打印服务，供 `utils/nmPrint` 通过本地 WebSocket 直连 */
export const PRINT_SERVICE_DOWNLOAD_URL = `${DOWNLOAD_BASE}/jcPrinterSdk_4.0.6_20251120.exe`

/** 精臣 USB 虚拟串口驱动（仅 Win7 老机型需要） */
export const USB_DRIVER_DOWNLOAD_URL = `${DOWNLOAD_BASE}/USB-Driver-Installer-1.0.3.0.exe`

/**
 * 芯烨本机打印代理（自研，TSPL 脚本串行直打 + 局域网发现 discover），供 `utils/xpPrint` 使用。
 *
 * ⚠️ 安装包在 aster-link-wms 桶（sdk/ 前缀），与精臣安装包所在的 nuomiwms 桶
 * （DOWNLOAD_BASE）**不是同一个桶**，因此这里写完整地址、不经 DOWNLOAD_BASE 拼接。
 *
 * 版本约定 —— **三处必须一致**：`agent.py` 的 `AGENT_VERSION`（当前 1.2.1）、
 * zip 文件名、下方 URL 中的版本号。
 *  · 1.1.0 起支持 `connect`（USB/WiFi 连接方式选择），1.2.0 起支持 `discover`
 *    （弹窗「搜索设备」）；旧版代理由前端按"能力探测"降级提示「请更新代理」。
 *  · 发新版顺序（**不能颠倒**）：① 打包上传 BOS 并确认可下载 → ② 改本文件 URL → ③ 发布前端。
 *    先改本文件而 zip 未上传，会导致下载 404。
 *  · 旧版安装包建议在桶里另存归档（如 `archive/` 前缀），便于回滚。
 *  · 历史：1.2.0 时期 zip 文件名与 agent.py 的 AGENT_VERSION 曾不一致（zip 1.2.0 /
 *    agent 1.2.1），1.2.1-win7-11-x64 起恢复一致——换包时以 agent.py 实际版本为准。
 */
export const XP_AGENT_DOWNLOAD_URL = 'https://aster-link-wms.gz.bcebos.com/sdk/xprinter-agent-1.2.1-win7-11-x64.zip'
