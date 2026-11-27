# 简易库存positions改造与前端位置列

按用户提供的方案实施：保留原simple_stocks每一条余额及其place_type/place_id/stock_qty等字段，新增positions数组，不把简易余额转成条码记录，不返回last_inbound_time。

## 后端合同

GET /api/v1/tenant-inventory/products/detail，以及产品列表GET /api/v1/tenant-inventory/products中的simple_stocks行新增positions。搜索原本没有该余额数组，保持原返回结构。普通模式返回结构和数量格式保持。

- POSITION：positions只有当前余额对应的位置视图。位置ID保留原place_id，使用与普通模式共用的批量位置解析，向上解析多级货位和仓库。
- PLASTIC_BOX：额外保留box_id=原place_id，返回可核实的box_code/box_name；positions展示盒所在的位置及仓库。找不到盒或其位置时保留余额，位置ID可空。
- DISTRIBUTION_SPOT：position_id填集散位ID，position_code/location_no填集散位编号，location_name填集散位名称；floor_no/position_no为0，location_id为空串，warehouse_id取集散位所属仓库ID。按方案warehouse_no/warehouse_name为空串，不另查仓库名称；place_type标为DISTRIBUTION_SPOT。
- positions每条包含position_id、position_code、floor_no、position_no、stock_qty、location_id、location_no、location_name、warehouse_id、warehouse_no、warehouse_name。异常资料无法核实的展示字段返回null，不从其他租户补齐；不丢失余额。
- positions[].stock_qty始终取所属余额的四位小数字符串，不能使用位置档案物理总量。它与余额stock_qty是同一数量，不能相加。
- 不同长度余额分别返回，零余额仍排除。原有平铺名称/编号字段继续保留供旧客户端兼容。
- 普通模式位置解析与简易模式共享inventory_position_views.py；按请求集合批量查询，父货位按层批量解析并防环，不随余额行数逐条查库。
- 简易列表及详情递归执行原库存数量权限策略，隐藏数量时同时去掉余额和positions中的stock_qty。此为查询输出过滤，不改库存或角色配置。

## 前端

库存详情无条码明细按positions展示仓库、货位编号、货位名称、层数、位置号、位置编码，另列塑料盒名称/编码；保留存放类型、毫米长度、余额数量和更新时间。

集散位编号/名称显示在对应的位置/货位列，不把内部ID暴露给用户。集散位仓库名称按接口为空时显示“-”。更新时间仍取余额updated_at，未添加“最近入库时间”列，也不以余额更新时间冒充入库时间。

表格按balance_id及位置索引标识行，不合并相同位置的不同长度。分类和总合计仅对原始余额数组求和一次；即使嵌套数量可见而余额数量缺失，也不从嵌套数量反推合计。兼容旧响应没有positions的情况，保留余额并使用原有可读资料，不回退到内部ID。

## 验证和部署

- 后端29项隔离回归通过：三类对象、多级货位、不同长度、失效/跨租户/重绑资料、只读批量查询、列表/详情数量权限及普通位置合同。
- 前端7项显示回归、Vue类型检查通过；隔离浏览器6种模式显示回归通过，包含新位置列和数量缺省防反推。
- 本地真实列表和详情路由+数据库验证HTTP200（测试应用覆盖身份依赖）：保留产品A为6条余额、合计16.5000，每条positions数量等于余额数量，均没有last_inbound_time。
- 本地主后端已重启加载新投影。没有执行DDL/DML，不清理或改动用户保留的手测库存，不切换租户模式。
- 接口和结构变更记录按时间追加至后端docs/本日接口变更.md与docs/待执行结构变更.sql；本批无需迁移或权限SQL。
