# ZerOS Kernel - 虚拟内核操作系统

## 声明

1. 本系统内所有的音乐API均由岑鬼鬼提供,由此涉及的所有问题,与ZerOS开发组和岑鬼鬼无关,如有侵权,请联系删除 
2. 本系统的开发由Gemini 3 Pro提供支持,仅供学习参考 
3. 本系统不与其他项目进行对标,请勿恶意评价 
4. 本系统涉及的SVG矢量图均由Gemini 3 Pro生成,非互联网采集而来 
   
## 项目用途 

ZerOS系统用于教学目的的浏览器虚拟内核开发项目,仅供学习娱乐交流

## 简介

**ZerOS Kernel** 是一个基于浏览器实现的虚拟操作系统内核，提供完整的文件系统、内存管理、进程管理和终端界面。它模拟了真实操作系统的核心功能，包括多进程内存管理、虚拟磁盘分区、文件系统树结构、进程生命周期管理，以及功能丰富的命令行终端。

### 核心特性

- **虚拟文件系统**：支持多磁盘分区（C:、D: 等），完整的目录树结构
- **内存管理**：堆内存（Heap）和栈内存（Shed）管理，支持多进程隔离
- **进程管理**：完整的进程生命周期管理（启动、运行、终止），PID分配，程序资源管理
- **统一数据存储**：Exploit 程序（PID 10000）作为统一的数据存储中心，管理所有内核动态数据
- **终端界面**：Bash 风格的命令行终端，支持多标签页、命令历史、自动补全、窗口管理
- **持久化存储**：使用 localStorage API 实现数据和目录的永久保存
- **丰富的命令集**：文件操作、目录管理、进程监控、文本编辑器等
- **模块化架构**：基于依赖注入的模块系统，支持异步加载
- **程序管理**：应用程序资源管理，自动启动程序，CLI程序自动启动终端环境

## 系统架构

### 内核模块结构

```
ZerOS Kernel
├── Logger (日志系统)
│   └── KernelLogger - 统一的日志管理
├── BootLoader (启动引导)
│   ├── Starter - 内核启动器
│   └── Pool - 全局对象池
├── Signal (信号系统)
│   ├── DependencyConfig - 依赖管理和模块加载
│   └── Pool - 全局对象池
├── Memory (内存管理)
│   ├── Heap - 堆内存管理
│   ├── Shed - 栈内存管理
│   ├── MemoryManager - 统一内存管理器（支持程序名称注册）
│   └── KernelMemory - 内核动态数据存储（Exploit程序内存管理）
├── Process (进程管理)
│   ├── ProcessManager - 进程生命周期管理
│   ├── ApplicationAssetManager - 应用程序资源管理
│   ├── ApplicationAssets - 应用程序资源映射
│   ├── GUIManager - GUI窗口管理
│   ├── NotificationManager - 通知管理
│   ├── TaskbarManager - 任务栏管理
│   ├── ThemeManager - 主题管理
│   ├── EventManager - 事件管理
│   ├── ContextMenuManager - 上下文菜单管理
│   └── DesktopManager - 桌面管理
├── Drive (驱动层)
│   ├── AnimateManager - 动画管理
│   ├── NetworkManager - 网络管理
│   └── LStorage - 本地存储
└── FileSystem (文件系统)
    ├── Disk - 虚拟磁盘管理
    ├── NodeTree - 文件树结构
    ├── FileFormwork - 文件对象模板
    ├── Type - 文件类型系统
    └── Init - 文件系统初始化
```

### 启动流程

1. **日志系统初始化**：加载 `KernelLogger`，建立统一日志入口
2. **依赖管理器初始化**：创建 `DependencyConfig` 实例
3. **模块依赖声明**：注册所有内核模块的依赖关系
4. **模块链接**：按依赖顺序异步加载所有模块
5. **对象池初始化**：创建全局对象池 `KERNEL_GLOBAL_POOL`
6. **进程管理器初始化**：初始化 `ProcessManager`，注册 Exploit 程序（PID 10000）
7. **GUI管理器初始化**：初始化 `GUIManager`，建立窗口管理系统
8. **通知管理器初始化**：初始化 `NotificationManager`，建立通知系统
9. **任务栏管理器初始化**：初始化 `TaskbarManager`，建立任务栏界面
10. **文件系统初始化**：初始化磁盘分区（C:、D:）
11. **自动启动程序**：启动标记为 `autoStart: true` 的程序（如终端程序）
12. **终端启动**：创建终端界面，加载用户数据

