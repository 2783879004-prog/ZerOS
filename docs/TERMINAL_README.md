**Terminal 使用说明**

此文档描述位于 `test/main.js` 中的简易 Bash 风格前端终端（黑白高对比），以及对外暴露的可编程接口和示例。

**概述**:
- **位置**: `test/main.js`、样式在 `test/core.css`，入口页面为 `test/index.html`。
- **目标**: 提供一个全屏、黑白高对比度的 Bash 风格 UI 框架；命令处理由用户通过事件或 handler 注入；不执行真实系统命令。

**导出对象**:
- **`window.Terminal`** / **`window.BashTerminal`**: 单例对象，包含下列方法和属性。

**主要属性**:
- `env`: 当前环境对象，形如 `{ user, host, cwd }`，可直接读写（修改后建议调用对应 setter）。
- `history`: 命令历史数组（最新命令追加到尾部）。

**主要方法（API）**:
- `setCwd(path)` : 设置当前工作目录并刷新 prompt。
- `setUser(user)` : 设置用户名并刷新 prompt。
- `setHost(host)` : 设置主机名并刷新 prompt。
- `clear()` : 清空输出区域。
- `write(textOrOptions)` : 向输出区域写入内容，支持多种格式（见下方详细说明）。
- `focus()` : 将输入聚焦到命令输入位置。
- `setCommandHandler(fn)` : 向后兼容的直接替换命令处理函数。签名：`fn(cmdString, argsArray, env, write, done)`。

**事件模型（推荐）**:
该终端支持事件驱动的命令处理，使得多个模块可同时监听或替换命令行为。
- `on(eventName, handler)` : 注册监听器，返回取消监听的函数。
  - 使用示例: `Terminal.on('command', payload => { ... })`。
- `off(eventName, handler)` : 注销监听器。
- `emit(eventName, payload)` : 触发事件（内部用于触发 `command`）。

`command` 事件的 `payload` 结构（事件监听器接收一个对象）:

```
{
  cmdString: '原始命令文本',
  args: ['被空白分割的参数数组'],
  env: { user, host, cwd },
  write: function(textOrOptions) { ... }, // 向终端输出（支持多种格式）
  done: function() {} // 占位回调
}
```

**write API 详细说明**:

`write` 方法支持多种调用方式，保持向后兼容：

1. **纯文本模式（向后兼容）**:
   ```javascript
   write('Hello World');  // 自动转义 HTML，安全显示
   ```

2. **对象模式 - 纯文本**:
   ```javascript
   write({ text: 'Hello World' });  // 显式指定文本模式
   ```

3. **HTML 渲染模式**:
   ```javascript
   write({ html: '<span style="color: red;">红色文本</span>' });  // 直接渲染 HTML
   ```

4. **带 CSS 类的文本**:
   ```javascript
   write({ text: 'Hello', className: 'highlight' });  // 添加自定义 CSS 类
   ```

5. **带 CSS 类的 HTML**:
   ```javascript
   write({ 
     html: '<span>内容</span>', 
     className: 'custom-class' 
   });
   ```

6. **自定义样式**:
   ```javascript
   write({ 
     text: 'Hello',
     style: { color: 'red', fontWeight: 'bold' }
   });
   ```

**完整参数对象**:
```javascript
{
  text: string,        // 纯文本内容（自动转义）
  html: string,       // HTML 片段（直接渲染，注意安全性）
  className: string,   // 自定义 CSS 类名
  style: object       // 内联样式对象
}
```

**注意事项**:
- 使用 `html` 参数时，内容会直接插入 DOM，请确保内容安全，避免 XSS 攻击
- 如果同时提供 `text` 和 `html`，`html` 优先
- 向后兼容：传入字符串时自动按文本模式处理

事件触发规则：当用户在 UI 中按 Enter
- 终端会先 `emit('command', payload)`；如果有至少一个 listener 返回（即存在 listener），则不会调用向后兼容的 `setCommandHandler`；如果无 listener，则使用 `commandHandler`（默认提供简单的 switch 实现）。

**默认命令（向后兼容 handler）**:
- `clear` : 清屏
- `pwd` : 显示当前 `cwd`
- `whoami` : 显示当前 `user`
- `ls [-l] [path]` : 列出目录内容
  - 无参数：显示当前目录的文件和目录名
  - `-l` 参数：显示详细信息，包括：
    - 权限（PERMS）
    - 链接数（LINKS）
    - 所有者（OWNER）- 使用当前用户
    - 文件类型（TYPE）- 根据扩展名自动识别（TEXT, CODE, IMAGE, JSON, XML, MARKDOWN, CONFIG, DATA, BINARY 等）
    - 文件大小（SIZE）
    - 修改时间（MODIFIED）
    - 文件名（NAME）- 目录显示为绿色，文件类型有颜色标记
- 其它 : 输出 `cmd: command not found`

**交互细节**:
- 输入采用 `contenteditable` 元素实现，支持普通文本输入与粘贴（粘贴会被强制为纯文本）。
- 支持命令历史（向上/向下方向键）：按 `↑`/`↓` 导航历史条目。
- 提交命令后 UI 会将输入回显到输出区域并清空当前输入。

**如何运行/测试**:
1. 用浏览器打开 `test/index.html`（在 Windows PowerShell 中可运行：）

