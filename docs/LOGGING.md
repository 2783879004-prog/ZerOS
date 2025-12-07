## 迁移状态（当前）

- **已迁移（主要文件）**: `kernel/logger/kernelLogger.js`, `kernel/bootloader/pool.js`, `kernel/bootloader/starter.js`, `kernel/fileSystem/disk.js`, `kernel/fileSystem/fileFramework.js`, `kernel/fileSystem/nodeTree.js`, `kernel/fileSystem/init.js`, `kernel/fileSystem/type.js`, `kernel/memory/heap.js`, `kernel/signal/dependencyConfig.js`
- **说明**: 上述文件中所有对 `console.log|warn|error` 的直接调用已被替换为 `KernelLogger` 的对应方法（`info/warn/error/debug` 等）。仅 `kernel/logger/kernelLogger.js` 自身仍使用 `console.*` 作为最终输出通道，这是设计预期。

## 验证步骤

1. 确认 `test/index.html` 中已将 `kernel/logger/kernelLogger.js` 放在最前面。
2. 在 Windows PowerShell 中打开测试页面（会使用系统默认浏览器）：

```powershell
Start-Process "d:\Project\Algorithm\FileSystem\test\index.html"
```

3. 打开浏览器的开发者工具（F12）并切换到 Console 面板。
4. 刷新页面，观察控制台输出：
  - 你应能看到以 `[内核][<子系统>] [级别] <时间> - <消息>` 格式输出的日志行（示例见上文）。
  - 若需要更多调试信息，可在控制台输入：
```javascript
KernelLogger.setLevel(3); // 开启 DEBUG 级别
KernelLogger.setIncludeStack(true); // DEBUG 时包含调用栈
```

5. 若某个内核模块仍显示原始 `console.log` 文本，请在仓库根目录运行下列 PowerShell 命令以定位残留：

```powershell
Get-ChildItem -Path .\kernel -Recurse -Include *.js | Select-String -Pattern 'console\.log|console\.warn|console\.error' | Select-Object Path, LineNumber, Line
```

## 后续建议

- 如果你确认 `kernel/logger/kernelLogger.js` 永远会被优先加载，可将所有模块中保留的 `try/catch` 降级分支移除（本次迁移已尽量删除）。
- 如需把日志也上报到远端，建议在 `kernel/logger/kernelLogger.js` 中新增“transport”机制（例如 `KernelLogger.addTransport(fn)`），并在 transports 中同时保留 `console` transport 以保证本地可读性。

如果你希望我继续：
- 我可以运行一次完整扫描并把任何残留的 `console.*` 自动替换为 `KernelLogger` 的相应调用（并提交补丁）。
- 或者，我可以先把修改清单发给你审核，再逐个提交改动。 请选择你希望的下一步操作。
# 内核日志（KernelLogger）使用说明

本文档介绍项目内统一的内核日志系统 `KernelLogger`，包括其目的、API、使用示例以及迁移与启动顺序要求。