## 核心模块详解

### 1. 日志系统 (KernelLogger)

统一的内核日志系统，提供结构化的日志输出。

**特性**：
- 多级别日志：DEBUG (3)、INFO (2)、WARN (1)、ERROR (0)
- 结构化输出：模块名、级别、时间戳、消息
- 本地化支持：支持中英文切换
- 日志过滤：可动态调整日志级别

**API**：
```javascript
KernelLogger.setLevel(3);           // 设置日志级别
KernelLogger.setLocale('zh-CN');    // 设置语言
KernelLogger.info("Module", "message");
KernelLogger.debug("Module", "message");
KernelLogger.error("Module", "error", {meta});
```

### 2. 内存管理 (MemoryManager)

提供堆内存和栈内存的统一管理，支持多进程内存隔离。

**堆内存 (Heap)**：
- 动态内存分配和释放
- 支持多进程独立堆空间
- 地址管理和边界检查

**栈内存 (Shed)**：
- 代码区和资源链接区
- 用于存储常量和静态数据
- 支持字符串和数值存储

**API**：
```javascript
// 分配内存
MemoryManager.allocateMemory(heapId, shedId, heapSize, pid);

// 释放内存
MemoryManager.freeMemory(pid);

// 检查内存使用情况
const memInfo = MemoryManager.checkMemory(pid);

// 注册程序名称
MemoryManager.registerProgramName(pid, 'ProgramName');

// 获取程序名称
const name = MemoryManager.getProgramName(pid);
```

**Exploit 程序（PID 10000）**：
- 作为统一的数据存储中心，管理所有内核动态数据
- 存储终端输出内容（用于 vim 等全屏程序的恢复）
- 存储剪贴板数据（copy/paste 命令）
- 存储每个终端实例的环境变量、命令历史、补全状态
- 存储内核模块的动态数据（通过 KernelMemory 接口）
- 自动分配和管理 Heap 和 Shed 内存（1MB Heap，1000 Shed）

### 3. 文件系统 (FileSystem)

完整的虚拟文件系统实现，支持目录树和文件操作。

**核心组件**：

- **Disk**：虚拟磁盘管理
  - 支持多个磁盘分区（C:、D: 等）
  - 磁盘容量和空间管理
  - 自动计算已用/空闲空间

- **NodeTreeCollection**：文件树集合
  - 目录节点管理（Node）
  - 文件对象管理（FileFormwork）
  - 路径解析和导航

- **FileFormwork**：文件模板
  - 文件元信息（类型、大小、时间戳）
  - 文件内容管理
  - 读写操作

**支持的操作**：
- 创建/删除文件和目录
- 重命名文件和目录
- 移动文件和目录
- 复制文件和目录（递归）
- 文件读写
- 路径解析

**持久化存储**：
- 自动保存到 localStorage
- 启动时自动恢复
- 每个磁盘分区独立存储

### 4. 进程管理 (ProcessManager)

完整的进程生命周期管理系统，负责程序的启动、运行和终止。

**特性**：
- PID 自动分配和管理
- 程序资源管理（脚本、样式、元数据）
- 程序类型识别（CLI/GUI）
- CLI 程序自动启动终端环境
- DOM 元素跟踪和清理
- 程序行为记录和日志
- 共享空间管理（`APPLICATION_SHARED_POOL`）
- 自动启动程序支持（`autoStart` 和 `priority`）

**API**：
```javascript
// 启动程序
const pid = await ProcessManager.startProgram('vim', {
    args: ['file.txt'],
    env: {},
    cwd: 'C:'
});

// 终止程序
await ProcessManager.killProgram(pid, force);

// 获取进程信息
const info = ProcessManager.getProcessInfo(pid);

// 列出所有进程
const processes = ProcessManager.listProcesses();
```

**CLI 程序自动启动终端**：
- 当 CLI 程序独立启动时，如果没有终端环境，ProcessManager 会自动启动终端程序
- 终端程序作为系统内置程序，在系统启动时自动启动（`autoStart: true`）
- 确保 CLI 程序始终有可用的终端环境

### 5. 应用程序资源管理 (ApplicationAssetManager)

管理所有应用程序的资源信息，包括脚本路径、样式表和元数据。

**特性**：
- 程序资源查询和验证
- 自动启动程序列表
- 程序元数据管理
- 资源路径解析

