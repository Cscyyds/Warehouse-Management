# Agent 页面识别评测报告（意图层基线）

- 生成时间：2026-09-28T03:57:09.936Z
- 用例总数：1060（常规 940 / 反向 120）

## 总体指标（常规用例）

| 指标 | 数值 |
| --- | --- |
| top1 命中率 | 46.8%（440/940） |
| 候选 top3 召回率 | 97.2%（914/940） |
| 错跳率（路由到非期望页面） | 1.4%（13/940） |
| 澄清率 | 0.0% |
| 交 LLM 兜底率 | 51.7% |
| 其中：匹配层候选已命中期望页但仍交 LLM | 464（占交LLM的 95.5%） |
| 不支持 | 1 |
| 无路由预期通过（noise） | 2 |

## 分类指标

| 类别 | 用例数 | top1 | 候选top3 | 错跳 | 澄清 | 交LLM | 不支持 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| title | 128 | 59.4% | 100.0% | 2 | 0 | 50 | 0 |
| alias | 105 | 99.0% | 100.0% | 1 | 0 | 0 | 0 |
| keyword | 530 | 29.1% | 100.0% | 6 | 0 | 370 | 0 |
| synonym | 46 | 52.2% | 100.0% | 0 | 0 | 22 | 0 |
| intentExample | 123 | 63.4% | 82.1% | 4 | 0 | 40 | 1 |
| handmade | 8 | 50.0% | 50.0% | 0 | 0 | 4 | 0 |
| excluded | 120 | 0.0% | 0.0% | 0 | 0 | 85 | 0 |

## 反向用例（excludedIntents）

- 违规率（错误路由回来源页）：0.0%（0/120）

## 错跳明细（按类别，最多 30 条）

- 错跳总数：13，其中目标页也对同话术有词条声明（合理共享词/排序问题）：9

| 话术 | 期望页面 | 实际路由 | 匹配层候选(top3) | 目标页也声明该词 |
| --- | --- | --- | --- | --- |
| 查一下谁操作过系统 | system.logs | system.personnel | (空) | 否 |
| 看看新开发的客户 | customer.new | customer.info | customer.info | 是 |
| 采购退货汇总表 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return | 是 |
| 打开采购退货汇总表 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return | 是 |
| 打开采购退货汇总 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return | 是 |
| 采购退货汇总 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return | 是 |
| 查看采购退货汇总 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return | 是 |
| 供应商退货统计 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return, purchase.supplier | 是 |
| 查看供应商退货统计 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.return, purchase.supplier | 是 |
| 退给供应商的货 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.supplier | 否 |
| 查看退给供应商的货 | purchase.report.return-summary | purchase.return | purchase.report.return-summary, purchase.supplier | 否 |
| 退给供应商多少货 | purchase.report.return-summary | purchase.return | purchase.supplier | 否 |
| 我有哪些拜访 | profile.my-visit-task | customer.task.visit | customer.task.visit | 是 |

## 落空明细（澄清 / 交 LLM / 不支持，最多 30 条）

- 落空总数：487（澄清 0 / 交LLM 486 / 不支持 1）

| 话术 | 期望页面 | 路由结果 | 匹配层候选(top3) |
| --- | --- | --- | --- |
| 仪表盘 | dashboard.overview | agent | dashboard.overview |
| 查看仪表盘 | dashboard.overview | agent | dashboard.overview |
| 首页 | dashboard.overview | agent | dashboard.overview |
| 查看首页 | dashboard.overview | agent | dashboard.overview |
| 工作台 | dashboard.overview | agent | dashboard.overview |
| 查看工作台 | dashboard.overview | agent | dashboard.overview |
| 运营总览 | dashboard.overview | agent | dashboard.overview |
| 查看运营总览 | dashboard.overview | agent | dashboard.overview |
| 系统概览 | dashboard.overview | agent | dashboard.overview |
| 查看系统概览 | dashboard.overview | agent | dashboard.overview |
| 人事资料管理 | system.personnel | agent | system.personnel |
| 员工账号 | system.personnel | agent | system.personnel |
| 查看员工账号 | system.personnel | agent | system.personnel |
| 同事信息 | system.personnel | agent | system.personnel |
| 查看同事信息 | system.personnel | agent | system.personnel |
| 员工 | system.personnel | agent | system.personnel |
| 查看员工 | system.personnel | agent | system.personnel |
| 职员 | system.personnel | agent | system.personnel |
| 查看职员 | system.personnel | agent | system.personnel |
| 员工列表 | system.personnel | agent | system.personnel |
| 查看员工列表 | system.personnel | agent | system.personnel |
| 我想找一个员工 | system.personnel | agent | system.personnel |
| 组织机构管理 | system.organization | agent | system.organization |
| 部门 | system.organization | agent | system.organization |
| 查看部门 | system.organization | agent | system.organization |
| 组织架构 | system.organization | agent | system.organization |
| 查看组织架构 | system.organization | agent | system.organization |
| 公司架构 | system.organization | agent | system.organization |
| 查看公司架构 | system.organization | agent | system.organization |
| 部门设置 | system.organization | agent | system.organization |

## URL/路由一致性

- location 反查：102/102 通过
- 路由名存在性：102/102 通过

