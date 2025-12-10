# ZerOS Kernel - 虚拟内核操作系统

## 声明

1. 本系统内所有的音乐API均由笒鬼鬼提供,由此涉及的所有问题,与ZerOS开发组和笒鬼鬼无关,如有侵权,请联系删除 
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
- **丰富的命令集**：文件操作、目录管理、进程监控、文本编辑器、内核自检等
- **模块化架构**：基于依赖注入的模块系统，支持异步加载
- **程序管理**：应用程序资源管理，自动启动程序，CLI程序自动启动终端环境
- **主题系统**：支持主题（颜色）和风格（GUI样式）的独立管理，支持 GIF 动图作为桌面背景
- **GUI 管理**：完整的窗口管理、任务栏、通知系统、上下文菜单、事件管理
- **内核自检**：全面的系统健康检查功能，支持通过 `check` 命令进行内核自检

## 快速开始

### 运行系统

1. 打开 `test/index.html` 在浏览器中运行系统
2. 终端启动后会自动显示欢迎信息
3. 输入 `help` 查看所有可用命令
4. 开始使用文件系统和命令

### 基本命令

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

# 查看目录树
tree

# 内核自检
check
```

## 系统架构概览

ZerOS Kernel 采用模块化架构，主要包含以下核心模块：

- **日志系统**：KernelLogger - 统一的日志管理
- **启动引导**：Starter - 内核启动器，Pool - 全局对象池
- **信号系统**：DependencyConfig - 依赖管理和模块加载
- **内存管理**：Heap、Shed、MemoryManager、KernelMemory
- **进程管理**：ProcessManager、PermissionManager、ApplicationAssetManager
- **GUI 管理**：GUIManager、NotificationManager、TaskbarManager、ThemeManager、EventManager、ContextMenuManager、DesktopManager
- **驱动层**：AnimateManager、NetworkManager、LStorage
- **文件系统**：Disk、NodeTree、FileFormwork、Type

详细架构说明请参考 [内核架构文档](docs/ZEROS_KERNEL.md)

## 文档导航

- **[开发者指南](docs/DEVELOPER_GUIDE.md)** - 如何在 ZerOS 上开发程序
- **[内核架构](docs/ZEROS_KERNEL.md)** - 系统架构和模块设计详解
- **[API 文档](docs/API/README.md)** - 完整的 API 参考文档

## 项目结构

```
ZerOS/
├── kernel/                 # 内核模块
│   ├── bootloader/        # 启动引导
│   ├── fileSystem/        # 文件系统
│   ├── logger/            # 日志系统
│   ├── memory/            # 内存管理
│   ├── process/           # 进程管理
│   ├── drive/             # 驱动层
│   ├── signal/            # 信号系统
│   └── typePool/          # 类型池
├── service/               # 服务端（PHP 文件系统驱动）
│   └── DISK/              # 虚拟磁盘存储
├── test/                  # 测试和界面
│   ├── application/       # 应用程序
│   ├── index.html         # 入口页面
│   └── core.css           # 样式文件
└── docs/                  # 文档
    ├── API/               # API 文档
    ├── DEVELOPER_GUIDE.md # 开发者指南
    └── ZEROS_KERNEL.md    # 内核架构文档
```

## 系统要求

- **浏览器**：支持现代 JavaScript 和 localStorage 的浏览器
- **分辨率**：推荐最小 800x600，最佳 1920x1080
- **存储**：浏览器 localStorage 空间（通常 5-10MB）
- **服务端**（可选）：PHP 服务用于文件系统持久化

## 许可证

GNU GENERAL PUBLIC LICENSE VERSION 2.0 (参见 LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request 来改进 ZerOS Kernel。

## 更新日志

### 最新版本特性

- ✅ **GIF 动图背景支持**：支持使用 GIF 动图作为桌面背景，自动循环播放
- ✅ **主题系统增强**：支持本地图片（JPG、PNG、GIF、WebP 等）作为桌面背景，自动持久化保存
- ✅ **check 命令**：全面的内核自检功能，检查核心模块、文件系统、内存管理、进程管理、GUI 管理、主题系统等
- ✅ **通知管理系统**：完整的通知创建、显示、管理功能，支持快照和依赖类型通知
- ✅ **多任务切换器**：Ctrl + 鼠标左键打开全屏多任务选择器，支持鼠标滚轮选择
- ✅ **上下文菜单系统**：完整的右键菜单管理，支持程序注册自定义菜单
- ✅ **事件管理系统**：统一的窗口拖动、拉伸事件管理

更多特性请查看 [更新日志](docs/ZEROS_KERNEL.md#更新日志)

---

**ZerOS Kernel** - 一个强大的虚拟操作系统内核，在浏览器中体验完整的系统操作。