**API**：
```javascript
// 获取程序信息
const info = ApplicationAssetManager.getProgramInfo('vim');

// 列出所有程序
const programs = ApplicationAssetManager.listPrograms();

// 获取自动启动程序
const autoStart = ApplicationAssetManager.getAutoStartPrograms();
```

### 6. 通知管理 (NotificationManager)

统一的系统通知管理系统，负责通知的创建、显示、管理和交互。

**特性**：
- 支持两种通知类型：`snapshot`（快照）和 `dependent`（依赖）
- 水滴展开动画效果（使用 AnimateManager）
- 通知栏面板，支持点击任务栏图标打开
- 蒙版层覆盖，自动检测鼠标离开并关闭
- 任务栏通知数量徽章显示
- 自动关闭支持（可设置时长）
- 通知内容动态更新

**通知类型**：
- **snapshot（快照）**：独立通知，显示标题和内容，有标题栏和关闭按钮
- **dependent（依赖）**：依赖通知，紧贴在快照通知下方，从圆形展开为矩形，用于程序持续显示的内容（如音乐播放器）

**API**：
```javascript
// 创建通知
const notificationId = NotificationManager.createNotification(pid, {
    type: 'snapshot',  // 或 'dependent'
    title: '通知标题',
    content: '通知内容',  // 可以是 HTML 字符串或 HTMLElement
    duration: 5000,  // 自动关闭时长（毫秒，0 表示不自动关闭）
    onClose: (notificationId, pid) => {  // 关闭回调（仅 dependent 类型）
        // 处理关闭逻辑
    }
});

// 移除通知
NotificationManager.removeNotification(notificationId);

// 更新通知内容
NotificationManager.updateNotificationContent(notificationId, newContent);

// 获取通知内容容器（用于动态更新内容）
const container = NotificationManager.getNotificationContentContainer(notificationId);

// 获取通知数量
const count = NotificationManager.getNotificationCount();

// 切换通知栏显示
NotificationManager.toggleNotificationContainer();

// 检查通知栏是否显示
const isShowing = NotificationManager.isShowing();
```

**水滴动画**：
- 通知栏容器使用水滴展开动画（从屏幕边缘滑入并展开）
- 依赖类型通知使用水滴展开动画（从圆形小尺寸变为正常矩形）
- 动画使用 AnimateManager（anime.js），支持降级到 CSS 动画

**任务栏集成**：
- 任务栏显示通知图标和数量徽章
- 点击图标打开/关闭通知栏
- 徽章数量实时更新

### 7. 内核动态数据存储 (KernelMemory)

提供统一接口，管理所有内核模块的动态数据，存储在 Exploit 程序的内存中。

**特性**：
- 统一的数据存取接口
- 自动内存分配和管理
- 数据序列化和反序列化
- 内存使用情况监控

**API**：
```javascript
// 保存数据
KernelMemory.saveData('KEY', data);

// 加载数据
const data = KernelMemory.loadData('KEY');

// 检查数据是否存在
const exists = KernelMemory.hasData('KEY');

// 获取内存使用情况
const usage = KernelMemory.getMemoryUsage();
```

**存储的数据类型**：
- `APPLICATION_SOP` - 应用程序分区管理表
- `PROGRAM_NAMES` - 程序名称映射
- `PROCESS_TABLE` - 进程表
- `NEXT_PID` - 下一个PID
- `NEXT_HEAP_ID` / `NEXT_SHED_ID` - 下一个堆/栈ID
- `DISK_SEPARATE_MAP` / `DISK_SEPARATE_SIZE` - 磁盘分区信息
- `DISK_FREE_MAP` / `DISK_USED_MAP` - 磁盘使用情况
- `DISK_CAN_USED` - 磁盘可用状态

### 7. 终端系统 (Terminal)

Bash 风格的命令行终端界面，提供完整的命令处理能力和窗口管理功能。

**特性**：
- 多标签页支持
- 命令历史记录（存储在 Exploit 程序内存中）
- Tab 自动补全（状态存储在 Exploit 程序内存中）
- 富文本输出（HTML 渲染）
- 事件驱动的命令处理
- 环境变量持久化（存储在 Exploit 程序内存中）
- 终端内容恢复（vim 退出时自动恢复）
- **窗口管理功能**：
  - 关闭窗口（通过 ProcessManager）
  - 全屏/还原切换
  - 窗口拖拽移动
  - 窗口大小拉伸（响应式）
- **TerminalAPI**：暴露到共享空间，供其他程序调用

