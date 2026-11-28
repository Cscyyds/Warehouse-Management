# 后端彻底异步化（FastAPI + aiomysql）校验清单

> 目的：方向②「彻底异步化」改造后，提供一份可复跑、可交接的校验清单。
> 适用范围：`D:\WMS\nuomi_wms`（Python FastAPI + MySQL → asyncio）
> 改造基线：`7ad7f06`（分支 `csc`），工作树未提交。
> 校验环境：`D:\WMS\nuomi_wms\venv\Scripts\python.exe`（含 fastapi 0.115.12 / sqlalchemy 2.0.41 / aiomysql 0.2.0）

---

## 一、改动概览（已完成）

- [x] 59 个源文件改写（18 个 endpoints + 38 个 services + 2 个 core + main.py）
- [x] 890 个 `def` → `async def`
- [x] 2757 处 session 调用加 `await`（链式结果仅链头 `await`，如 `(await db.execute(...)).scalars().first()`）
- [x] 528 处跨函数调用加 `await`（全局 async 函数名匹配，覆盖跨文件 service 调用）
- [x] git 工作树：85 个文件改动（+5662 / −5647，含 `__pycache__`）

### 关键文件改动明细

| 文件 | 改动 |
|------|------|
| `app/core/config.py` | `sqlalchemy_database_uri`：`mysql+pymysql://` → `mysql+aiomysql://` |
| `app/db/session.py` | 异步引擎 `create_async_engine` + 连接池（`pool_size=20, max_overflow=10, pool_recycle=3600, pool_timeout=30, pool_pre_ping=True`）；`connect_args={"connect_timeout": 10}`（**注意：aiomysql 0.2.0 不支持 `read_timeout`/`write_timeout`**，二者是 PyMySQL 同步驱动参数，误加会报 `TypeError: connect() got an unexpected keyword argument 'read_timeout'`）；`SessionLocal = async_sessionmaker(class_=AsyncSession)`；`get_db` 改为 `async def` 异步生成器；`before_flush` 审计监听器**保持同步 `def`**（SQLAlchemy 同步调用，不可改 async） |
| `docs/requirements.txt` | 新增 `aiomysql==0.2.0` |
| `app/main.py` | 中间件 `__call__`（async）内 DB 调用注入 `await`：`(await db.execute(...)).scalars().first()`、`await db.commit()`、`await db.close()`；`db.add` 保持同步 |

---

## 二、静态校验清单（自动化，必跑）

> 工具：`C:\Users\Administrator\.workbuddy\convert_async.py`（AST 改写 + 校验器）
> 校验原则：① 全量字节编译；② 自写扫描「未 await 的 session/async 调用」。

### 2.1 全量字节编译（Layer 1）

```bash
cd D:\WMS\nuomi_wms
venv\Scripts\python.exe - <<'PY'
import subprocess, sys, py_compile
out = subprocess.check_output(
    ["git", "-c", "core.quotePath=false", "ls-files", "*.py"], text=True)
files = [f for f in out.splitlines() if f]
bad = []
for f in files:
    try:
        py_compile.compile(f, doraise=True)
    except py_compile.PyCompileError as e:
        bad.append((f, str(e)[:200]))
print(f"compiled {len(files)} files, errors: {len(bad)}")
for f, e in bad:
    print("FAIL", f, "->", e)
sys.exit(1 if bad else 0)
PY
```

- [x] 期望结果：`compiled 81 files, errors: 0`（2026-07-20 实测通过）
- [ ] 注意：含中文路径的 `docs/需求文档/*.py` 会被 git 用 octal 引号转义，必须用 `core.quotePath=false`，否则 `py_compile` 会因路径带引号而误报 `Errno 22`。

### 2.2 AST 漏 await 扫描（Layer 2）

```bash
cd C:\Users\Administrator\.workbuddy
D:\WMS\nuomi_wms\venv\Scripts\python.exe convert_async.py verify
```

- [x] 期望结果：`✅ 校验通过: 无遗漏的 await`（2026-07-20 实测通过）
- [x] **注意**：此 `verify` 曾因 `fi.node not in async_set` 类型 bug 长期**假通过**（详见第七节）；修复后首次真实运行曾报 885 处漏 await，已全部由 `fix_awaits.py` 补上。现校验为真实通过。
- [ ] 校验内容：async 函数内 session 调用必须被 await；被异步化的函数调用必须被 await。