```powershell
start "" "d:\Project\Algorithm\FileSystem\test\index.html"
```

2. 打开浏览器开发者工具的 Console，可通过以下示例动态接入自己的命令处理逻辑：

示例：使用事件监听处理命令（推荐）

```javascript
// 使用事件驱动处理器
const off = window.Terminal.on('command', ({cmdString, args, env, write}) => {
  if(!cmdString) return;
  const cmd = args[0];
  switch(cmd){
    case 'echo':
    **主要方法（API）**:
    - `setCwd(path)` : 设置当前工作目录并刷新 prompt。
    - `setUser(user)` : 设置用户名并刷新 prompt。
    - `setHost(host)` : 设置主机名并刷新 prompt。
    - `clear()` : 清空输出区域。
    - `write(text)` : 向输出区域写入一行文本（不会被解析为命令）。
    - `focus()` : 将输入聚焦到命令输入位置。
    - `setCommandHandler(fn)` : 向后兼容的直接替换命令处理函数。签名：`fn(cmdString, argsArray, env, write, done, cancelToken)`。
    - `on(eventName, fn)` / `off(eventName, fn)` / `emit(eventName, payload)` : 事件 API，推荐使用 `on('command', handler)` 来处理命令。
    - `minimize()` / `maximize()` / `centerOrRestore()` : 窗口控制 API，分别用于最小化、最大化与居中/还原。
    - `cancelCurrent()` : 取消当前正在运行的命令（若该命令支持 `cancelToken`），同时模拟 `Ctrl+C` 输出。
    - `config` : 可读写配置对象（见下），可通过 `setConfig(obj)` 合并并应用。
  }
    **事件触发规则：当用户在 UI 中按 Enter**
    - 终端会先 `emit('command', payload)`；如果存在监听器，则会按注册顺序调用这些监听器并等待它们的返回值（若返回 Promise 会等待完成）。
    - 如果没有任何监听器，终端会调用 `setCommandHandler` 注册的 handler（向后兼容）。

    **取消 / Ctrl 键说明**
    - `Ctrl+C`：取消当前命令（若命令实现对 `cancelToken` 有响应会中止），并恢复输入。调用 `Terminal.cancelCurrent()` 也可达到相同效果。
    - `Ctrl+L`：清屏（等同于 `clear`）。
    - `Ctrl+D`：在空输入时会输出 `logout`（示例行为），你可以用事件处理器拦截该信号。

示例：使用向后兼容的 handler

```javascript
window.Terminal.setCommandHandler(function(cmdString, args, env, write){
  if(!cmdString) return;
  if(args[0] === 'greet') write('Hello from handler');
  else write(args[0] + ': command not found (from handler)');
});
```

示例：修改环境

```javascript
window.Terminal.setUser('alice');
window.Terminal.setHost('workstation');
window.Terminal.setCwd('/home/alice');
```

示例：使用扩展的 write API

```javascript
// 向后兼容：纯文本
Terminal.write('Hello World');

// HTML 渲染
Terminal.write({ 
  html: '<span style="color: #00ff00;">绿色文本</span>' 
});

// 带 CSS 类的文本
Terminal.write({ 
  text: '高亮文本', 
  className: 'highlight' 
});

// 自定义样式
Terminal.write({ 
  text: '红色粗体', 
  style: { color: 'red', fontWeight: 'bold' } 
});

// 在命令处理中使用
Terminal.on('command', ({ write, args }) => {
  if (args[0] === 'color') {
    write({ html: '<span style="color: #4a9eff;">蓝色</span> <span style="color: #00ff00;">绿色</span>' });
  }
});
```

**已实现的扩展功能**:
- ✅ `write` API 支持 HTML 渲染和自定义样式
- ✅ `ls -l` 命令显示文件类型、所有者等详细信息，并使用颜色标记
- ✅ 文件类型自动识别（基于扩展名）
- ✅ 支持异步命令处理（Promise）
- ✅ Tab 补全支持

**扩展建议**（可选实现）:
- 实现前缀搜索历史或可配置的命令别名
- 支持更多文件类型的识别和显示
- 添加文件权限管理功能

---
文件位置说明：
    示例：使用事件监听处理命令（推荐）

    ```javascript
    // 使用事件驱动处理器（支持异步和 cancelToken）
    const off = window.Terminal.on('command', async ({cmdString, args, env, write, cancelToken}) => {
      if(!cmdString) return;
      const cmd = args[0];
      switch(cmd){
        case 'echo':
          write(args.slice(1).join(' '));
          break;
        case 'wait':
          write('starting...');
          // support cancellation
          for(let i=0;i<5;i++){
             if(cancelToken && cancelToken.cancelled){ write('cancelled'); return; }
             await new Promise(r=>setTimeout(r,500));
          }
          write('done');
          break;
        case 'ls':
          write('(示例) 列出目录 — 请接入你的文件系统实现');
          break;
        default:
          write(cmd + ': command not found (handler overridden)');
      }
    });
- 页面： `test/index.html`
- 样式： `test/core.css`
- 终端逻辑： `test/main.js`
- 本文档： `test/TERMINAL_README.md`

如需我把 README 转为 HTML 内嵌到 `index.html` 作为演示或添加演示脚本，请告诉我下一步要做的内容。