**内置命令**：
- 文件操作：`ls`, `cd`, `tree`, `cat`, `write`, `rm`, `mv`, `copy`, `paste`, `rename`
- 目录操作：`markdir`, `markfile`
- 系统管理：`ps`, `kill`, `diskmanger`, `power`, `check`
- 编辑器：`vim`
- 工具：`clear`, `help`, `eval`, `pwd`, `whoami`

**窗口管理**：
- 关闭按钮：点击红色关闭按钮，通过 ProcessManager 终止终端程序
- 全屏按钮：点击绿色最大化按钮，切换全屏/还原模式
- 拖拽：在标题栏拖拽移动窗口
- 拉伸：在窗口右下角拖拽调整窗口大小

**窗口管理**：
- 关闭按钮：点击红色关闭按钮，通过 ProcessManager 终止终端程序
- 全屏按钮：点击绿色最大化按钮，切换全屏/还原模式
- 拖拽：在标题栏拖拽移动窗口
- 拉伸：在窗口右下角拖拽调整窗口大小

## 功能特性

### 文件系统特性

1. **多磁盘分区**
   - 默认创建 C: (1GB) 和 D: (2GB)
   - 每个分区独立管理
   - 支持扩展分区配置

2. **完整的目录树**
   - 递归目录结构
   - 路径解析（支持 `.` 和 `..`）
   - 相对路径和绝对路径

3. **文件类型系统**
   - 自动识别文件类型（基于扩展名）
   - 支持多种文件类型：TEXT、CODE、IMAGE、BINARY、JSON、XML、MARKDOWN 等
   - 扩展的类型系统

4. **文件操作**
   - 创建、删除、重命名
   - 移动、复制（递归）
   - 读写文件内容
   - 文件元信息管理

### 内存管理特性

1. **进程隔离**
   - 每个进程独立的内存空间
   - PID 标识进程
   - 进程内存监控
   - 程序名称注册和显示

2. **堆内存管理**
   - 动态分配和释放
   - 地址空间管理
   - 内存碎片处理
   - 字符串和 JSON 数据存储

3. **栈内存管理**
   - 代码区和资源区
   - 常量存储
   - 字符串管理
   - 资源链接和地址映射

4. **Exploit 程序（统一数据存储中心）**
   - PID 固定为 10000
   - 管理所有终端相关的临时数据
   - 200KB Heap 空间用于数据存储
   - 自动初始化和内存分配
   - 存储内容：
     - 终端输出内容（vim 恢复用）
     - 剪贴板数据（copy/paste）
     - 每个终端实例的环境变量
     - 每个终端实例的命令历史
     - 每个终端实例的补全状态

### 终端特性

1. **用户界面**
   - 现代化的终端样式
   - 高对比度配色方案
   - 响应式布局
   - 全屏程序支持（vim 等）

2. **多标签页**
   - 支持多个终端实例
   - 标签页切换
   - 独立的命令历史（每个实例）
   - 独立的环境变量（每个实例）

3. **数据存储架构**
   - 所有终端数据存储在 Exploit 程序（PID 10000）的内存中
   - 命令历史、补全状态、环境变量按终端实例（tabId）区分存储
   - 剪贴板数据全局共享
   - vim 退出时自动恢复终端内容

4. **命令处理**
   - 完整的命令解析
   - 参数处理
   - 错误处理

5. **富文本输出**
   - HTML 渲染支持
   - 颜色和样式
   - Markdown 渲染

6. **鼠标交互**
   - 鼠标滚轮支持（终端输出和 vim 编辑器）
   - 自动滚动

### Vim 文本编辑器

功能完整的文本编辑器，集成到终端中。

**模式**：
- Normal Mode：命令模式
- Insert Mode：插入模式
- Command Mode：命令行模式
- Visual Mode：可视模式

**特性**：
- 完整的键盘快捷键
- 文件读写
- 多行编辑
- 系统剪贴板集成（Ctrl+V 粘贴）
- 鼠标滚轮支持（垂直滚动）
- 美化的 UI 界面（深色主题）
- 全屏显示（占据整个终端窗口）
- 退出时自动恢复终端内容
- 完整依赖内核内存管理（Heap 和 Shed）

## 命令参考

### 文件操作命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `ls [-l] [path]` | 列出目录内容，-l 显示详细信息 | `ls -l /C:/dir` |
| `tree [-L depth] [path]` | 树状显示目录结构 | `tree -L 3` |
| `cd <dir>` | 切换目录 | `cd ..` |
| `cat [-md] <file>` | 显示文件内容，-md 渲染 Markdown | `cat -md readme.md` |
| `write [-a] <file> <text>` | 写入文件，-a 追加模式 | `write file.txt "content"` |
| `rm <file\|dir>` | 删除文件或目录 | `rm oldfile.txt` |