### 2.3 模块导入冒烟

```bash
cd D:\WMS\nuomi_wms
venv\Scripts\python.exe -c "import app.main; print('IMPORT OK')"
```

- [x] 期望结果：`IMPORT OK`（2026-07-20 实测通过）

### 2.4 路由注册与同步路由核查

```bash
cd D:\WMS\nuomi_wms
venv\Scripts\python.exe - <<'PY'
import inspect, app.main
app = app.main.app
total, sync_routes = 0, []
for r in app.routes:
    ep = getattr(r, "endpoint", None)
    if ep is None:
        continue
    total += 1
    tgt = ep
    for _ in range(5):
        wrapped = getattr(tgt, "__wrapped__", None)
        tgt = wrapped if wrapped else tgt
        if not wrapped:
            break
    if not inspect.iscoroutinefunction(tgt):
        p = getattr(r, "path", "")
        if p.startswith(("/docs", "/openapi")) or getattr(r, "__class__", None).__name__ in ("RedirectResponse", "StaticFiles"):
            continue
        sync_routes.append(p)
print("total routes:", total)
print("sync routes:", sync_routes)
PY
```

- [x] 期望结果：`total routes: 547`，sync 路由仅 3 个：`/health`、`/api/v1/captcha`、`/api/v1/verification-codes/purposes`（均不使用 DB）
- [ ] 若 sync 路由数量 > 3 且路径涉及 DB 操作 → 说明有路由漏改 async，需回查。

---

## 三、运行时验证清单（真实验证，强烈建议）

静态校验只能保证语法/await 完整，无法替代真实运行。请启动后端连 MySQL 执行以下验证：

### 3.1 启动后端

```bash
cd D:\WMS\nuomi_wms
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- [ ] 启动无报错，日志显示引擎为 `mysql+aiomysql://`
- [ ] `GET /health` 返回 200

### 3.2 回归原「卡死」场景（核心）

- [ ] 打开此前偶发卡加载的业务页（如 `tenant_wms_management` / `tenant_sales_order_management` 等列表页）
- [ ] 连续翻页 / 多标签页并发请求，**不再出现「卡加载、需重启后端 + 刷新才恢复」**
- [ ] 用压测或并发请求验证事件循环不再被同步 DB 调用阻塞（可观察 `/health` 在重负载下仍及时响应）

### 3.3 数据库写操作核对

- [ ] 新增 / 编辑 / 删除走通，`before_flush` 审计字段（create_by / update_by / 时间戳）正常写入
- [ ] 事务提交正常：`await db.commit()` 后数据可见；异常时 `await db.rollback()` 生效

### 3.4 连接池与超时

- [ ] 高并发下不出现 `TimeoutError: QueuePool limit` 或连接耗尽
- [ ] MySQL 临时不可用时 `pool_pre_ping=True` 自动重连，不出现僵死连接

---

## 四、残留风险与已知项

- [ ] 函数注解仍写 `Session`（仅类型提示，运行时为 `AsyncSession`，不影响运行；如需完美可后续批量改注解为 `AsyncSession`）
- [ ] 仓库无自动化测试，纯静态校验无法替代真实运行（详见第三节）
- [ ] `__pycache__` 被 git 跟踪（略脏），可顺手 `git rm -r --cached --quiet app/**/__pycache__ */__pycache__` 后加入 `.gitignore`
- [ ] `convert_async.py` 在 workbuddy 目录（非项目内），属一次性改写工具，勿提交到业务仓库
- [ ] **已知坑（2026-07-20 实测）**：`session.py` 的 `connect_args` 只写 `connect_timeout`，**绝不能加 `read_timeout`/`write_timeout`**——这是 PyMySQL 同步驱动参数，aiomysql 0.2.0 的 `connect()` 不接受，会报 `TypeError: connect() got an unexpected keyword argument 'read_timeout'`。语句级超时请改用 `SET SESSION MAX_EXECUTION_TIME=<ms>` 或查询加 `/*+ MAX_EXECUTION_TIME(...) */` 提示。

