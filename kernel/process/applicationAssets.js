// 该文件用于存放所有应用程序的启动文件和元数据
// 注意：程序必须禁止自动初始化（包括立即调用函数）
// 程序只能调用依赖管理器去注册自己的加载
// 程序必须导出 [程序名(大写全拼)] 对象，并实现 __init__ , __info__ 和 __exit__ 方法
//
// 资源文件支持：
// - script: 主脚本文件路径（必需）
// - styles: 样式文件路径数组（可选）
// - icon: 程序图标路径（可选）
// - assets: 程序资源文件（可选）
//   - 支持字符串（单个资源）或数组（多个资源）
//   - 支持图片（svg, png, jpg, gif, webp, ico）
//   - 支持字体（woff, woff2, ttf, otf, eot）
//   - 支持其他数据文件（JSON等）
//   - 示例: assets: ["application/myapp/assets/icon.svg", "application/myapp/assets/font.woff2"]
// - metadata: 程序元数据（可选）
//   - supportsPreview: boolean (可选) - 是否支持窗口预览快照，如果为true，当程序只有单例运行时，会使用html2canvas生成真实的窗口快照

const APPLICATION_ASSETS = {
    // 终端程序（ZerOS内置终端，永恒存在）
    // 注意：路径是相对于 test/index.html 的路径
    "terminal": {
        script: "application/terminal/terminal.js",
        styles: ["application/terminal/terminal.css"],
        icon: "application/terminal/terminal.svg",
        // assets: 程序资源文件（可选）
        // 支持字符串（单个资源）或数组（多个资源）
        // 资源可以是图片、字体、数据文件等
        // assets: ["application/terminal/assets/icon1.svg", "application/terminal/assets/icon2.png"],
        metadata: {
            autoStart: false,  // 终端应该自动启动（作为系统内置终端）
            priority: 0,  // 最高优先级
            description: "ZerOS Bash风格终端（内置终端，永恒存在）",
            version: "1.0.0",
            alwaysShowInTaskbar: true,  // 常显在任务栏（即使未运行也显示）
            allowMultipleInstances: true,  // 支持多开
            supportsPreview: true,  // 支持窗口预览快照
            category: "system"  // 系统应用
        }
    },
    
    // Vim编辑器
    // 注意：路径是相对于 test/index.html 的路径
    "vim": {
        script: "application/vim/vim.js",
        styles: ["application/vim/vim.css"],
        icon: "application/vim/vim.svg",
        // assets: 程序资源文件（可选）
        // assets: ["application/vim/assets/icon.svg"],
        metadata: {
            autoStart: false,
            priority: 1,
            description: "Vim文本编辑器",
            version: "1.0.0",
            alwaysShowInTaskbar: false,  // 不常显在任务栏（仅在运行时显示）
            supportsPreview: true,  // 支持窗口预览快照
            category: "utility"  // 轻松使用
        }
    },
    
    // 任务管理器
    // 注意：路径是相对于 test/index.html 的路径
    "taskmanager": {
        script: "application/taskmanager/taskmanager.js",
        styles: ["application/taskmanager/taskmanager.css"],
        icon: "application/taskmanager/taskmanager.svg",
        metadata: {
            autoStart: false,
            priority: 2,
            description: "ZerOS 任务管理器 - 进程管理、资源监控和系统检测",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: false,
            supportsPreview: true,  // 支持窗口预览快照
            category: "system"  // 系统应用
        }
    },
    
    // 文件管理器
    // 注意：路径是相对于 test/index.html 的路径
    "filemanager": {
        script: "application/filemanager/filemanager.js",
        styles: ["application/filemanager/filemanager.css"],
        icon: "application/filemanager/filemanager.svg",
        // 程序资源文件
        assets: [
            "application/filemanager/assets/folder.svg",
            "application/filemanager/assets/file.svg",
            "application/filemanager/assets/file-text.svg",
            "application/filemanager/assets/file-code.svg",
            "application/filemanager/assets/file-image.svg",
            "application/filemanager/assets/info.svg",
            "application/filemanager/assets/edit.svg",
            "application/filemanager/assets/trash.svg",
            "application/filemanager/assets/copy.svg",
            "application/filemanager/assets/move.svg"
        ],
        metadata: {
            autoStart: false,
            priority: 3,
            description: "ZerOS 文件管理器 - 图形化文件浏览、编辑和管理",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: true,
            allowMultipleInstances: true,
            supportsPreview: true,  // 支持窗口预览快照
            category: "system"  // 系统应用
        }
    },
    
    // 贪吃蛇游戏
    // 注意：路径是相对于 test/index.html 的路径
    "snake": {
        script: "application/snake/snake.js",
        styles: ["application/snake/snake.css"],
        icon: "application/snake/snake.svg",
        metadata: {
            autoStart: false,
            priority: 4,
            description: "贪吃蛇游戏 - 经典的贪吃蛇小游戏，支持难度递增、游戏统计",
            version: "1.1.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: true,
            supportsPreview: true,  // 支持窗口预览快照
            category: "other"  // 其他程序
        }
    },
    
    // 浏览器
    // 注意：路径是相对于 test/index.html 的路径
    "browser": {
        script: "application/browser/browser.js",
        styles: ["application/browser/browser.css"],
        icon: "application/browser/browser.svg",
        assets: [
            "application/browser/assets/booklink.js"
        ],
        metadata: {
            autoStart: false,
            priority: 5,
            description: "ZerOS 浏览器 - 基于iframe的简单网页浏览器",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: true,
            supportsPreview: true,  // 支持窗口预览快照
            category: "utility"  // 轻松使用
        }
    },
    
    // 主题与动画管理器
    // 注意：路径是相对于 test/index.html 的路径
    "themeanimator": {
        script: "application/themeanimator/themeanimator.js",
        styles: ["application/themeanimator/themeanimator.css"],
        icon: "application/themeanimator/themeanimator.svg",
        metadata: {
            autoStart: false,
            priority: 6,
            description: "主题与动画管理器 - 系统主题与动画的调控与管理",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: false,
            supportsPreview: true,  // 支持窗口预览快照
            category: "utility"  // 轻松使用
        }
    },
    
    // ZerOS 系统信息
    // 注意：路径是相对于 test/index.html 的路径
    "about": {
        script: "application/about/about.js",
        styles: ["application/about/about.css"],
        icon: "application/about/about.svg",
        metadata: {
            autoStart: false,
            priority: 7,
            description: "关于 ZerOS - 系统版本、内核版本、宿主环境信息和开发者信息",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: false,
            supportsPreview: true,  // 支持窗口预览快照
            category: "system",  // 系统应用
            showOnDesktop: false  // 在桌面显示快捷方式
        }
    },
    
    // 音乐播放器
    // 注意：路径是相对于 test/index.html 的路径
    "musicplayer": {
        script: "application/musicplayer/musicplayer.js",
        styles: ["application/musicplayer/musicplayer.css"],
        icon: "application/musicplayer/musicplayer.svg",
        metadata: {
            autoStart: false,
            priority: 8,
            description: "音乐播放器 - 高仿网易云音乐风格的在线音乐播放器",
            version: "1.0.0",
            type: "GUI",
            alwaysShowInTaskbar: false,
            allowMultipleInstances: true,
            supportsPreview: true,  // 支持窗口预览快照
            category: "other"  // 其他应用
        }
    }
};