### 目录操作命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `markdir <path>` | 创建目录 | `markdir newdir/subdir` |
| `markfile <path>` | 创建空文件 | `markfile newfile.txt` |
| `rename <old> <new>` | 重命名文件或目录 | `rename old.txt new.txt` |
| `mv <src> <dest>` | 移动文件或目录 | `mv file.txt /D:/backup/` |
| `copy <file\|dir>` | 复制到剪贴板 | `copy file.txt` |
| `paste` | 从剪贴板粘贴 | `paste` |

### 系统管理命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `ps [-l\|--long] [pid]` | 显示进程信息（包含程序名称） | `ps -l 1234` |
| `kill [signal] <pid>` | 终止进程 | `kill -9 1234` |
| `diskmanger [-l\|--list] [disk]` | 磁盘管理，-l 显示详细的文件和目录占用 | `diskmanger -l C:` |
| `power <action>` | 电源管理（reboot/shutdown） | `power reboot` |
| `check` | 全面自检内核并给出详细的检查报告 | `check` |

### 编辑器命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `vim [file]` | 打开 Vim 编辑器 | `vim document.txt` |

### 工具命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `help` | 显示帮助信息 | `help` |
| `clear` | 清屏 | `clear` |
| `pwd` | 显示当前路径 | `pwd` |
| `whoami` | 显示当前用户 | `whoami` |
| `eval <expr>` | 执行 JavaScript 表达式 | `eval 1+1` |

## 技术实现

### 依赖管理

系统使用 `DependencyConfig` 管理模块依赖关系：

```javascript
Dependency.addDependency("../kernel/fileSystem/nodeTree.js");
Dependency.waitLoaded("../kernel/fileSystem/disk.js", {
    interval: 50,
    timeout: 1000
});
```

### 全局对象池

使用 `POOL` 系统管理全局对象：

```javascript
POOL.__INIT__("KERNEL_GLOBAL_POOL");
POOL.__ADD__("KERNEL_GLOBAL_POOL", "WORK_SPACE", "C:");
POOL.__GET__("KERNEL_GLOBAL_POOL", "WORK_SPACE");
```

### 数据持久化

**文件系统持久化**：
- 文件系统数据自动保存到浏览器 localStorage
- 存储键格式：`filesystem_<盘符>`（如 `filesystem_C:`）
- 自动序列化和反序列化
- 启动时自动恢复

**内存数据管理**：
- 所有终端数据和临时数据存储在 Exploit 程序（PID 10000）的内存中
- 包括：命令历史、补全状态、环境变量、剪贴板、终端输出内容
- 数据按终端实例（tabId）区分，互不干扰
- 使用 Heap 存储序列化的 JSON 数据
- 使用 Shed 存储数据地址和元信息

### 日志系统

统一的日志输出格式：

```
[内核][模块名] [级别] <时间戳> - <消息> [元数据]
```

## 使用指南

### 快速开始

1. 打开 `test/index.html` 在浏览器中运行系统
2. 终端启动后会自动显示欢迎信息
3. 输入 `help` 查看所有可用命令
4. 开始使用文件系统和命令

### 基本操作

```bash
# 查看当前目录
pwd

# 列出文件和目录
ls -l

# 创建目录
markdir mydir

# 创建文件
write myfile.txt "Hello, ZerOS!"

# 查看文件内容
cat myfile.txt

# 切换到目录
cd mydir

# 查看目录树
tree
```

### 文件管理示例

```bash
# 创建目录结构
markdir project/src
markdir project/docs

# 创建文件
write project/src/main.js "console.log('Hello');"
write project/README.md "# Project"

# 复制文件
copy project/README.md
cd project/docs
paste

# 重命名
rename README.md README_CN.md

# 移动文件
mv project/src/main.js project/
```

### 内存监控

```bash
# 查看所有进程（显示程序名称）
ps
# 输出示例：
# PID  NAME         HEAPS  SHEDS  TOTAL_HEAP  TOTAL_SHED
# ---  ----         -----  -----  ----------  -----------
# 9999 Vim          1      1      50000       0
# 10000 Exploit     1      1      200000      0

# 查看所有进程详细信息（包含每个堆和栈的详细信息）
ps -l
# 输出包含：HEAP_SIZE, HEAP_USED, HEAP_FREE, SHED_SIZE 等详细信息

# 查看特定进程详细信息
ps -l 9999

# 查看特定进程
ps 10000

# 终止进程
kill 9999
```

