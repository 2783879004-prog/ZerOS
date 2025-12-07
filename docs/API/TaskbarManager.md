# TaskbarManager API 文档

## 概述

`TaskbarManager` 是 ZerOS 内核的任务栏管理器，负责渲染任务栏，显示常显程序和正在运行的程序。提供任务栏位置管理、程序图标显示、通知徽章等功能。

## 依赖

- `ProcessManager` - 进程管理器（用于获取运行中的程序）
- `ApplicationAssetManager` - 应用程序资源管理器（用于获取程序信息）
- `GUIManager` - GUI 管理器（用于窗口管理）
- `ThemeManager` - 主题管理器（用于系统图标）
- `NotificationManager` - 通知管理器（用于通知徽章）
- `LStorage` - 本地存储（用于保存任务栏位置）

## 初始化

任务栏在系统启动时自动初始化：

```javascript
TaskbarManager.init();
```

## API 方法

### 任务栏管理

#### `init()`

初始化任务栏。

**示例**:
```javascript
TaskbarManager.init();
```

#### `update()`

更新任务栏（重新渲染）。

**示例**:
```javascript
TaskbarManager.update();
```

## 任务栏功能

### 程序显示

任务栏自动显示：

1. **常显程序**: 标记为 `alwaysShowInTaskbar: true` 的程序
2. **运行中的程序**: 当前正在运行的程序（包括最小化的程序）
3. **系统按钮**: 通知按钮、电源按钮等

### 程序状态指示

- **运行中**: 程序图标正常显示
- **最小化**: 程序图标可能显示为最小化状态
- **多实例**: 同一程序的多个实例会合并显示

### 通知徽章

任务栏显示通知图标和数量徽章：

- 通知图标：点击打开/关闭通知栏
- 数量徽章：实时显示通知数量

### 任务栏位置

任务栏支持四个位置：

- `bottom` - 底部（默认）
- `top` - 顶部
- `left` - 左侧
- `right` - 右侧

任务栏位置会自动保存到 LStorage，并在下次启动时恢复。

## 使用示例

### 示例 1: 手动更新任务栏

```javascript
// 在程序启动或关闭后更新任务栏
await ProcessManager.startProgram('myapp');
TaskbarManager.update();
```

### 示例 2: 获取任务栏位置

```javascript
// 任务栏位置存储在 TaskbarManager._taskbarPosition
// 注意：这是私有属性，通常不需要直接访问
```

## 任务栏结构

任务栏包含以下部分：

1. **左侧容器**: 常显程序和运行中的程序
2. **右侧容器**: 系统按钮（通知、电源等）

## 注意事项

1. **自动更新**: 任务栏会自动监听进程变化并更新，通常不需要手动调用 `update()`
2. **程序图标**: 程序图标从 `ApplicationAssetManager` 获取
3. **系统图标**: 系统图标根据当前主题风格自动更新
4. **通知徽章**: 通知数量由 `NotificationManager` 提供
5. **任务栏位置**: 任务栏位置设置会自动保存和应用

## 相关文档

- [ZEROS_KERNEL.md](../ZEROS_KERNEL.md) - 内核概述
- [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) - 开发者指南
- [ProcessManager.md](./ProcessManager.md) - 进程管理器 API
- [NotificationManager.md](./NotificationManager.md) - 通知管理器 API
- [ThemeManager.md](./ThemeManager.md) - 主题管理器 API