**目的**
- 将所有内核（kernel/*）模块的日志统一到同一入口，保证格式一致、级别可控、便于过滤与排查。
- 最终日志输出仍为浏览器控制台（`console.log`），但由 `KernelLogger` 统一格式化后打印。

**位置**
- 实现文件：`kernel/logger/kernelLogger.js`
- 文档及使用：本文件 `docs/LOGGING.md`

**启动顺序要求**
- 必须在任何其他内核模块之前加载 `kernel/logger/kernelLogger.js`，确保全局变量 `KernelLogger` 可用。
- 测试页面：`test/index.html` 应把 `kernel/logger/kernelLogger.js` 放在最前面的 `<script>`。

**日志级别（含数值）**
- DEBUG (3)：最详细的调试信息，适用于开发或故障排查。
- INFO  (2)：常规运行信息，表示重要的流程节点或状态改变。
- WARN  (2)：警告，表示非致命问题或可疑情况（通过 `warn` 输出）。
- ERROR (1)：错误，表示流程失败或需要人工干预的严重问题（通过 `error` 输出）。

你可以通过 `KernelLogger.setLevel(n)` 设置最低输出级别（值越大输出越详细，推荐开发时使用 `3`，生产可用 `2` 或 `1`）。

此外 `KernelLogger` 支持中文化输出与更多细粒度控制：
- `KernelLogger.setLocale('zh-CN')`：设置为中文输出（默认）。
- `KernelLogger.setIncludeStack(true)`：在 DEBUG 级别下附带调用栈，便于排查。 
- `KernelLogger.setMaxMetaLength(n)`：截断过长的 meta 序列化字符串以保持可读性。

API 概览
- `KernelLogger.debug(subsystem, message, meta?)`
- `KernelLogger.info(subsystem, message, meta?)`
- `KernelLogger.warn(subsystem, message, meta?)`
- `KernelLogger.error(subsystem, message, meta?)`
- `KernelLogger.log(levelName, subsystem, message, meta?)`：通用调用
- `KernelLogger.map(op, mapName, key, value?)`：用于磁盘/映射结构的专用日志辅助（项目内 `disk` 模块会使用）

参数说明
- `subsystem`：字符串，用于标识日志来源模块（如 `POOL`, `DISK`, `HEAP` 等）。
- `message`：字符串或简短描述。
- `meta`：可选对象，附加的数据结构（会被 `KernelLogger` 序列化或按结构展示）。

示例
- 简单信息：
```
KernelLogger.info('POOL', '初始化池开始');
```
- 带元数据的调试：
```
KernelLogger.debug('HEAP', '执行分配内存', { pid, size });
```
- 磁盘映射变更（由 `disk` 模块使用）：
```
KernelLogger.map('SET', 'inode_map', key, value);
```

迁移建议（替换旧的 `console.log`）
- 将模块中的 `console.log(...)`、`console.warn(...)`、`console.error(...)` 替换为 `KernelLogger` 对应级别的调用。
- 例：
  - `console.log('...')` => `KernelLogger.info('MODULE', '...');`
  - `console.warn('...')` => `KernelLogger.warn('MODULE', '...');`
  - `console.error('...')` => `KernelLogger.error('MODULE', '...');`
  - 需要详细对象信息时使用 `debug` 并传 `meta` 参数。

关于启动与回退
- 本方案假设 `KernelLogger` 在启动时已可用（见“启动顺序要求”）。如果某些外部启动流程无法保证这一点，可临时在模块内加入 try/catch 并在捕获时回退到 `console.*`，但长期应保证 `KernelLogger` 优先加载。

最佳实践
- 使用固定的 `subsystem` 名称（如 `POOL`、`DISK`、`HEAP`、`FS`、`SIGNAL`）便于在控制台中筛选。
- 仅在需要时传入 `meta`，避免打印过大对象（可选先选择性序列化重要字段）。
- 在生产环境把日志级别提升为 `INFO` 或 `WARN` 来减少噪音：`KernelLogger.setLevel(1)` 或 `KernelLogger.setLevel(2)`。

示例输出（中文格式化示意）
[内核][HEAP] [调试] 2025-11-30T12:34:56.789Z - 执行分配内存
附加数据: {
  "pid": 1,
  "size": 128
}

常见问题
- Q: 如果我忘记把 `kernelLogger.js` 放在最前面，怎么办？
  A: 若未按顺序加载，模块直接调用 `KernelLogger` 会报错。请检查 `test/index.html` 的脚本顺序并确保 `kernel/logger/kernelLogger.js` 位于首位。

- Q: 我可以把日志发送到远端服务器吗？
  A: `KernelLogger` 现在只负责在控制台打印。若要远程上报，可在 `kernel/logger/kernelLogger.js` 内扩展一个后端上报钩子（例如 `KernelLogger.addTransport()`）。

文档维护
- 若对日志格式或 API 做出变更，请同步更新本文件。

---
本文件由内核日志统一化迁移任务自动创建，用于指导开发者把内核模块日志汇聚到 `KernelLogger`。如需示例迁移补丁或帮助，我可以继续批量替换其余模块里的 `console.log`。