**程序名称说明**：
- 已注册的程序会显示其名称（如 "Vim", "Exploit"）
- 未注册的程序显示为 "Program-{pid}"
- 使用 `MemoryManager.registerProgramName(pid, name)` 注册程序名称

### 磁盘管理

```bash
# 查看磁盘使用情况
diskmanger

# 查看详细的文件和目录占用
diskmanger -l

# 查看特定磁盘的详细信息
diskmanger -l C:
```

## 开发指南

### 添加新命令

1. 在 `test/application/terminal/terminal.js` 的 `registerCommandHandlers` 函数中添加命令处理
2. 添加到 `_completionCommands` 列表以支持自动补全
3. 更新 `help` 命令的帮助信息

示例：
```javascript
case 'mycommand':
    // 命令处理逻辑
    payload.write('My command executed');
    break;
```

### 添加新程序

1. 在 `kernel/process/applicationAssets.js` 中添加程序资源映射：
```javascript
"myprogram": {
    script: "../../test/application/myprogram/myprogram.js",
    styles: ["../../test/application/myprogram/myprogram.css"],
    metadata: {
        autoStart: false,
        priority: 1,
        description: "我的程序",
        version: "1.0.0"
    }
}
```

2. 实现程序对象，必须包含：
   - `__init__(pid, initArgs)` - 初始化方法
   - `__exit__(pid, force)` - 退出方法
   - `__info__()` - 程序信息方法

3. 如果是 CLI 程序，ProcessManager 会自动启动终端环境
4. 如果是 GUI 程序，需要实现窗口管理功能（关闭、全屏、拖拽、拉伸）

### 扩展文件系统

1. 在 `kernel/fileSystem/nodeTree.js` 中添加新方法
2. 在 `kernel/fileSystem/type.js` 中扩展类型枚举
3. 更新相关操作以支持新功能

### 添加新模块

1. 在 `kernel/bootloader/starter.js` 中注册依赖
2. 实现模块功能
3. 使用 `DependencyConfig.publishSignal()` 发布信号

### 使用 KernelMemory 存储数据

所有内核动态数据存储都通过 `KernelMemory` 接口，数据存储在 Exploit 程序（PID 10000）的内存中：

```javascript
// 保存数据
KernelMemory.saveData('KEY_NAME', data);

// 加载数据
const data = KernelMemory.loadData('KEY_NAME');

// 检查数据是否存在
const exists = KernelMemory.hasData('KEY_NAME');

// 删除数据
KernelMemory.deleteData('KEY_NAME');
```

**内核数据存储键名规范**：
- `APPLICATION_SOP` - 应用程序分区管理表
- `PROGRAM_NAMES` - 程序名称映射
- `PROCESS_TABLE` - 进程表
- `NEXT_PID` - 下一个PID
- `NEXT_HEAP_ID` / `NEXT_SHED_ID` - 下一个堆/栈ID
- `DISK_SEPARATE_MAP` / `DISK_SEPARATE_SIZE` - 磁盘分区信息
- `DISK_FREE_MAP` / `DISK_USED_MAP` - 磁盘使用情况
- `DISK_CAN_USED` - 磁盘可用状态

**终端数据存储键名规范**（通过终端实例方法）：
- `TERMINAL_{tabId}_ENV` - 终端环境变量
- `TERMINAL_{tabId}_HISTORY` - 命令历史
- `TERMINAL_{tabId}_COMPLETION` - 补全状态
- `TERMINAL_CONTENT_ADDR` - 终端输出内容
- `CLIPBOARD_ADDR` - 剪贴板数据

## 架构设计原则

1. **模块化**：每个功能模块独立，通过依赖注入连接
2. **日志一致性**：所有内核模块使用统一的日志系统
3. **内存安全**：完整的内存管理，支持多进程隔离，NaN 值安全检查
4. **统一数据存储**：所有内核动态数据统一使用 KernelMemory 存储在 Exploit 程序的内存中
5. **持久化**：文件系统自动保存到 localStorage，内核动态数据存储在内存中
6. **可扩展性**：支持添加新命令、新模块、新程序、新功能
7. **程序名称管理**：支持为进程注册和显示程序名称
8. **进程管理**：完整的进程生命周期管理，支持 CLI/GUI 程序
9. **自动启动**：支持程序自动启动和 CLI 程序自动启动终端环境
10. **窗口管理**：所有 GUI 程序支持窗口管理功能（关闭、全屏、拖拽、拉伸）

