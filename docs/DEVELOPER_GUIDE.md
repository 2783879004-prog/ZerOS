# ZerOS 开发者指南

## 目录

1. [系统概述](#系统概述)
2. [快速开始](#快速开始)
3. [开发约定](#开发约定)
4. [程序结构](#程序结构)
5. [核心 API](#核心-api)
6. [GUI 程序开发](#gui-程序开发)
7. [CLI 程序开发](#cli-程序开发)
8. [主题与样式](#主题与样式)
9. [动画系统](#动画系统)
10. [文件系统](#文件系统)
11. [内存管理](#内存管理)
12. [事件管理](#事件管理)
13. [最佳实践](#最佳实践)
14. [示例代码](#示例代码)

---

## 系统概述

ZerOS 是一个基于浏览器的操作系统内核，提供了完整的进程管理、内存管理、文件系统、GUI 管理和事件管理系统。所有程序必须遵循 ZerOS 的开发约定，通过 ProcessManager 进行生命周期管理。

### 核心组件

- **ProcessManager**: 进程管理器，负责程序的启动、停止和资源分配
- **MemoryManager**: 内存管理器，提供堆（Heap）和栈（Shed）内存
- **GUIManager**: GUI 管理器，统一管理窗口层叠、焦点和模态提示框
- **ThemeManager**: 主题管理器，管理系统的主题和样式
- **AnimateManager**: 动画管理器，提供统一的动画效果
- **EventManager**: 事件管理器，统一管理窗口拖动、拉伸等事件
- **ApplicationAssetManager**: 应用程序资源管理器
- **ContextMenuManager**: 上下文菜单管理器
- **TaskbarManager**: 任务栏管理器
- **NetworkManager**: 网络管理器，提供网络状态和电池信息
- **Disk**: 文件系统接口，提供文件和目录操作
- **POOL**: 全局对象池，用于存储和共享内核对象
- **KernelLogger**: 内核日志系统

---

## 快速开始

### 1. 创建程序文件

在 `test/application/` 目录下创建你的程序目录：

```
test/application/
└── myapp/
    ├── myapp.js          # 主程序文件（必需）
    ├── myapp.css         # 样式文件（可选）
    └── myapp.svg         # 图标文件（可选）
```

### 2. 编写基本程序结构

```javascript
// test/application/myapp/myapp.js
(function(window) {
    'use strict';
    
    const PROGRAM_NAME = 'MYAPP';
    
    const MYAPP = {
        pid: null,
        window: null,
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建窗口
            this.window = document.createElement('div');
            this.window.className = 'myapp-window zos-gui-window';
            this.window.dataset.pid = pid.toString();
            
            // 注册到 GUIManager
            if (typeof GUIManager !== 'undefined') {
                GUIManager.registerWindow(pid, this.window, {
                    title: '我的应用',
                    icon: 'application/myapp/myapp.svg',
                    onClose: () => {
                        ProcessManager.killProgram(pid);
                    }
                });
            }
            
            // 添加到容器
            guiContainer.appendChild(this.window);
        },
        
        __exit__: async function() {
            if (typeof GUIManager !== 'undefined') {
                GUIManager.unregisterWindow(this.pid);
            } else if (this.window && this.window.parentElement) {
                this.window.parentElement.removeChild(this.window);
            }
        },
        
        __info__: function() {
            return {
                name: 'myapp',
                type: 'GUI',
                version: '1.0.0',
                description: '我的应用程序',
                author: 'Your Name',
                copyright: '© 2024',
                metadata: {
                    allowMultipleInstances: true
                }
            };
        }
    };
    
    // 导出到全局作用域
    if (typeof window !== 'undefined') {
        window[PROGRAM_NAME] = MYAPP;
    } else if (typeof globalThis !== 'undefined') {
        globalThis[PROGRAM_NAME] = MYAPP;
    }
    
})(typeof window !== 'undefined' ? window : globalThis);
```

### 3. 注册程序

在 `kernel/process/applicationAssets.js` 中注册你的程序：

```javascript
const APPLICATION_ASSETS = {
    "myapp": {
        script: "application/myapp/myapp.js",
        styles: ["application/myapp/myapp.css"],
        icon: "application/myapp/myapp.svg",
        assets: [
            // 可选：程序需要的资源文件
            "application/myapp/assets/icon1.svg",
            "application/myapp/assets/font.woff2"
        ],
        metadata: {
            autoStart: false,
            priority: 1,
            description: "我的应用程序",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: true
        }
    }
};
```

### 4. 运行程序

程序可以通过以下方式启动：

- 从任务栏的"所有程序"菜单启动
- 通过 `ProcessManager.startProgram('myapp', {})` 启动
- 如果设置了 `autoStart: true`，系统启动时自动运行

---

## 开发约定

### 1. 禁止自动初始化

**重要**: 程序必须禁止自动初始化，包括：

- ❌ 禁止使用立即调用函数表达式（IIFE）执行初始化代码
- ❌ 禁止在脚本顶层执行初始化代码
- ❌ 禁止自动创建 DOM 元素
- ❌ 禁止自动注册事件监听器

**正确做法**:

```javascript
// ❌ 错误：自动初始化
(function() {
    const app = new MyApp();
    app.init();
})();

// ✅ 正确：等待 ProcessManager 调用
const MYAPP = {
    __init__: async function(pid, initArgs) {
        // 初始化代码
    }
};
```

### 2. 程序导出格式

程序必须导出为全局对象，命名规则：**程序名全大写**。

```javascript
// 程序名: myapp
// 导出对象名: MYAPP
const MYAPP = {
    __init__: async function(pid, initArgs) { /* ... */ },
    __exit__: async function() { /* ... */ },
    __info__: function() { /* ... */ }
};
```

### 3. DOM 元素标记

所有程序创建的 DOM 元素必须标记 `data-pid` 属性：

```javascript
const element = document.createElement('div');
element.dataset.pid = this.pid.toString();
```

### 4. 错误处理

始终使用 try-catch 处理异步操作：

```javascript
__init__: async function(pid, initArgs) {
    try {
        await this._initialize();
    } catch (error) {
        console.error('初始化失败:', error);
        // 清理已创建的资源
    }
}
```

---

## 程序结构

### 必需方法

#### `__init__(pid, initArgs)`

程序初始化方法，由 ProcessManager 在程序启动时调用。

**参数**:
- `pid` (number): 进程 ID，由 ProcessManager 分配
- `initArgs` (Object): 初始化参数对象
  ```javascript
  {
      pid: number,              // 进程 ID
      args: Array,              // 命令行参数
      env: Object,              // 环境变量
      cwd: string,              // 当前工作目录（如 "C:"）
      terminal: Object,         // 终端实例（仅 CLI 程序）
      guiContainer: HTMLElement, // GUI 容器（仅 GUI 程序）
      metadata: Object,         // 元数据
      // ... 其他自定义参数
  }
  ```

**返回值**: `Promise<void>`

#### `__exit__()`

程序退出方法，由 ProcessManager 在程序关闭时调用。

**职责**:
- 清理 DOM 元素
- 取消事件监听器
- 释放内存引用
- 保存用户数据

**返回值**: `Promise<void>`

#### `__info__()`

程序信息方法，返回程序的元数据。

**返回值**: `Object`

**必需字段**:
- `name` (string): 程序名称
- `type` (string): 程序类型，`'GUI'` 或 `'CLI'`
- `version` (string): 版本号
- `description` (string): 程序描述
- `author` (string): 作者
- `copyright` (string): 版权信息

**可选字段**:
- `metadata` (Object): 额外元数据
  - `allowMultipleInstances` (boolean): 是否支持多实例

---

## 核心 API

### ProcessManager API

#### `ProcessManager.startProgram(programName, initArgs)`

启动一个程序。

**参数**:
- `programName` (string): 程序名称
- `initArgs` (Object): 初始化参数

**返回值**: `Promise<number>` - 进程 ID

**示例**:
```javascript
const pid = await ProcessManager.startProgram('myapp', {
    args: ['file.txt'],
    cwd: 'C:/Users',
    env: { USER: 'admin' }
});
```

#### `ProcessManager.killProgram(pid, force)`

终止一个程序。

**参数**:
- `pid` (number): 进程 ID
- `force` (boolean): 是否强制终止（默认 false）

**返回值**: `Promise<boolean>` - 是否成功

#### `ProcessManager.getProcessInfo(pid)`

获取进程信息。

**参数**:
- `pid` (number): 进程 ID

**返回值**: `Object` - 进程信息对象

#### `ProcessManager.listProcesses()`

列出所有进程。

**返回值**: `Array<Object>` - 进程信息数组

#### `ProcessManager.allocateMemory(pid, heapSize, shedSize, refId)`

为程序分配内存。

**参数**:
- `pid` (number): 进程 ID
- `heapSize` (number): 堆内存大小（字节，-1 表示使用默认值）
- `shedSize` (number): 栈内存大小（字节，-1 表示使用默认值）
- `refId` (string): 内存引用 ID（可选）

**返回值**: `Promise<Object>` - 内存引用对象

**示例**:
```javascript
const memoryRef = await ProcessManager.allocateMemory(this.pid, 1024, 512, 'myData');
// memoryRef: { refId: string, heap: Heap, heapId: number, shed: Shed, shedId: number }
```

### GUIManager API

#### `GUIManager.registerWindow(pid, windowElement, options)`

注册窗口到 GUIManager。

**参数**:
- `pid` (number): 进程 ID
- `windowElement` (HTMLElement): 窗口元素
- `options` (Object): 选项对象
  - `title` (string): 窗口标题
  - `icon` (string): 窗口图标路径（可选）
  - `onClose` (Function): 关闭回调
  - `onMinimize` (Function): 最小化回调（可选）
  - `onMaximize` (Function): 最大化回调（可选）

**示例**:
```javascript
GUIManager.registerWindow(pid, windowElement, {
    title: '我的应用',
    icon: 'application/myapp/myapp.svg',
    onClose: () => {
        ProcessManager.killProgram(pid);
    }
});
```

#### `GUIManager.focusWindow(pid)`

将窗口置于最前并获得焦点。

#### `GUIManager.minimizeWindow(pid)`

最小化窗口。

#### `GUIManager.restoreWindow(pid)`

恢复窗口。

#### `GUIManager.toggleMaximize(pid)`

切换最大化状态。

#### `GUIManager.unregisterWindow(pid)`

注销窗口。

#### `GUIManager.showAlert(message, title, type)`

显示提示框（替代 `alert()`）。

**参数**:
- `message` (string): 提示消息
- `title` (string): 标题（可选，默认：'提示'）
- `type` (string): 类型（可选，默认：'info'）
  - `'info'`: 信息提示
  - `'success'`: 成功提示
  - `'warning'`: 警告提示
  - `'error'`: 错误提示

**返回值**: `Promise<void>`

#### `GUIManager.showConfirm(message, title, type)`

显示确认对话框（替代 `confirm()`）。

**参数**:
- `message` (string): 确认消息
- `title` (string): 标题（可选，默认：'确认'）
- `type` (string): 类型（可选，默认：'warning'）

**返回值**: `Promise<boolean>` - `true` 表示确认，`false` 表示取消

#### `GUIManager.showPrompt(message, title, defaultValue)`

显示输入对话框（替代 `prompt()`）。

**参数**:
- `message` (string): 提示消息
- `title` (string): 标题（可选，默认：'输入'）
- `defaultValue` (string): 默认值（可选，默认：''）

**返回值**: `Promise<string|null>` - 用户输入的值，取消返回 `null`

### ThemeManager API

#### `ThemeManager.getCurrentTheme()`

获取当前主题。

**返回值**: `Object` - 主题对象

#### `ThemeManager.getCurrentStyle()`

获取当前样式。

**返回值**: `Object` - 样式对象

#### `ThemeManager.registerTheme(themeId, theme)`

注册自定义主题。

**参数**:
- `themeId` (string): 主题 ID
- `theme` (Object): 主题对象

#### `ThemeManager.onThemeChange(listener)`

监听主题变更。

**参数**:
- `listener` (Function): 回调函数 `(themeId, theme) => {}`

#### `ThemeManager.onStyleChange(listener)`

监听样式变更。

**参数**:
- `listener` (Function): 回调函数 `(styleId, style) => {}`

### AnimateManager API

#### `AnimateManager.addAnimationClasses(element, category, action, customConfig)`

为元素添加动画类。

**参数**:
- `element` (HTMLElement): 目标元素
- `category` (string): 动画类别（如 'DIALOG', 'BUTTON'）
- `action` (string): 动画动作（如 'OPEN', 'CLOSE', 'HOVER'）
- `customConfig` (Object): 自定义配置（可选）

**返回值**: `Object` - 动画配置对象

**示例**:
```javascript
AnimateManager.addAnimationClasses(dialog, 'DIALOG', 'OPEN');
```

#### `AnimateManager.getAnimationDuration(category, action)`

获取动画时长。

**参数**:
- `category` (string): 动画类别
- `action` (string): 动画动作

**返回值**: `number` - 动画时长（毫秒）

### EventManager API

#### `EventManager.registerDrag(windowId, element, window, state, onDragStart, onDrag, onDragEnd, excludeSelectors)`

注册窗口拖动事件。

**参数**:
- `windowId` (string): 窗口唯一标识
- `element` (HTMLElement): 可拖动的元素（通常是标题栏）
- `window` (HTMLElement): 窗口元素
- `state` (Object): 窗口状态对象
- `onDragStart` (Function): 拖动开始回调
- `onDrag` (Function): 拖动中回调
- `onDragEnd` (Function): 拖动结束回调
- `excludeSelectors` (Array<string>): 排除的选择器

#### `EventManager.registerResizer(resizerId, resizerElement, window, state, onResizeStart, onResize, onResizeEnd)`

注册窗口拉伸事件。

**参数**:
- `resizerId` (string): 拉伸器唯一标识
- `resizerElement` (HTMLElement): 拉伸器元素
- `window` (HTMLElement): 窗口元素
- `state` (Object): 窗口状态对象
- `onResizeStart` (Function): 拉伸开始回调
- `onResize` (Function): 拉伸中回调
- `onResizeEnd` (Function): 拉伸结束回调

### Disk API

#### `Disk.readFile(path)`

读取文件内容。

**参数**:
- `path` (string): 文件路径（如 `"C:/file.txt"`）

**返回值**: `Promise<string>` - 文件内容

#### `Disk.writeFile(path, content)`

写入文件内容。

**参数**:
- `path` (string): 文件路径
- `content` (string): 文件内容

**返回值**: `Promise<boolean>` - 是否成功

#### `Disk.createFile(path, content, fileType)`

创建文件。

**参数**:
- `path` (string): 文件路径
- `content` (string): 文件内容
- `fileType` (string): 文件类型（可选）

**返回值**: `Promise<boolean>` - 是否成功

#### `Disk.deleteFile(path)`

删除文件。

**参数**:
- `path` (string): 文件路径

**返回值**: `Promise<boolean>` - 是否成功

#### `Disk.listFiles(path)`

列出目录中的文件。

**参数**:
- `path` (string): 目录路径

**返回值**: `Promise<Array>` - 文件列表

#### `Disk.createDirectory(path)`

创建目录。

**参数**:
- `path` (string): 目录路径

**返回值**: `Promise<boolean>` - 是否成功

#### `Disk.deleteDirectory(path)`

删除目录。

**参数**:
- `path` (string): 目录路径

**返回值**: `Promise<boolean>` - 是否成功

### POOL API

POOL 是全局对象池，用于存储和共享内核对象。

#### `POOL.__INIT__(type)`

初始化一个类别。

**参数**:
- `type` (string): 类别名称

#### `POOL.__ADD__(type, name, value)`

向类别添加元素。

**参数**:
- `type` (string): 类别名称
- `name` (string): 元素名称
- `value` (*): 元素值

#### `POOL.__GET__(type, name)`

从类别获取元素。

**参数**:
- `type` (string): 类别名称
- `name` (string): 元素名称

**返回值**: `*` - 元素值，如果不存在返回 `undefined`

#### `POOL.__HAS__(type)`

检查类别是否存在。

**参数**:
- `type` (string): 类别名称

**返回值**: `boolean`

#### `POOL.__REMOVE__(type, name)`

从类别移除元素。

**参数**:
- `type` (string): 类别名称
- `name` (string): 元素名称

### NetworkManager API

#### `NetworkManager.getNetworkState(pid)`

获取网络状态。

**参数**:
- `pid` (number): 进程 ID（可选）

**返回值**: `Promise<Object>` - 网络状态对象

#### `NetworkManager.isNetworkOnline(pid)`

检查网络是否在线。

**参数**:
- `pid` (number): 进程 ID（可选）

**返回值**: `Promise<boolean>`

#### `NetworkManager.getBatteryInfo(pid)`

获取电池信息。

**参数**:
- `pid` (number): 进程 ID（可选）

**返回值**: `Promise<Object>` - 电池信息对象

---

## GUI 程序开发

### 基本结构

GUI 程序必须将 UI 渲染到指定的容器中：

```javascript
__init__: async function(pid, initArgs) {
    this.pid = pid;
    
    // 获取 GUI 容器
    const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
    
    // 创建窗口元素
    this.window = document.createElement('div');
    this.window.className = 'myapp-window zos-gui-window';
    this.window.dataset.pid = pid.toString();
    
    // 注册到 GUIManager（推荐）
    if (typeof GUIManager !== 'undefined') {
        GUIManager.registerWindow(pid, this.window, {
            title: '我的应用',
            icon: 'application/myapp/myapp.svg',
            onClose: () => {
                ProcessManager.killProgram(pid);
            }
        });
    }
    
    // 添加到容器
    guiContainer.appendChild(this.window);
}
```

### 使用主题变量

在 CSS 中使用主题变量，确保程序能够响应主题切换：

```css
.myapp-window {
    background: var(--theme-background-elevated, rgba(37, 43, 53, 0.98));
    border: 1px solid var(--theme-border, rgba(139, 92, 246, 0.3));
    color: var(--theme-text, #d7e0dd);
}

.myapp-button {
    background: var(--theme-primary, #8b5cf6);
    color: var(--theme-text-on-primary, #ffffff);
}

.myapp-button:hover {
    background: var(--theme-primary-hover, #7c3aed);
}
```

### 窗口控制

如果使用 GUIManager，窗口的拖动、拉伸、最小化、最大化等功能会自动处理。如果需要自定义，可以使用 EventManager：

```javascript
// 注册拖动事件
EventManager.registerDrag(
    `myapp-window-${this.pid}`,
    titleBar,
    this.window,
    this.windowState,
    (e) => { /* 拖动开始 */ },
    (e) => { /* 拖动中 */ },
    (e) => { /* 拖动结束 */ },
    ['.button', '.controls']
);
```

---

## CLI 程序开发

### 基本结构

CLI 程序通过 `initArgs.terminal` 获取终端实例：

```javascript
__init__: async function(pid, initArgs) {
    this.pid = pid;
    this.terminal = initArgs.terminal;
    
    if (!this.terminal) {
        throw new Error('CLI程序需要终端环境');
    }
    
    // 使用终端 API
    this.terminal.write('Hello from CLI program\n');
    this.terminal.setCwd('C:/Users');
}
```

### 终端 API

通过共享空间访问终端 API：

```javascript
// 获取终端 API
const terminalAPI = POOL.__GET__("APPLICATION_SHARED_POOL", "TerminalAPI");

if (terminalAPI) {
    // 写入输出
    terminalAPI.write('Hello\n');
    
    // 清空输出
    terminalAPI.clear();
    
    // 设置工作目录
    terminalAPI.setCwd('C:/Users');
    
    // 获取环境变量
    const env = terminalAPI.getEnv();
    
    // 设置环境变量
    terminalAPI.setEnv({ KEY: 'value' });
}
```

### 命令行参数解析

```javascript
__init__: async function(pid, initArgs) {
    const args = initArgs.args || [];
    
    // 解析参数
    if (args.length > 0) {
        const filename = args[0];
        // 处理文件
    }
}
```

---

## 主题与样式

### 使用主题变量

ZerOS 提供了丰富的 CSS 变量，用于主题和样式管理：

**背景颜色**:
- `--theme-background`: 主背景色
- `--theme-background-secondary`: 次要背景色
- `--theme-background-tertiary`: 第三级背景色
- `--theme-background-elevated`: 提升的背景色（用于窗口）

**文本颜色**:
- `--theme-text`: 主文本色
- `--theme-text-secondary`: 次要文本色
- `--theme-text-muted`: 弱化文本色

**边框颜色**:
- `--theme-border`: 主边框色
- `--theme-border-light`: 浅边框色

**主题色**:
- `--theme-primary`: 主色调
- `--theme-primary-light`: 浅主色调
- `--theme-primary-dark`: 深主色调
- `--theme-primary-hover`: 悬停主色调
- `--theme-primary-glow`: 主色发光效果
- `--theme-secondary`: 次要色调
- `--theme-secondary-light`: 浅次要色调
- `--theme-secondary-glow`: 次要色发光效果

**状态色**:
- `--theme-success`: 成功色
- `--theme-success-light`: 浅成功色
- `--theme-success-glow`: 成功色发光效果
- `--theme-warning`: 警告色
- `--theme-warning-light`: 浅警告色
- `--theme-warning-glow`: 警告色发光效果
- `--theme-error`: 错误色
- `--theme-error-light`: 浅错误色
- `--theme-error-glow`: 错误色发光效果
- `--theme-info`: 信息色
- `--theme-info-light`: 浅信息色

**样式变量**:
- `--style-window-border-radius`: 窗口圆角
- `--style-window-backdrop-filter`: 窗口背景模糊
- `--style-window-box-shadow-focused`: 焦点窗口阴影
- `--style-taskbar-backdrop-filter`: 任务栏背景模糊
- `--style-taskbar-box-shadow`: 任务栏阴影

### 监听主题变更

程序可以监听主题变更，动态更新 UI：

```javascript
// 监听主题变更
if (typeof ThemeManager !== 'undefined') {
    ThemeManager.onThemeChange((themeId, theme) => {
        // 更新程序 UI
        this._updateTheme(theme);
    });
    
    ThemeManager.onStyleChange((styleId, style) => {
        // 更新程序样式
        this._updateStyle(style);
    });
}
```

### 注册自定义主题

```javascript
// 注册自定义主题
ThemeManager.registerTheme('my-theme', {
    id: 'my-theme',
    name: '我的主题',
    description: '自定义主题描述',
    colors: {
        background: '#000000',
        text: '#ffffff',
        primary: '#ff0000',
        // ... 其他颜色
    }
});

// 应用主题
ThemeManager._applyTheme('my-theme');
```

---

## 动画系统

### 使用 AnimateManager

AnimateManager 提供了统一的动画系统，支持多种动画类别和动作：

```javascript
// 添加动画类
AnimateManager.addAnimationClasses(element, 'DIALOG', 'OPEN');

// 获取动画时长
const duration = AnimateManager.getAnimationDuration('DIALOG', 'OPEN');

// 移除动画类
AnimateManager.removeAnimationClasses(element);
```

### 动画类别

常用的动画类别包括：

- **DIALOG**: 对话框动画（OPEN, CLOSE）
- **BUTTON**: 按钮动画（HOVER, CLICK）
- **WINDOW**: 窗口动画（OPEN, CLOSE, MINIMIZE, RESTORE）
- **MENU**: 菜单动画（OPEN, CLOSE）

### 自定义动画配置

```javascript
// 使用自定义配置
AnimateManager.addAnimationClasses(element, 'DIALOG', 'OPEN', {
    duration: 500,
    easing: 'ease-in-out',
    delay: 100
});
```

### 悬停和点击动画

```javascript
// 应用悬停动画
AnimateManager.applyHoverAnimation(button);

// 应用点击动画
AnimateManager.applyClickAnimation(button);

// 移除悬停动画
AnimateManager.removeHoverAnimation(button);
```

---

## 文件系统

### 路径格式

ZerOS 使用盘符路径格式：

- **绝对路径**: `"C:/path/to/file.txt"`
- **相对路径**: `"./file.txt"` 或 `"../file.txt"`
- **盘符根路径**: `"/file.txt"` (相对于当前盘符根)

### 文件操作示例

```javascript
// 读取文件
const content = await Disk.readFile('C:/file.txt');

// 写入文件
await Disk.writeFile('C:/file.txt', 'New content');

// 创建文件
await Disk.createFile('C:/newfile.txt', 'Content', 'TEXT');

// 删除文件
await Disk.deleteFile('C:/file.txt');

// 列出目录文件
const files = await Disk.listFiles('C:/');
files.forEach(file => {
    console.log(file.name, file.type);
});

// 创建目录
await Disk.createDirectory('C:/mydir');

// 删除目录
await Disk.deleteDirectory('C:/mydir');
```

### 文件属性

文件支持以下属性（位标志）：

- `READ_ONLY`: 只读
- `NO_READ`: 不可读
- `NO_DELETE`: 不可删除
- `NO_MOVE`: 不可移动
- `NO_RENAME`: 不可重命名

---

## 内存管理

### 内存分配

所有内存请求必须通过 ProcessManager 提交：

```javascript
// 分配内存（堆和栈）
const memoryRef = await ProcessManager.allocateMemory(
    this.pid, 
    1024,  // 堆内存大小（字节，-1 表示使用默认值）
    512,   // 栈内存大小（字节，-1 表示使用默认值）
    'myData'  // 内存引用 ID（可选）
);

// memoryRef 结构:
// {
//     refId: string,
//     heap: Heap,
//     heapId: number,
//     shed: Shed,
//     shedId: number
// }
```

### 使用堆内存

```javascript
const heap = memoryRef.heap;

// 分配内存块
const addr = heap.allocate(100, 'myKey');

// 写入数据
heap.writeData(addr, 'Hello World');

// 读取数据
const data = heap.readString(addr, 11);

// 删除数据
heap.deleteData(addr);
```

### 使用栈内存

```javascript
const shed = memoryRef.shed;

// 写入代码
shed.writeCode(0, 'function code');

// 读取代码
const code = shed.readCode(0);
```

### 内存清理

在 `__exit__` 中清理内存引用：

```javascript
__exit__: async function() {
    // 释放内存引用
    if (this.memoryRefs) {
        for (const [refId, ref] of this.memoryRefs) {
            await ProcessManager.freeMemoryRef(this.pid, refId);
        }
        this.memoryRefs.clear();
    }
}
```

### 内存引用管理

```javascript
// 存储内存引用
this.memoryRefs = new Map();

// 分配并存储
const memoryRef = await ProcessManager.allocateMemory(this.pid, 1024, 512, 'myData');
this.memoryRefs.set('myData', memoryRef);

// 获取内存引用
const ref = this.memoryRefs.get('myData');
```

---

## 事件管理

### 窗口拖动

使用 EventManager 管理窗口拖动：

```javascript
// 注册拖动事件
EventManager.registerDrag(
    `myapp-window-${this.pid}`,  // 窗口唯一标识
    titleBar,                     // 可拖动的元素（通常是标题栏）
    this.window,                   // 窗口元素
    this.windowState,              // 窗口状态对象
    // onDragStart
    (e) => {
        this.windowState.isDragging = true;
        this.windowState.dragStartX = e.clientX;
        this.windowState.dragStartY = e.clientY;
        const rect = this.window.getBoundingClientRect();
        this.windowState.dragStartLeft = rect.left;
        this.windowState.dragStartTop = rect.top;
    },
    // onDrag
    (e) => {
        const deltaX = e.clientX - this.windowState.dragStartX;
        const deltaY = e.clientY - this.windowState.dragStartY;
        
        // 边界检查
        const guiContainer = document.getElementById('gui-container');
        if (guiContainer) {
            const containerRect = guiContainer.getBoundingClientRect();
            const winWidth = this.window.offsetWidth;
            const winHeight = this.window.offsetHeight;
            
            let newLeft = this.windowState.dragStartLeft + deltaX;
            let newTop = this.windowState.dragStartTop + deltaY;
            
            newLeft = Math.max(containerRect.left, Math.min(newLeft, containerRect.right - winWidth));
            newTop = Math.max(containerRect.top, Math.min(newTop, containerRect.bottom - winHeight));
            
            this.window.style.left = newLeft + 'px';
            this.window.style.top = newTop + 'px';
        }
    },
    // onDragEnd
    (e) => {
        this.windowState.isDragging = false;
    },
    ['.button', '.controls']  // 排除的选择器
);
```

### 窗口拉伸

使用 EventManager 管理窗口拉伸：

```javascript
// 创建拉伸器元素
const resizer = document.createElement('div');
resizer.className = 'window-resizer';
resizer.style.cssText = `
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    cursor: se-resize;
`;

// 注册拉伸事件
EventManager.registerResizer(
    `myapp-resizer-${this.pid}`,  // 拉伸器唯一标识
    resizer,                       // 拉伸器元素
    this.window,                   // 窗口元素
    this.windowState,              // 窗口状态对象
    // onResizeStart
    (e) => {
        this.windowState.isResizing = true;
        this.windowState.resizeStartX = e.clientX;
        this.windowState.resizeStartY = e.clientY;
        const rect = this.window.getBoundingClientRect();
        this.windowState.resizeStartWidth = rect.width;
        this.windowState.resizeStartHeight = rect.height;
    },
    // onResize
    (e) => {
        const deltaX = e.clientX - this.windowState.resizeStartX;
        const deltaY = e.clientY - this.windowState.resizeStartY;
        const newWidth = Math.max(400, this.windowState.resizeStartWidth + deltaX);
        const newHeight = Math.max(300, this.windowState.resizeStartHeight + deltaY);
        this.window.style.width = newWidth + 'px';
        this.window.style.height = newHeight + 'px';
    },
    // onResizeEnd
    (e) => {
        this.windowState.isResizing = false;
    }
);
```

**注意**: 如果使用 GUIManager，窗口的拖动和拉伸会自动处理，无需手动注册事件。

---

## 最佳实践

### 1. 禁止自动初始化

**重要**: 程序绝对不能自动初始化。所有初始化代码必须在 `__init__` 方法中执行。

```javascript
// ❌ 错误：自动初始化
const MYAPP = {
    data: (function() {
        // 自动执行的代码
        return {};
    })()
};

// ✅ 正确：在 __init__ 中初始化
const MYAPP = {
    data: null,
    __init__: async function(pid, initArgs) {
        this.data = {};
    }
};
```

### 2. DOM 元素标记

所有程序创建的 DOM 元素必须标记 `data-pid` 属性：

```javascript
const element = document.createElement('div');
element.dataset.pid = this.pid.toString();
```

### 3. 错误处理

始终使用 try-catch 处理异步操作：

```javascript
__init__: async function(pid, initArgs) {
    try {
        await this._initialize();
    } catch (error) {
        console.error('初始化失败:', error);
        // 清理已创建的资源
        if (this.window && this.window.parentElement) {
            this.window.parentElement.removeChild(this.window);
        }
    }
}
```

### 4. 资源清理

在 `__exit__` 中清理所有资源：

```javascript
__exit__: async function() {
    // 清理 DOM
    if (this.window && this.window.parentElement) {
        this.window.parentElement.removeChild(this.window);
    }
    
    // 取消事件监听器
    if (this.eventListeners) {
        this.eventListeners.forEach(({element, event, handler}) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }
    
    // 释放内存
    if (this.memoryRefs) {
        for (const [refId, ref] of this.memoryRefs) {
            await ProcessManager.freeMemoryRef(this.pid, refId);
        }
        this.memoryRefs.clear();
    }
    
    // 注销窗口
    if (typeof GUIManager !== 'undefined') {
        GUIManager.unregisterWindow(this.pid);
    }
}
```

### 5. 使用主题变量

在 CSS 中使用主题变量，确保程序能够响应主题切换：

```css
.myapp-window {
    background: var(--theme-background-elevated, rgba(37, 43, 53, 0.98));
    border: 1px solid var(--theme-border, rgba(139, 92, 246, 0.3));
    color: var(--theme-text, #d7e0dd);
}

.myapp-button {
    background: var(--theme-primary, #8b5cf6);
    color: var(--theme-text-on-primary, #ffffff);
}

.myapp-button:hover {
    background: var(--theme-primary-hover, #7c3aed);
}
```

### 6. 使用 GUIManager

推荐使用 GUIManager 管理窗口，获得统一的窗口管理功能：

```javascript
// 注册窗口到 GUIManager
GUIManager.registerWindow(pid, this.window, {
    title: '我的应用',
    icon: 'application/myapp/myapp.svg',
    onClose: () => {
        ProcessManager.killProgram(pid);
    },
    onMinimize: () => {
        // 自定义最小化处理
    },
    onMaximize: () => {
        // 自定义最大化处理
    }
});
```

### 7. 异步操作

`__init__` 和 `__exit__` 必须是异步函数：

```javascript
__init__: async function(pid, initArgs) {
    // 可以使用 await
    await this._loadData();
    await this._initializeUI();
}
```

### 8. 多实例支持

如果程序支持多实例，在 `__info__` 中声明：

```javascript
__info__: function() {
    return {
        // ...
        metadata: {
            allowMultipleInstances: true
        }
    };
}
```

### 9. GUI 容器

GUI 程序必须将 UI 渲染到 `initArgs.guiContainer` 中：

```javascript
const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
guiContainer.appendChild(this.window);
```

### 10. 共享空间使用

程序间通信应使用共享空间：

```javascript
// 设置共享数据
const sharedSpace = ProcessManager.getSharedSpace();
sharedSpace.setData('myKey', { data: 'value' });

// 获取共享数据
const data = sharedSpace.getData('myKey');
```

---

## 示例代码

### 完整的 GUI 程序示例

```javascript
// test/application/myapp/myapp.js
(function(window) {
    'use strict';
    
    const PROGRAM_NAME = 'MYAPP';
    
    const MYAPP = {
        pid: null,
        window: null,
        windowState: null,
        eventListeners: [],
        memoryRefs: new Map(),
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            try {
                // 获取 GUI 容器
                const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
                
                // 创建窗口元素
                this.window = document.createElement('div');
                this.window.className = 'myapp-window zos-gui-window';
                this.window.dataset.pid = pid.toString();
                this.window.style.cssText = `
                    position: fixed;
                    width: 800px;
                    height: 600px;
                    background: var(--theme-background-elevated, rgba(37, 43, 53, 0.98));
                    border: 1px solid var(--theme-border, rgba(139, 92, 246, 0.3));
                    border-radius: var(--style-window-border-radius, 12px);
                    box-shadow: var(--style-window-box-shadow-focused, 0 12px 40px rgba(0, 0, 0, 0.5));
                    backdrop-filter: var(--style-window-backdrop-filter, blur(30px) saturate(180%));
                    color: var(--theme-text, #d7e0dd);
                `;
                
                // 注册到 GUIManager
                if (typeof GUIManager !== 'undefined') {
                    GUIManager.registerWindow(pid, this.window, {
                        title: '我的应用',
                        icon: 'application/myapp/myapp.svg',
                        onClose: () => {
                            ProcessManager.killProgram(pid);
                        }
                    });
                }
                
                // 创建内容
                const content = document.createElement('div');
                content.textContent = 'Hello, ZerOS!';
                content.style.cssText = 'padding: 20px;';
                this.window.appendChild(content);
                
                // 添加到容器
                guiContainer.appendChild(this.window);
                
                // 初始化窗口状态
                this.windowState = {
                    isFullscreen: false,
                    isDragging: false,
                    isResizing: false
                };
                
                // 分配内存（示例）
                const memoryRef = await ProcessManager.allocateMemory(this.pid, 1024, 512, 'myData');
                this.memoryRefs.set('myData', memoryRef);
                
            } catch (error) {
                console.error('初始化失败:', error);
                if (this.window && this.window.parentElement) {
                    this.window.parentElement.removeChild(this.window);
                }
                throw error;
            }
        },
        
        __exit__: async function() {
            // 清理事件监听器
            if (this.eventListeners) {
                this.eventListeners.forEach(({element, event, handler}) => {
                    element.removeEventListener(event, handler);
                });
                this.eventListeners = [];
            }
            
            // 释放内存
            if (this.memoryRefs) {
                for (const [refId, ref] of this.memoryRefs) {
                    await ProcessManager.freeMemoryRef(this.pid, refId);
                }
                this.memoryRefs.clear();
            }
            
            // 注销窗口
            if (typeof GUIManager !== 'undefined') {
                GUIManager.unregisterWindow(this.pid);
            } else if (this.window && this.window.parentElement) {
                this.window.parentElement.removeChild(this.window);
            }
        },
        
        __info__: function() {
            return {
                name: 'myapp',
                type: 'GUI',
                version: '1.0.0',
                description: '我的应用程序示例',
                author: 'Your Name',
                copyright: '© 2024',
                metadata: {
                    allowMultipleInstances: true
                }
            };
        }
    };
    
    // 导出到全局作用域
    if (typeof window !== 'undefined') {
        window[PROGRAM_NAME] = MYAPP;
    } else if (typeof globalThis !== 'undefined') {
        globalThis[PROGRAM_NAME] = MYAPP;
    }
    
})(typeof window !== 'undefined' ? window : globalThis);
```

### 完整的 CLI 程序示例

```javascript
// test/application/mycli/mycli.js
(function(window) {
    'use strict';
    
    const PROGRAM_NAME = 'MYCLI';
    
    const MYCLI = {
        pid: null,
        terminal: null,
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            this.terminal = initArgs.terminal;
            
            if (!this.terminal) {
                throw new Error('CLI程序需要终端环境');
            }
            
            // 获取命令行参数
            const args = initArgs.args || [];
            
            // 输出欢迎信息
            this.terminal.write('MyCLI v1.0.0\n');
            this.terminal.write('Type "help" for help\n');
            
            // 处理参数
            if (args.length > 0) {
                const filename = args[0];
                this.terminal.write(`Processing file: ${filename}\n`);
                // 处理文件
            }
        },
        
        __exit__: async function() {
            // CLI 程序清理
            if (this.terminal) {
                this.terminal.write('MyCLI exited\n');
            }
        },
        
        __info__: function() {
            return {
                name: 'mycli',
                type: 'CLI',
                version: '1.0.0',
                description: '我的CLI程序示例',
                author: 'Your Name',
                copyright: '© 2024',
                metadata: {
                    allowMultipleInstances: false
                }
            };
        }
    };
    
    // 导出到全局作用域
    if (typeof window !== 'undefined') {
        window[PROGRAM_NAME] = MYCLI;
    } else if (typeof globalThis !== 'undefined') {
        globalThis[PROGRAM_NAME] = MYCLI;
    }
    
})(typeof window !== 'undefined' ? window : globalThis);
```

---

## 总结

开发 ZerOS 程序时，请遵循以下原则：

1. ✅ **禁止自动初始化** - 所有初始化在 `__init__` 中执行
2. ✅ **实现必需方法** - `__init__`, `__exit__`, `__info__`
3. ✅ **使用 ProcessManager** - 所有资源请求通过 ProcessManager
4. ✅ **标记 DOM 元素** - 使用 `data-pid` 属性
5. ✅ **清理资源** - 在 `__exit__` 中清理所有资源
6. ✅ **错误处理** - 使用 try-catch 处理异步操作
7. ✅ **事件管理** - 使用 EventManager 管理窗口事件（或使用 GUIManager）
8. ✅ **GUI 容器** - GUI 程序渲染到指定容器
9. ✅ **共享空间** - 程序间通信使用共享空间
10. ✅ **主题变量** - 使用 CSS 变量支持主题切换
11. ✅ **文档化** - 为你的程序编写清晰的注释

---

## 常见问题

### Q: 如何调试程序？

A: 使用浏览器开发者工具（F12）查看控制台日志。ZerOS 使用 `KernelLogger` 记录日志，可以通过 `ProcessManager.setLogLevel()` 设置日志级别。

### Q: 程序启动失败怎么办？

A: 检查以下几点：
1. 程序是否正确导出为全局对象（程序名全大写）
2. 是否实现了 `__init__`, `__exit__`, `__info__` 方法
3. 是否在 `applicationAssets.js` 中注册了程序
4. 查看浏览器控制台的错误信息

### Q: 如何获取其他程序的 API？

A: 通过 POOL 共享空间获取：

```javascript
const otherProgramAPI = POOL.__GET__("APPLICATION_SHARED_POOL", "OtherProgramAPI");
if (otherProgramAPI) {
    otherProgramAPI.someMethod();
}
```

### Q: 如何监听系统事件？

A: 通过 EventManager 或直接使用 DOM 事件。对于窗口事件，推荐使用 GUIManager。

### Q: 如何保存用户数据？

A: 使用 Disk API 保存到文件系统：

```javascript
await Disk.writeFile('C:/Users/username/data.json', JSON.stringify(data));
```

### Q: 程序支持多实例吗？

A: 在 `__info__` 的 `metadata` 中设置 `allowMultipleInstances: true`。注意：每个实例都有独立的 PID。

---

## 参考资源

- **示例程序**: 查看 `test/application/` 目录下的示例程序
  - `terminal/`: 终端程序示例
  - `vim/`: 文本编辑器示例
  - `filemanager/`: 文件管理器示例
  - `browser/`: 浏览器示例

- **内核模块**: 查看 `kernel/` 目录下的内核模块实现

- **样式参考**: 查看 `test/core.css` 了解系统样式和主题变量

---

**祝开发愉快！**

如有问题，请参考现有程序的实现或查看内核模块的源代码。