---

## 五、回滚方式

- [ ] 整体回退（未提交状态）：`cd D:\WMS\nuomi_wms && git checkout -- .` 或 `git stash`
- [ ] 基线 commit：`7ad7f06`（分支 `csc`）
- [ ] 回滚后需将 `config.py` 的 `mysql+aiomysql://` 改回 `mysql+pymysql://`，并从 `requirements.txt` 移除 `aiomysql`

---

## 六、可选后续

- [ ] 提交 git（建议 message：`refactor: 后端彻底异步化 FastAPI+aiomysql，修复事件循环阻塞卡死`）
- [ ] 前端 `vite.config.ts` 给 `/api` 代理加 `proxyTimeout`（兜底防御，方向②已根治根因，此项可选）
- [ ] 补充自动化测试（pytest + httpx AsyncClient + 测试库）以防未来回归

---

## 七、漏 await 专项修复（2026-07-20 运行时验证阶段，重要）

> 启动后端联调后报错 `TypeError: object of type 'coroutine' has no len()`（`tenant_wms_management.py:1695` `total = len(tree)`），
> 根因是 `_build_warehouse_tree(...)` 这个 async 函数调用**没加 await**。进一步排查发现校验器有致命 bug。

### 7.1 校验器 `verify` 假通过（已修复）
- 原 `convert_async.py` 的 `verify()` 有 bug：`async_set` 集合里装的是 `FI` 对象，却用 `fi.node not in async_set` 比对（节点 vs FI，类型不匹配）→ **永远跳过所有检查 → 永远打印"✅ 校验通过"**。
- 后果：第一轮的 528 处跨函数 await 是 transform 加的，但 verify 从未真正校验过，**885 处漏 await 一直没被发现**。
- 修复：`fi.node not in async_set` → `fi not in async_set`（详见 `convert_async.py`）。修复后首次真实 verify 报出 **885 处**未 await 的异步调用。
- 同步修复 `already_awaited`：原逻辑只认 `await <直接call>`，不认 `await <call>[0]` / `await <call>.attr`，会把"`await x()[0]`"误判为未 await。改为"祖先链上出现 `Await` 即视为已 await"。

### 7.2 精准修复器 `fix_awaits.py`（已运行）
- 路径：`C:\Users\Administrator\.workbuddy\fix_awaits.py`（workbuddy 目录，非项目内）。
- 逻辑：扫描所有 `AsyncFunctionDef`，给每个**未 await 的异步调用**补 `await`（链式 `(await foo()).bar()` 用括号包裹）；自动排除合法场景：`gather`/`create_task`/`ensure_future`/`add_task` 的协程参数、`async with` 上下文表达式、`async for` 迭代对象、`lambda` 内部、函数默认参数。
- **关键坑（已修正）**：Python `ast` 的 `col_offset`/`end_col_offset` 是 **UTF-8 字节偏移**。初版用 `len(ln)` 算字符偏移 → 含中文的行错位，把 `await ` 插进标识符中间（如 `_serialize_await arehouse`）。修复：全程用**字节偏移**（源码转 bytes，插入也用字节位置，最后 decode 回来）。
- 运行结果：**885 处 await 全部补上，7 个文件改动，全部 re-parse 通过，无语法错误**。

### 7.3 修复后验证闭环（全绿）
- `convert_async.py verify` → ✅ 校验通过：无遗漏的 await（11 处 `await x()[0]` 误报已随 `already_awaited` 修复消除）
- 全量 `py_compile`（81 个 .py）→ 0 错误
- `import app.main` → OK，547 路由
- 额外扫描「同步函数内调用异步函数未 await」→ 仅 2 处，为 `build_node` **名字冲突误报**（同文件内本地同步 `def build_node` 纯树构建，递归调用同步，本就不该 await），非真 bug

### 7.4 残留提示
- 若某 async 函数本应返回 async generator（用 `yield`）却被当成普通 async 函数 `await`，`for x in await foo()` 会在运行时报错（少见，原卡死页跑通即证明无此问题）。
- 备份：`C:\Users\Administrator\.workbuddy\_app_backup_20260720_160935\` 为修复前 `app/` 全量备份，确认无误后可删除。