## 项目结构

```
ZerOS/
├── kernel/                 # 内核模块
│   ├── bootloader/        # 启动引导
│   │   └── starter.js    # 内核启动器
│   ├── fileSystem/        # 文件系统
│   │   ├── disk.js       # 虚拟磁盘管理
│   │   ├── nodeTree.js   # 文件树结构
│   │   ├── fileFramework.js # 文件对象模板
│   │   └── init.js       # 文件系统初始化
│   ├── logger/            # 日志系统
│   │   └── kernelLogger.js # 统一日志管理
│   ├── memory/            # 内存管理
│   │   ├── memoryManager.js # 统一内存管理器
│   │   ├── heap.js       # 堆内存管理
│   │   ├── shed.js       # 栈内存管理
│   │   ├── kernelMemory.js # 内核动态数据存储
│   │   └── memoryUtils.js # 内存工具函数
│   ├── process/           # 进程管理
│   │   ├── processManager.js # 进程生命周期管理
│   │   ├── applicationAssetManager.js # 应用程序资源管理
│   │   ├── applicationAssets.js # 应用程序资源映射
│   │   ├── guiManager.js # GUI窗口管理
│   │   ├── notificationManager.js # 通知管理
│   │   ├── taskbarManager.js # 任务栏管理
│   │   ├── themeManager.js # 主题管理
│   │   ├── eventManager.js # 事件管理
│   │   ├── contextMenuManager.js # 上下文菜单管理
│   │   ├── desktop.js    # 桌面管理
│   │   └── programCategories.js # 程序分类
│   ├── drive/             # 驱动层
│   │   ├── animateManager.js # 动画管理
│   │   ├── networkManager.js # 网络管理
│   │   ├── LStorage.js   # 本地存储
│   │   └── networkServiceWorker.js # 网络服务工作者
│   ├── signal/            # 信号系统
│   │   ├── dependencyConfig.js # 依赖管理和模块加载
│   │   └── pool.js        # 全局对象池
│   ├── dynamicModule/     # 动态模块
│   │   ├── dynamicManager.js # 动态模块管理
│   │   └── libs/          # 第三方库
│   │       ├── anime-4.2.2/ # anime.js 动画库
│   │       ├── animate.min.css # animate.css
│   │       ├── html2canvas.min.js # html2canvas
│   │       └── jquery-3.7.1.min.js # jQuery
│   ├── typePool/          # 类型池
│   │   ├── fileType.js   # 文件类型枚举
│   │   ├── logLevel.js   # 日志级别枚举
│   │   ├── addressType.js # 地址类型枚举
│   │   └── enumManager.js # 枚举管理器
│   └── SystemInformation.js # 系统信息
├── test/                  # 测试和界面
│   ├── application/       # 应用程序
│   │   ├── terminal/     # 终端程序
│   │   ├── vim/          # Vim文本编辑器
│   │   ├── filemanager/  # 文件管理器
│   │   ├── browser/      # 浏览器
│   │   ├── musicplayer/  # 音乐播放器
│   │   └── ...          # 其他应用程序
│   ├── main.js           # 终端主程序
│   ├── index.html        # 入口页面
│   └── core.css          # 样式文件
├── service/               # 服务端（可选）
│   └── test.php          # 测试服务
└── docs/                 # 文档
    ├── API/              # API文档
    │   ├── README.md     # API文档索引
    │   ├── KernelLogger.md # 日志系统API
    │   ├── ProcessManager.md # 进程管理API
    │   ├── MemoryManager.md # 内存管理API
    │   ├── NotificationManager.md # 通知管理API
    │   └── ...          # 其他模块API文档
    ├── LOGGING.md        # 日志系统文档
    ├── TERMINAL_README.md # 终端使用文档
    ├── DEVELOPER_GUIDE.md # 开发者指南
    └── ZEROS_KERNEL.md   # 本文档
```

## 系统架构详解

### Exploit 程序架构

Exploit 程序（PID 10000）是 ZerOS Kernel 的统一数据存储中心，负责管理所有临时数据和终端状态。

**设计目的**：
- 集中管理所有数据存储需求
- 统一使用内核内存管理系统
- 简化数据交换和持久化逻辑
- 提供统一的内存访问接口

**存储的数据类型**：

1. **终端输出内容**
   - 用于全屏程序（如 vim）退出时恢复终端显示
   - 存储格式：JSON 序列化的 HTML 元素数组

