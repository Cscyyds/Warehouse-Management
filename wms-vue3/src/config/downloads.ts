/**
 * 打印客户端软件下载地址（精臣打印服务 / USB 虚拟串口驱动 / 芯烨打印代理 / TSC 打印机驱动）。
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
 * TSC 标签打印机 Windows 驱动（WHQL 2024.2_M-0，Seagull 内核，DriverWizard 图形安装）。
 * 覆盖 TSC 全系桌面/工业机型（含 TTP-244 Pro）；USB / 串口 / 网口。
 * 安装后打印机进入 Windows 打印队列，由打印代理 win 模式（utils/xpPrint）经
 * spooler RAW 把 TSPL 脚本原样透传给打印机。
 *
 * ⚠️ BOS Key 含空格与括号（`tsc_whql_2024.2_m-0 (1).zip`，URL 中空格编码为 %20）——
 *    与桶里实际文件名一致即可，不要"顺手规整"掉空格/括号，否则 404。
 * ⚠️ 安装方式（官方 Installation_Instructions）：关闭打印机 → 接线 → 开机 →
 *    运行包内 DriverWizard.exe 选连接方式；**不要用 Windows 即插即用向导**
 *    （官方明确不推荐，后续升级会留损坏态）。
 * ⚠️ TTP-244 Pro 已 EoL 停产，驱动仍可从 TSC 官网 Downloads 页获取
 *    （https://apac.tscprinters.com/en/downloads）；换新驱动版本时同步改这里。
 */
export const TSC_DRIVER_DOWNLOAD_URL = `${DOWNLOAD_BASE}/tsc_whql_2024.2_m-0%20(1).zip`

/**
 * 芯烨本机打印代理（自研，TSPL 脚本串行直打 + 局域网发现 discover），供 `utils/xpPrint` 使用。
 *
 * ⚠️ 安装包在 aster-link-wms 桶（sdk/ 前缀），与精臣安装包所在的 nuomiwms 桶
 * （DOWNLOAD_BASE）**不是同一个桶**，因此这里写完整地址、不经 DOWNLOAD_BASE 拼接。
 *
 * 桶内存况（2026-10-12 实测 ListObjects + 匿名 HEAD 200）：
 *  · `sdk/xprinter-agent-1.3.1-x64.zip` —— **当前分发版**（py3.8.10 打包，一个包通吃
 *    Win7 SP1~Win11；含 win 模式即 TSC 通道，也覆盖芯烨 usb/net）。2026-10-12 上传，
 *    上传后已过冒烟自检（PE 无 core-path 依赖、win32print 收敛、win 模式枚举正常）。
 *  · `sdk/xprinter-agent-1.3.0-win7-nopatch-x64.zip` —— **Win7 免补丁版**（py3.7 运行时，
 *    内置 VC 运行库修复工具；仍走芯烨官方 SDK USB 通道，**无 win 模式**）。版本号 1.3.0
 *    已被这条线占用，故我方 win 模式版**改发 1.3.1 避让**（留桶作 Win7 芯烨老用户回滚）。
 *  · nuomiwms 桶留有历史包 xprinter-agent-1.1.0/1.2.0/1.2.1.zip（回滚归档用）。
 *  · ⚠️ 2026-10-12 修过一个 404：URL 曾指向已不存在的 `xprinter-agent-1.2.1-win7-11-x64.zip`
 *    （桶里无此 key，BOS 返 NoSuchKey）。**换包前必须先 ListObjects 确认真实 key**。
 *
 * 版本约定 —— **三处必须一致**：`agent.py` 的 `AGENT_VERSION`、zip 文件名、下方 URL 中的版本号。
 *  · 1.1.0 起支持 `connect`（USB/WiFi 连接方式选择），1.2.0 起支持 `discover`
 *    （弹窗「搜索设备」）；**1.3.1 起支持 win 模式**（TSC：经 Windows 打印队列 RAW 直写）。
 *    1.3.1 于 2026-10-12 打包上传并通过自检，本 URL 已切换指向。
 *  · 1.3.0 起支持 `@BIN:` 位图行（后端 2026-09-30 位图打印架构，预览=打印）；
 *    **位图后端必须与支持 @BIN 的代理一起部署**——新后端发 @BIN 行，旧代理会打出乱码。
 *    前端对 @BIN **无能力探测**（tspl 原样透传给代理），装错版本是静默乱码，换包务必实测。
 *  · 旧版代理能力探测：connect mode='win' 收到 errorCode:7 ⇒ 前端提示「代理版本过低」。
 *  · 发新版顺序（**不能颠倒**）：① 打包上传 BOS 并确认可下载 → ② 改本文件 URL → ③ 发布前端。
 *    先改本文件而 zip 未上传，会导致下载 404。
 *  · 历史：1.2.0 时期 zip 文件名与 agent.py 的 AGENT_VERSION 曾不一致（zip 1.2.0 /
 *    agent 1.2.1），1.2.1-win7-11-x64 起恢复一致——换包时以 agent.py 实际版本为准。
 */
export const XP_AGENT_DOWNLOAD_URL = 'https://aster-link-wms.gz.bcebos.com/sdk/xprinter-agent-1.3.1-x64.zip'
