# Agent 页面识别评测报告（意图层）

- 生成时间：2026-09-28T04:32:42.094Z
- 用例总数：1076（常规 954 / 反向 122）

## 总体指标（常规用例）

| 指标 | 数值 |
| --- | --- |
| top1 命中率 | 98.6%（941/954） |
| 候选 top3 召回率 | 99.8%（952/954） |
| 错跳率（路由到非期望页面） | 0.0%（0/954） |
| 澄清率 | 0.0% |
| 交 LLM 兜底率 | 1.4% |
| 其中：已带页面/动作约束的委派（页面已确定，LLM 只填参数） | 1.2%（11） |
| 完全开放式交 LLM（未确定页面） | 0.2%（2） |
| 其中：匹配层候选已命中期望页但仍交 LLM | 11（占交LLM的 84.6%） |
| 不支持 | 0 |
| 无路由预期通过（noise） | 2 |

## 分类指标

| 类别 | 用例数 | top1 | 候选top3 | 错跳 | 澄清 | 委派 | 交LLM | 不支持 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| title | 128 | 100.0% | 100.0% | 0 | 0 | 0 | 0 | 0 |
| alias | 105 | 100.0% | 100.0% | 0 | 0 | 0 | 0 | 0 |
| keyword | 538 | 99.3% | 100.0% | 0 | 0 | 4 | 4 | 0 |
| synonym | 44 | 95.5% | 100.0% | 0 | 0 | 2 | 2 | 0 |
| intentExample | 123 | 95.9% | 100.0% | 0 | 0 | 5 | 5 | 0 |
| handmade | 16 | 87.5% | 87.5% | 0 | 0 | 0 | 2 | 0 |
| excluded | 122 | 0.0% | 0.0% | 0 | 6 | 1 | 2 | 1 |

## 反向用例（excludedIntents）

- 违规率（错误路由回来源页）：0.0%（0/122）

## 错跳明细（按类别，最多 30 条）

- 错跳总数：0，其中目标页也对同话术有词条声明（合理共享词/排序问题）：0

| 话术 | 期望页面 | 实际路由 | 匹配层候选(top3) | 目标页也声明该词 |
| --- | --- | --- | --- | --- |

## 委派明细（页面/动作已确定，交 LLM 填参数，最多 30 条）

- 委派总数：11（均已在匹配层命中期望页的候选，页面上限已由 contract 约束）

| 话术 | 期望页面 | 匹配层候选(top3) |
| --- | --- | --- |
| 客户查询 | customer.info | customer.info |
| 查看客户查询 | customer.info | customer.info |
| 查询某个客户 | customer.info | customer.info, purchase.inbound, sales.order |
| 查一下某个产品 | product.info | product.info |
| 查询某个供货商 | purchase.supplier | purchase.supplier |
| 采购记录 | purchase.order | purchase.order |
| 查看采购记录 | purchase.order | purchase.order |
| 了解一下入库情况 | purchase.inbound | purchase.inbound |
| 查询某个客户的销售订单 | sales.order | sales.order, customer.info |
| 销售商品记录 | sales.report.order-detail | sales.report.order-detail |
| 查看销售商品记录 | sales.report.order-detail | sales.report.order-detail |

## 落空明细（澄清 / 开放式交 LLM / 不支持，最多 30 条）

- 落空总数：2（澄清 0 / 开放式交LLM 2 / 不支持 0）

| 话术 | 期望页面 | 路由结果 | 匹配层候选(top3) |
| --- | --- | --- | --- |
| 你好 |  | agent | (空) |
| 今天天气怎么样 |  | agent | (空) |

## URL/路由一致性

- location 反查：103/103 通过
- 路由名存在性：103/103 通过