// 不导出到全局作用域，交由POOL管理
// 通过POOL注册（如果POOL已加载）
if (typeof POOL !== 'undefined' && typeof POOL.__ADD__ === 'function') {
    try {
        // 确保 KERNEL_GLOBAL_POOL 类别存在
        if (!POOL.__HAS__("KERNEL_GLOBAL_POOL")) {
            POOL.__INIT__("KERNEL_GLOBAL_POOL");
        }
        POOL.__ADD__("KERNEL_GLOBAL_POOL", "APPLICATION_ASSETS", APPLICATION_ASSETS);
    } catch (e) {
        // POOL 可能还未完全初始化，暂时导出到全局作为降级方案
        if (typeof window !== 'undefined') {
            window.APPLICATION_ASSETS = APPLICATION_ASSETS;
        } else if (typeof globalThis !== 'undefined') {
            globalThis.APPLICATION_ASSETS = APPLICATION_ASSETS;
        }
    }
} else {
    // POOL不可用，降级到全局对象
    if (typeof window !== 'undefined') {
        window.APPLICATION_ASSETS = APPLICATION_ASSETS;
    } else if (typeof globalThis !== 'undefined') {
        globalThis.APPLICATION_ASSETS = APPLICATION_ASSETS;
    }
}

// 发布信号
if (typeof DependencyConfig !== 'undefined') {
    DependencyConfig.publishSignal("../kernel/process/applicationAssets.js");
} else {
    // 如果 DependencyConfig 还未加载，延迟发布信号
    if (typeof document !== 'undefined' && document.body) {
        const publishWhenReady = () => {
            if (typeof DependencyConfig !== 'undefined') {
                DependencyConfig.publishSignal("../kernel/process/applicationAssets.js");
            } else {
                setTimeout(publishWhenReady, 10);
            }
        };
        publishWhenReady();
    }
}