2. **剪贴板数据**
   - copy/paste 命令使用
   - 存储文件或目录的路径和元信息

3. **终端实例数据**（按 tabId 区分）
   - 环境变量（user, host, cwd）
   - 命令历史（history 数组和 historyIndex）
   - 补全状态（visible, candidates, index, beforeText, dirPart）

**内存分配**：
- Heap ID: 1
- Shed ID: 1
- Heap Size: 200KB
- 自动初始化和管理

### 数据存储键名规范

所有存储在 Exploit 程序中的数据使用统一的键名规范：

| 键名格式 | 说明 | 示例 |
|---------|------|------|
| `TERMINAL_{tabId}_ENV` | 终端环境变量 | `TERMINAL_tab-1_ENV` |
| `TERMINAL_{tabId}_HISTORY` | 命令历史 | `TERMINAL_tab-1_HISTORY` |
| `TERMINAL_{tabId}_COMPLETION` | 补全状态 | `TERMINAL_tab-1_COMPLETION` |
| `TERMINAL_CONTENT_ADDR` | 终端输出内容地址 | `TERMINAL_CONTENT_ADDR` |
| `CLIPBOARD_ADDR` | 剪贴板数据地址 | `CLIPBOARD_ADDR` |

每个键名都有对应的 `_ADDR` 和 `_SIZE` 后缀，用于存储内存地址和大小信息。

### 数据存储实现细节

**存储流程**：
1. 数据序列化为 JSON 字符串
2. 在 Heap 中分配足够的内存空间
3. 将字符串逐字符写入 Heap
4. 在 Shed 的 `resourceLinkArea` 中保存地址和大小信息
5. 使用统一的键名规范管理

**读取流程**：
1. 从 Shed 的 `resourceLinkArea` 中读取地址信息
2. 从 Heap 中按地址读取字符串数据
3. 反序列化 JSON 字符串恢复数据
4. 返回原始数据结构

**内存管理优势**：
- 统一的内存分配和释放机制
- 自动内存回收（当数据被覆盖时）
- 完整的错误处理和边界检查
- NaN 值安全检查，防止计算错误

## 系统要求

- **浏览器**：支持现代 JavaScript 和 localStorage 的浏览器
- **分辨率**：推荐最小 800x600，最佳 1920x1080
- **存储**：浏览器 localStorage 空间（通常 5-10MB）
- **内存**：Exploit 程序分配 1MB Heap 用于内核动态数据存储

## 许可证

本项目仅供学习和研究使用。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进 ZerOS Kernel。

## 更新日志

### 最新版本特性

- ✅ 完整的文件系统持久化（localStorage）
- ✅ Vim 文本编辑器集成
- ✅ 多标签页终端支持
- ✅ 鼠标滚轮支持（终端和 Vim）
- ✅ 文件和目录移动/复制功能
- ✅ 磁盘使用详细分析（`diskmanger -l`）
- ✅ 系统电源管理（重启/关闭）
- ✅ 欢迎消息系统
- ✅ **Exploit 程序（PID 10000）统一数据存储中心**
- ✅ **终端数据内存管理**：命令历史、补全状态、环境变量统一存储在 Exploit 程序
- ✅ **ps 命令显示程序名称**
- ✅ **Vim 退出时自动恢复终端内容**
- ✅ **内存安全检查**：防止 NaN 值导致的计算错误
- ✅ **程序名称注册系统**：支持为进程注册和显示名称
- ✅ **进程管理系统**：完整的进程生命周期管理（ProcessManager）
- ✅ **应用程序资源管理**：统一的程序资源管理（ApplicationAssetManager）
- ✅ **内核动态数据存储**：所有内核动态数据存储在 Exploit 程序内存（KernelMemory）
- ✅ **CLI 程序自动启动终端**：CLI 程序独立启动时自动启动终端环境
- ✅ **终端窗口管理**：关闭、全屏、拖拽、拉伸功能
- ✅ **TerminalAPI 共享空间**：终端 API 暴露到共享空间，供其他程序调用
- ✅ **check 命令**：全面的内核自检功能
- ✅ **通知管理系统**：完整的通知创建、显示、管理功能，支持快照和依赖类型通知
- ✅ **通知栏面板**：点击任务栏图标打开，支持水滴展开动画
- ✅ **任务栏通知徽章**：实时显示通知数量

---

**ZerOS Kernel** - 一个强大的虚拟操作系统内核，在浏览器中体验完整的系统操作。
