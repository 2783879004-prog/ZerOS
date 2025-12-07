// 主题管理器
// 负责统一管理整个系统的GUI主题与风格
// 依赖 LStorage 保存主题设置到 D:/LocalSData.json
// 支持主题（颜色）和风格（GUI样式）的独立管理

KernelLogger.info("ThemeManager", "模块初始化");

class ThemeManager {
    // 当前主题ID
    static _currentThemeId = null;
    // 当前风格ID
    static _currentStyleId = null;
    // 主题定义
    static _themes = new Map();
    // 风格定义
    static _styles = new Map();
    // 主题变更监听器
    static _themeChangeListeners = [];
    // 风格变更监听器
    static _styleChangeListeners = [];
    // 是否已初始化
    static _initialized = false;
    
    // 存储键
    static STORAGE_KEY_THEME = 'system.theme';
    static STORAGE_KEY_STYLE = 'system.style';
    static STORAGE_KEY_DESKTOP_BACKGROUND = 'system.desktopBackground';
    
    // 当前桌面背景图ID
    static _currentDesktopBackgroundId = null;
    
    // 桌面背景图定义
    static _desktopBackgrounds = new Map();
    
    /**
     * 初始化主题管理器
     * @returns {Promise<void>}
     */
    static async init() {
        if (ThemeManager._initialized) {
            KernelLogger.debug("ThemeManager", "已初始化，跳过");
            return;
        }
        
        KernelLogger.info("ThemeManager", "初始化主题管理器");
        
        // 注册内置主题和风格
        ThemeManager._registerBuiltinThemes();
        ThemeManager._registerBuiltinStyles();
        
        // 注册内置桌面背景图
        ThemeManager._registerBuiltinDesktopBackgrounds();
        
        // 从 LStorage 加载保存的主题和风格
        if (typeof LStorage !== 'undefined') {
            try {
                const savedThemeId = await LStorage.getSystemStorage(ThemeManager.STORAGE_KEY_THEME);
                if (savedThemeId && ThemeManager._themes.has(savedThemeId)) {
                    ThemeManager._currentThemeId = savedThemeId;
                    KernelLogger.info("ThemeManager", `加载保存的主题: ${savedThemeId}`);
                } else {
                    ThemeManager._currentThemeId = 'default';
                    KernelLogger.info("ThemeManager", "使用默认主题");
                }
                
                const savedStyleId = await LStorage.getSystemStorage(ThemeManager.STORAGE_KEY_STYLE);
                if (savedStyleId && ThemeManager._styles.has(savedStyleId)) {
                    ThemeManager._currentStyleId = savedStyleId;
                    KernelLogger.info("ThemeManager", `加载保存的风格: ${savedStyleId}`);
                } else {
                    ThemeManager._currentStyleId = 'ubuntu';
                    KernelLogger.info("ThemeManager", "使用默认风格");
                }
                
                const savedBackgroundId = await LStorage.getSystemStorage(ThemeManager.STORAGE_KEY_DESKTOP_BACKGROUND);
                // 确保 savedBackgroundId 是有效的字符串
                if (savedBackgroundId && typeof savedBackgroundId === 'string' && savedBackgroundId.trim() !== '') {
                    const trimmedId = savedBackgroundId.trim();
                    if (ThemeManager._desktopBackgrounds.has(trimmedId)) {
                        ThemeManager._currentDesktopBackgroundId = trimmedId;
                        KernelLogger.info("ThemeManager", `加载保存的桌面背景: ${trimmedId}`);
                    } else {
                        KernelLogger.warn("ThemeManager", `保存的桌面背景 ${trimmedId} 不存在，使用默认背景`);
                        ThemeManager._currentDesktopBackgroundId = 'default';
                    }
                } else {
                    if (savedBackgroundId !== null && savedBackgroundId !== undefined) {
                        KernelLogger.warn("ThemeManager", `保存的桌面背景ID无效: ${savedBackgroundId} (类型: ${typeof savedBackgroundId})，使用默认背景`);
                    }
                    ThemeManager._currentDesktopBackgroundId = 'default';
                    KernelLogger.info("ThemeManager", "使用默认桌面背景");
                }
            } catch (e) {
                KernelLogger.warn("ThemeManager", `加载主题/风格/背景失败: ${e.message}，使用默认值`);
                ThemeManager._currentThemeId = 'default';
                ThemeManager._currentStyleId = 'ubuntu';
                ThemeManager._currentDesktopBackgroundId = 'default';
            }
        } else {
            ThemeManager._currentThemeId = 'default';
            ThemeManager._currentStyleId = 'ubuntu';
            ThemeManager._currentDesktopBackgroundId = 'default';
            KernelLogger.warn("ThemeManager", "LStorage 不可用，使用默认主题和风格");
        }
        
        // 应用当前主题和风格
        ThemeManager._applyTheme(ThemeManager._currentThemeId);
        ThemeManager._applyStyle(ThemeManager._currentStyleId);
        ThemeManager._applyDesktopBackground(ThemeManager._currentDesktopBackgroundId);
        
        ThemeManager._initialized = true;
        KernelLogger.info("ThemeManager", "主题管理器初始化完成");
    }
    
    /**
     * 注册内置主题（高级主题）
     */
    static _registerBuiltinThemes() {
        // 主题1：默认主题 - 深色科技风格（高级版）
        ThemeManager.registerTheme('default', {
            id: 'default',
            name: '默认主题',
            description: '深色科技风格，紫色和蓝色渐变，现代感十足',
            colors: {
                // 背景色（多层次渐变，更深）
                background: '#050810',
                backgroundSecondary: '#0f1419',
                backgroundTertiary: '#1a1f28',
                backgroundElevated: '#252b35',
                
                // 文字色（高对比度）
                text: '#d7e0dd',
                textSecondary: '#b8c5c0',
                textMuted: '#8a9a94',
                textDisabled: '#5a6a64',
                
                // 强调色（渐变系统）- 调整为更柔和的紫色蓝色调
                primary: '#8b5cf6',
                primaryLight: 'rgba(139, 92, 246, 0.15)',
                primaryDark: '#7c3aed',
                primaryGradient: 'linear-gradient(135deg, #8b5cf6, #6c8eff)',
                secondary: '#6c8eff',
                secondaryLight: '#8da6ff',
                secondaryDark: '#5a7aff',
                secondaryGradient: 'linear-gradient(135deg, #6c8eff, #8b5cf6)',
                
                // 状态色（完整系统）- 调整为更柔和的色调
                success: '#4ade80',
                successLight: '#6ee7b7',
                successDark: '#22c55e',
                successGradient: 'linear-gradient(135deg, #4ade80, #22c55e)',
                warning: '#fbbf24',
                warningLight: '#fcd34d',
                warningDark: '#f59e0b',
                warningGradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                error: '#ef4444',
                errorLight: '#f87171',
                errorDark: '#dc2626',
                errorGradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
                info: '#6366f1',
                infoLight: '#818cf8',
                infoDark: '#4f46e5',
                infoGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                
                // 边框色（多层次）
                border: 'rgba(139, 92, 246, 0.25)',
                borderLight: 'rgba(139, 92, 246, 0.15)',
                borderDark: 'rgba(139, 92, 246, 0.35)',
                borderFocus: 'rgba(139, 92, 246, 0.5)',
                
                // 阴影色（多层次）
                shadow: 'rgba(0, 0, 0, 0.5)',
                shadowLight: 'rgba(0, 0, 0, 0.3)',
                shadowDark: 'rgba(0, 0, 0, 0.7)',
                shadowColored: 'rgba(139, 92, 246, 0.3)',
                
                // 特殊色
                accent: '#8b5cf6',
                accentGradient: 'linear-gradient(135deg, #8b5cf6, #6c8eff)',
                glow: 'rgba(139, 92, 246, 0.6)',
                
                // Glow 效果（用于发光效果）
                primaryGlow: 'rgba(139, 92, 246, 0.7)',
                secondaryGlow: 'rgba(108, 142, 255, 0.5)',
                successGlow: 'rgba(74, 222, 128, 0.5)',
                warningGlow: 'rgba(251, 191, 36, 0.5)',
                errorGlow: 'rgba(239, 68, 68, 0.5)',
            }
        });
        
        // 主题2：深蓝主题 - 专业商务风格（高级版）
        ThemeManager.registerTheme('deep-blue', {
            id: 'deep-blue',
            name: '深蓝主题',
            description: '深蓝色调，专业商务风格，沉稳大气',
            colors: {
                background: '#0f172a',
                backgroundSecondary: '#1e293b',
                backgroundTertiary: '#334155',
                backgroundElevated: '#475569',
                
                text: '#f1f5f9',
                textSecondary: '#e2e8f0',
                textMuted: '#cbd5e1',
                textDisabled: '#94a3b8',
                
                primary: '#3b82f6',
                primaryLight: 'rgba(59, 130, 246, 0.15)',
                primaryDark: '#2563eb',
                primaryGradient: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                secondary: '#1e40af',
                secondaryLight: '#4a6cf7',
                secondaryDark: '#1e3a8a',
                secondaryGradient: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                
                success: '#10b981',
                successLight: '#34d399',
                successDark: '#059669',
                successGradient: 'linear-gradient(135deg, #10b981, #059669)',
                warning: '#f59e0b',
                warningLight: '#fbbf24',
                warningDark: '#d97706',
                warningGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
                error: '#ef4444',
                errorLight: '#f87171',
                errorDark: '#dc2626',
                errorGradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
                info: '#0ea5e9',
                infoLight: '#38bdf8',
                infoDark: '#0284c7',
                infoGradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                
                border: 'rgba(59, 130, 246, 0.25)',
                borderLight: 'rgba(59, 130, 246, 0.15)',
                borderDark: 'rgba(59, 130, 246, 0.35)',
                borderFocus: 'rgba(59, 130, 246, 0.5)',
                
                shadow: 'rgba(0, 0, 0, 0.5)',
                shadowLight: 'rgba(0, 0, 0, 0.3)',
                shadowDark: 'rgba(0, 0, 0, 0.7)',
                shadowColored: 'rgba(59, 130, 246, 0.3)',
                
                accent: '#3b82f6',
                accentGradient: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                glow: 'rgba(59, 130, 246, 0.6)',
                
                // Glow 效果（用于发光效果）
                primaryGlow: 'rgba(59, 130, 246, 0.7)',
                secondaryGlow: 'rgba(30, 64, 175, 0.5)',
                successGlow: 'rgba(16, 185, 129, 0.5)',
                warningGlow: 'rgba(245, 158, 11, 0.5)',
                errorGlow: 'rgba(239, 68, 68, 0.5)',
            }
        });
        
        // 主题3：绿色主题 - 护眼绿色调（高级版）
        ThemeManager.registerTheme('green', {
            id: 'green',
            name: '绿色主题',
            description: '护眼绿色调，舒适阅读体验，自然清新',
            colors: {
                background: '#0d1b0f',
                backgroundSecondary: '#1a2e1f',
                backgroundTertiary: '#27402f',
                backgroundElevated: '#32523f',
                
                text: '#d4e8d9',
                textSecondary: '#b8d4c0',
                textMuted: '#9ab8a7',
                textDisabled: '#7a9a87',
                
                primary: '#22c55e',
                primaryLight: 'rgba(34, 197, 94, 0.15)',
                primaryDark: '#16a34a',
                primaryGradient: 'linear-gradient(135deg, #22c55e, #10b981)',
                secondary: '#10b981',
                secondaryLight: '#34d399',
                secondaryDark: '#059669',
                secondaryGradient: 'linear-gradient(135deg, #10b981, #22c55e)',
                
                success: '#22c55e',
                successLight: '#4ade80',
                successDark: '#16a34a',
                successGradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
                warning: '#eab308',
                warningLight: '#facc15',
                warningDark: '#ca8a04',
                warningGradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
                error: '#f87171',
                errorLight: '#fca5a5',
                errorDark: '#ef4444',
                errorGradient: 'linear-gradient(135deg, #f87171, #ef4444)',
                info: '#14b8a6',
                infoLight: '#5eead4',
                infoDark: '#0d9488',
                infoGradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                
                border: 'rgba(34, 197, 94, 0.25)',
                borderLight: 'rgba(34, 197, 94, 0.15)',
                borderDark: 'rgba(34, 197, 94, 0.35)',
                borderFocus: 'rgba(34, 197, 94, 0.5)',
                
                shadow: 'rgba(0, 0, 0, 0.5)',
                shadowLight: 'rgba(0, 0, 0, 0.3)',
                shadowDark: 'rgba(0, 0, 0, 0.7)',
                shadowColored: 'rgba(34, 197, 94, 0.3)',
                
                accent: '#22c55e',
                accentGradient: 'linear-gradient(135deg, #22c55e, #10b981)',
                glow: 'rgba(34, 197, 94, 0.6)',
                
                // Glow 效果（用于发光效果）
                primaryGlow: 'rgba(34, 197, 94, 0.7)',
                secondaryGlow: 'rgba(16, 185, 129, 0.5)',
                successGlow: 'rgba(34, 197, 94, 0.5)',
                warningGlow: 'rgba(234, 179, 8, 0.5)',
                errorGlow: 'rgba(248, 113, 113, 0.5)',
            }
        });
        
        // 主题4：橙色主题 - 温暖橙色调（高级版）
        ThemeManager.registerTheme('orange', {
            id: 'orange',
            name: '橙色主题',
            description: '温暖橙色调，活力四射，充满能量',
            colors: {
                background: '#1a0f0a',
                backgroundSecondary: '#2e1f1a',
                backgroundTertiary: '#402f27',
                backgroundElevated: '#523f35',
                
                text: '#e8ddd4',
                textSecondary: '#d4c5b8',
                textMuted: '#b8a89a',
                textDisabled: '#9a877a',
                
                primary: '#f97316',
                primaryLight: 'rgba(249, 115, 22, 0.15)',
                primaryDark: '#ea580c',
                primaryGradient: 'linear-gradient(135deg, #f97316, #ff8c42)',
                secondary: '#ff8c42',
                secondaryLight: '#ffa366',
                secondaryDark: '#ff6b1a',
                secondaryGradient: 'linear-gradient(135deg, #ff8c42, #f97316)',
                
                success: '#22c55e',
                successLight: '#4ade80',
                successDark: '#16a34a',
                successGradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
                warning: '#f59e0b',
                warningLight: '#fbbf24',
                warningDark: '#d97706',
                warningGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
                error: '#ef4444',
                errorLight: '#f87171',
                errorDark: '#dc2626',
                errorGradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
                info: '#f59e0b',
                infoLight: '#fbbf24',
                infoDark: '#d97706',
                infoGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
                
                border: 'rgba(249, 115, 22, 0.25)',
                borderLight: 'rgba(249, 115, 22, 0.15)',
                borderDark: 'rgba(249, 115, 22, 0.35)',
                borderFocus: 'rgba(249, 115, 22, 0.5)',
                
                shadow: 'rgba(0, 0, 0, 0.5)',
                shadowLight: 'rgba(0, 0, 0, 0.3)',
                shadowDark: 'rgba(0, 0, 0, 0.7)',
                shadowColored: 'rgba(249, 115, 22, 0.3)',
                
                accent: '#f97316',
                accentGradient: 'linear-gradient(135deg, #f97316, #ff8c42)',
                glow: 'rgba(249, 115, 22, 0.6)',
                
                // Glow 效果（用于发光效果）
                primaryGlow: 'rgba(249, 115, 22, 0.7)',
                secondaryGlow: 'rgba(255, 140, 66, 0.5)',
                successGlow: 'rgba(34, 197, 94, 0.5)',
                warningGlow: 'rgba(245, 158, 11, 0.5)',
                errorGlow: 'rgba(239, 68, 68, 0.5)',
            }
        });
        
        // 主题5：红色主题 - 热情红色调（高级版）
        ThemeManager.registerTheme('red', {
            id: 'red',
            name: '红色主题',
            description: '热情红色调，充满活力，激情澎湃',
            colors: {
                background: '#1a0a0a',
                backgroundSecondary: '#2e1a1a',
                backgroundTertiary: '#402727',
                backgroundElevated: '#523535',
                
                text: '#e8d4d4',
                textSecondary: '#d4b8b8',
                textMuted: '#b89a9a',
                textDisabled: '#9a7a7a',
                
                primary: '#ef4444',
                primaryLight: 'rgba(239, 68, 68, 0.15)',
                primaryDark: '#dc2626',
                primaryGradient: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                secondary: '#f43f5e',
                secondaryLight: '#fb7185',
                secondaryDark: '#e11d48',
                secondaryGradient: 'linear-gradient(135deg, #f43f5e, #ef4444)',
                
                success: '#22c55e',
                successLight: '#4ade80',
                successDark: '#16a34a',
                successGradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
                warning: '#f59e0b',
                warningLight: '#fbbf24',
                warningDark: '#d97706',
                warningGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
                error: '#ef4444',
                errorLight: '#f87171',
                errorDark: '#dc2626',
                errorGradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
                info: '#ec4899',
                infoLight: '#f472b6',
                infoDark: '#db2777',
                infoGradient: 'linear-gradient(135deg, #ec4899, #db2777)',
                
                border: 'rgba(239, 68, 68, 0.25)',
                borderLight: 'rgba(239, 68, 68, 0.15)',
                borderDark: 'rgba(239, 68, 68, 0.35)',
                borderFocus: 'rgba(239, 68, 68, 0.5)',
                
                shadow: 'rgba(0, 0, 0, 0.5)',
                shadowLight: 'rgba(0, 0, 0, 0.3)',
                shadowDark: 'rgba(0, 0, 0, 0.7)',
                shadowColored: 'rgba(239, 68, 68, 0.3)',
                
                accent: '#ef4444',
                accentGradient: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                glow: 'rgba(239, 68, 68, 0.6)',
                
                // Glow 效果（用于发光效果）
                primaryGlow: 'rgba(239, 68, 68, 0.7)',
                secondaryGlow: 'rgba(244, 63, 94, 0.5)',
                successGlow: 'rgba(34, 197, 94, 0.5)',
                warningGlow: 'rgba(245, 158, 11, 0.5)',
                errorGlow: 'rgba(239, 68, 68, 0.5)',
            }
        });
        
        KernelLogger.info("ThemeManager", `已注册 ${ThemeManager._themes.size} 个内置主题`);
    }
    
    /**
     * 注册内置GUI风格
     */
    static _registerBuiltinStyles() {
        // 风格1：Ubuntu风格 - 高仿Ubuntu GNOME风格
        ThemeManager.registerStyle('ubuntu', {
            id: 'ubuntu',
            name: 'Ubuntu风格',
            description: '高仿Ubuntu GNOME桌面，圆角窗口，Adwaita风格，毛玻璃效果',
            styles: {
                // 窗口样式
                window: {
                    borderRadius: '12px', // Ubuntu GNOME的圆角
                    borderWidth: '1px', // Ubuntu GNOME有细边框
                    backdropFilter: 'blur(20px) saturate(180%)', // Ubuntu GNOME的毛玻璃效果
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1) inset', // Ubuntu风格的阴影
                    boxShadowFocused: '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.3) inset, 0 0 24px rgba(139, 92, 246, 0.2)',
                    boxShadowUnfocused: '0 4px 16px rgba(0, 0, 0, 0.3)',
                    opacityUnfocused: 0.85,
                },
                // 任务栏样式
                taskbar: {
                    borderRadius: '0', // Ubuntu Dock无圆角
                    backdropFilter: 'blur(30px) saturate(200%)', // Ubuntu Dock的毛玻璃效果
                    boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.1) inset', // Ubuntu Dock的阴影
                },
                // 按钮样式
                button: {
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    boxShadowHover: '0 4px 12px rgba(0, 0, 0, 0.3)',
                },
                // 输入框样式
                input: {
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderWidth: '1px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                // 菜单样式
                menu: {
                    borderRadius: '12px',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 6px 20px rgba(0, 0, 0, 0.3)',
                    padding: '8px',
                },
                // 动画风格
                animation: {
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    durationFast: '150ms',
                    durationNormal: '300ms',
                    durationSlow: '500ms',
                },
                // 字体
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                    sizeBase: '14px',
                    sizeSmall: '12px',
                    sizeLarge: '16px',
                    weightNormal: '400',
                    weightMedium: '500',
                    weightBold: '600',
                },
                // 间距
                spacing: {
                    xs: '4px',
                    sm: '8px',
                    md: '12px',
                    lg: '16px',
                    xl: '24px',
                },
                // 图标风格
                icon: {
                    sizeSmall: '16px',
                    sizeMedium: '24px',
                    sizeLarge: '32px',
                    borderRadius: '4px',
                    padding: '4px',
                    fillColor: 'currentColor',
                    strokeColor: 'currentColor',
                    strokeWidth: '1.5',
                    opacity: '1',
                    opacityHover: '0.8',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: 'none',
                    filterHover: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                    style: 'filled', // 'filled', 'outlined', 'rounded', 'sharp'
                },
            }
        });
        
        // 风格2：Windows风格 - 高仿Windows 11风格
        ThemeManager.registerStyle('windows', {
            id: 'windows',
            name: 'Windows风格',
            description: '高仿Windows 11，Fluent Design，Acrylic材质，圆角适中',
            styles: {
                window: {
                    borderRadius: '8px', // Windows 11的适中圆角
                    borderWidth: '0', // Windows 11窗口无边框
                    backdropFilter: 'blur(40px) saturate(180%)', // Windows 11的Acrylic材质效果
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28), 0 0 1px rgba(255, 255, 255, 0.08) inset', // Windows 11风格的阴影
                    boxShadowFocused: '0 12px 48px rgba(0, 0, 0, 0.35), 0 0 1px rgba(255, 255, 255, 0.12) inset',
                    boxShadowUnfocused: '0 4px 20px rgba(0, 0, 0, 0.22)',
                    opacityUnfocused: 0.88, // Windows 11未激活窗口稍微透明
                },
                taskbar: {
                    borderRadius: '0', // Windows 11任务栏无圆角
                    backdropFilter: 'blur(40px) saturate(180%)', // Windows 11任务栏的Acrylic效果
                    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2), inset 0 0.5px 0 rgba(255, 255, 255, 0.08)', // Windows 11任务栏的微妙阴影
                },
                button: {
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '400',
                    transition: 'all 0.15s ease',
                    boxShadow: 'none',
                    boxShadowHover: '0 2px 8px rgba(0, 0, 0, 0.15)',
                },
                input: {
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '13px',
                    borderWidth: '1px',
                    transition: 'all 0.15s ease',
                },
                menu: {
                    borderRadius: '8px',
                    backdropFilter: 'blur(40px) saturate(150%)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    padding: '4px',
                },
                animation: {
                    easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
                    durationFast: '120ms',
                    durationNormal: '250ms',
                    durationSlow: '400ms',
                },
                font: {
                    family: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
                    sizeBase: '13px',
                    sizeSmall: '11px',
                    sizeLarge: '15px',
                    weightNormal: '400',
                    weightMedium: '500',
                    weightBold: '600',
                },
                spacing: {
                    xs: '4px',
                    sm: '6px',
                    md: '10px',
                    lg: '16px',
                    xl: '20px',
                },
                icon: {
                    sizeSmall: '16px',
                    sizeMedium: '20px',
                    sizeLarge: '28px',
                    borderRadius: '2px',
                    padding: '2px',
                    fillColor: 'currentColor',
                    strokeColor: 'currentColor',
                    strokeWidth: '1',
                    opacity: '1',
                    opacityHover: '0.9',
                    transition: 'all 0.15s ease',
                    filter: 'none',
                    filterHover: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))',
                    style: 'outlined',
                },
            }
        });
        
        // 风格3：macOS风格 - 高仿macOS Big Sur/Sonoma风格
        ThemeManager.registerStyle('macos', {
            id: 'macos',
            name: 'macOS风格',
            description: '高仿macOS Big Sur/Sonoma，大圆角窗口，精致毛玻璃效果，优雅简洁',
            styles: {
                window: {
                    borderRadius: '20px', // macOS风格：更大的圆角
                    borderWidth: '0', // macOS窗口无边框
                    backdropFilter: 'blur(40px) saturate(180%)', // macOS风格的强毛玻璃效果
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset', // macOS风格的柔和阴影
                    boxShadowFocused: '0 30px 90px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(255, 255, 255, 0.12) inset, 0 0 40px rgba(0, 0, 0, 0.1)',
                    boxShadowUnfocused: '0 15px 50px rgba(0, 0, 0, 0.2)',
                    opacityUnfocused: 0.75, // macOS未激活窗口更透明
                },
                taskbar: {
                    borderRadius: '0', // macOS Dock无圆角（但图标有圆角）
                    backdropFilter: 'blur(60px) saturate(200%)', // macOS Dock的超强毛玻璃效果
                    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)', // macOS Dock的微妙阴影
                },
                button: {
                    borderRadius: '10px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
                    boxShadowHover: '0 4px 12px rgba(0, 0, 0, 0.15)',
                },
                input: {
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    borderWidth: '1px',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                },
                menu: {
                    borderRadius: '12px',
                    backdropFilter: 'blur(40px) saturate(200%)',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
                    padding: '6px',
                },
                animation: {
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    durationFast: '150ms',
                    durationNormal: '250ms',
                    durationSlow: '350ms',
                },
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
                    sizeBase: '13px',
                    sizeSmall: '11px',
                    sizeLarge: '15px',
                    weightNormal: '400',
                    weightMedium: '500',
                    weightBold: '600',
                },
                spacing: {
                    xs: '4px',
                    sm: '8px',
                    md: '12px',
                    lg: '16px',
                    xl: '24px',
                },
                icon: {
                    sizeSmall: '18px',
                    sizeMedium: '24px',
                    sizeLarge: '32px',
                    borderRadius: '6px',
                    padding: '6px',
                    fillColor: 'currentColor',
                    strokeColor: 'currentColor',
                    strokeWidth: '1.5',
                    opacity: '1',
                    opacityHover: '0.85',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    filter: 'none',
                    filterHover: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15))',
                    style: 'rounded',
                },
            }
        });
        
        // 风格4：GNOME风格 - 高仿GNOME 40+ Adwaita风格
        ThemeManager.registerStyle('gnome', {
            id: 'gnome',
            name: 'GNOME风格',
            description: '高仿GNOME 40+ Adwaita，扁平化设计，大间距，现代感',
            styles: {
                window: {
                    borderRadius: '10px', // GNOME Adwaita的圆角
                    borderWidth: '1px', // GNOME有细边框
                    backdropFilter: 'blur(25px) saturate(170%)', // GNOME的毛玻璃效果
                    boxShadow: '0 6px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05) inset', // GNOME风格的阴影
                    boxShadowFocused: '0 10px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                    boxShadowUnfocused: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    opacityUnfocused: 0.88,
                },
                taskbar: {
                    borderRadius: '0', // GNOME顶部栏无圆角
                    backdropFilter: 'blur(35px) saturate(180%)', // GNOME顶部栏的毛玻璃效果
                    boxShadow: '0 -6px 28px rgba(0, 0, 0, 0.35)', // GNOME顶部栏的阴影
                },
                button: {
                    borderRadius: '9px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                    boxShadowHover: '0 4px 12px rgba(0, 0, 0, 0.2)',
                },
                input: {
                    borderRadius: '9px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    borderWidth: '1px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                menu: {
                    borderRadius: '12px',
                    backdropFilter: 'blur(35px) saturate(180%)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                    padding: '8px',
                },
                animation: {
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    durationFast: '150ms',
                    durationNormal: '300ms',
                    durationSlow: '450ms',
                },
                font: {
                    family: '"Cantarell", "Ubuntu", "Roboto", sans-serif',
                    sizeBase: '14px',
                    sizeSmall: '12px',
                    sizeLarge: '16px',
                    weightNormal: '400',
                    weightMedium: '500',
                    weightBold: '700',
                },
                spacing: {
                    xs: '6px',
                    sm: '10px',
                    md: '14px',
                    lg: '20px',
                    xl: '28px',
                },
                icon: {
                    sizeSmall: '20px',
                    sizeMedium: '24px',
                    sizeLarge: '36px',
                    borderRadius: '4px',
                    padding: '8px',
                    fillColor: 'currentColor',
                    strokeColor: 'currentColor',
                    strokeWidth: '1.5',
                    opacity: '1',
                    opacityHover: '0.88',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: 'none',
                    filterHover: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15))',
                    style: 'filled',
                },
            }
        });
        
        // 风格5：Material Design风格 - 高仿Material Design 3风格
        ThemeManager.registerStyle('material', {
            id: 'material',
            name: 'Material Design风格',
            description: '高仿Material Design 3，卡片式设计，层次分明，Elevation阴影',
            styles: {
                window: {
                    borderRadius: '4px', // Material Design的小圆角
                    borderWidth: '0', // Material Design无边框
                    backdropFilter: 'blur(20px) saturate(160%)', // Material Design的轻微毛玻璃
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)', // Material Design的Elevation阴影
                    boxShadowFocused: '0 4px 16px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15)', // 更高的Elevation
                    boxShadowUnfocused: '0 1px 4px rgba(0, 0, 0, 0.1)', // 较低的Elevation
                    opacityUnfocused: 0.92,
                },
                taskbar: {
                    borderRadius: '0', // Material Design底部栏无圆角
                    backdropFilter: 'blur(25px) saturate(160%)', // Material Design底部栏的毛玻璃
                    boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)', // Material Design底部栏的Elevation
                },
                button: {
                    borderRadius: '4px',
                    padding: '10px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    boxShadowHover: '0 4px 8px rgba(0, 0, 0, 0.15)',
                },
                input: {
                    borderRadius: '4px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    borderWidth: '0',
                    borderBottomWidth: '2px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                menu: {
                    borderRadius: '4px',
                    backdropFilter: 'blur(25px) saturate(160%)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                    padding: '8px',
                },
                animation: {
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    durationFast: '150ms',
                    durationNormal: '300ms',
                    durationSlow: '400ms',
                },
                font: {
                    family: '"Roboto", "Noto Sans", sans-serif',
                    sizeBase: '14px',
                    sizeSmall: '12px',
                    sizeLarge: '16px',
                    weightNormal: '400',
                    weightMedium: '500',
                    weightBold: '700',
                },
                spacing: {
                    xs: '4px',
                    sm: '8px',
                    md: '16px',
                    lg: '24px',
                    xl: '32px',
                },
                icon: {
                    sizeSmall: '20px',
                    sizeMedium: '24px',
                    sizeLarge: '40px',
                    borderRadius: '0',
                    padding: '8px',
                    fillColor: 'currentColor',
                    strokeColor: 'currentColor',
                    strokeWidth: '2',
                    opacity: '0.87',
                    opacityHover: '1',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: 'none',
                    filterHover: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                    style: 'sharp',
                },
            }
        });
        
        KernelLogger.info("ThemeManager", `已注册 ${ThemeManager._styles.size} 个内置风格`);
    }
    
    /**
     * 注册主题
     * @param {string} themeId 主题ID
     * @param {Object} theme 主题配置
     */
    static registerTheme(themeId, theme) {
        if (!themeId || !theme) {
            KernelLogger.warn("ThemeManager", "注册主题失败：themeId 或 theme 为空");
            return false;
        }
        
        if (!theme.colors || typeof theme.colors !== 'object') {
            KernelLogger.warn("ThemeManager", `注册主题失败：主题 ${themeId} 缺少 colors 配置`);
            return false;
        }
        
        ThemeManager._themes.set(themeId, {
            id: themeId,
            name: theme.name || themeId,
            description: theme.description || '',
            colors: theme.colors
        });
        
        KernelLogger.debug("ThemeManager", `注册主题: ${themeId} - ${theme.name || themeId}`);
        return true;
    }
    
    /**
     * 注册风格
     * @param {string} styleId 风格ID
     * @param {Object} style 风格配置
     */
    static registerStyle(styleId, style) {
        if (!styleId || !style) {
            KernelLogger.warn("ThemeManager", "注册风格失败：styleId 或 style 为空");
            return false;
        }
        
        if (!style.styles || typeof style.styles !== 'object') {
            KernelLogger.warn("ThemeManager", `注册风格失败：风格 ${styleId} 缺少 styles 配置`);
            return false;
        }
        
        ThemeManager._styles.set(styleId, {
            id: styleId,
            name: style.name || styleId,
            description: style.description || '',
            styles: style.styles
        });
        
        KernelLogger.debug("ThemeManager", `注册风格: ${styleId} - ${style.name || styleId}`);
        return true;
    }
    
    /**
     * 设置主题
     * @param {string} themeId 主题ID
     * @param {boolean} save 是否保存到 LStorage（默认 true）
     */
    static async setTheme(themeId, save = true) {
        if (!ThemeManager._initialized) {
            await ThemeManager.init();
        }
        
        if (!ThemeManager._themes.has(themeId)) {
            KernelLogger.warn("ThemeManager", `主题不存在: ${themeId}`);
            return false;
        }
        
        // 应用主题
        ThemeManager._applyTheme(themeId);
        
        // 保存到 LStorage
        if (save && typeof LStorage !== 'undefined') {
            try {
                await LStorage.setSystemStorage(ThemeManager.STORAGE_KEY_THEME, themeId);
                KernelLogger.debug("ThemeManager", `主题已保存: ${themeId}`);
            } catch (e) {
                KernelLogger.warn("ThemeManager", `保存主题失败: ${e.message}`);
            }
        }
        
        // 通知监听器
        ThemeManager._notifyThemeChange(themeId);
        
        KernelLogger.info("ThemeManager", `主题已切换: ${themeId}`);
        return true;
    }
    
    /**
     * 设置风格
     * @param {string} styleId 风格ID
     * @param {boolean} save 是否保存到 LStorage（默认 true）
     */
    static async setStyle(styleId, save = true) {
        if (!ThemeManager._initialized) {
            await ThemeManager.init();
        }
        
        if (!ThemeManager._styles.has(styleId)) {
            KernelLogger.warn("ThemeManager", `风格不存在: ${styleId}`);
            return false;
        }
        
        // 应用风格
        ThemeManager._applyStyle(styleId);
        
        // 保存到 LStorage
        if (save && typeof LStorage !== 'undefined') {
            try {
                await LStorage.setSystemStorage(ThemeManager.STORAGE_KEY_STYLE, styleId);
                KernelLogger.debug("ThemeManager", `风格已保存: ${styleId}`);
            } catch (e) {
                KernelLogger.warn("ThemeManager", `保存风格失败: ${e.message}`);
            }
        }
        
        // 通知监听器
        ThemeManager._notifyStyleChange(styleId);
        
        KernelLogger.info("ThemeManager", `风格已切换: ${styleId}`);
        return true;
    }
    
    /**
     * 应用主题到 DOM
     * @param {string} themeId 主题ID
     */
    static _applyTheme(themeId) {
        const theme = ThemeManager._themes.get(themeId);
        if (!theme) {
            KernelLogger.warn("ThemeManager", `应用主题失败：主题 ${themeId} 不存在`);
            return;
        }
        
        ThemeManager._currentThemeId = themeId;
        
        // 获取根元素
        const root = document.documentElement;
        if (!root) {
            KernelLogger.warn("ThemeManager", "无法获取根元素，跳过主题应用");
            return;
        }
        
        // 应用CSS变量
        const colors = theme.colors;
        for (const [key, value] of Object.entries(colors)) {
            const cssVarName = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVarName, value);
        }
        
        // 应用基础样式
        if (document.body) {
            document.body.style.backgroundColor = colors.background;
            document.body.style.color = colors.text;
        }
        
        // 应用沙盒容器样式
        const sandboxContainer = document.getElementById('sandbox-container');
        if (sandboxContainer) {
            sandboxContainer.style.backgroundColor = colors.background;
        }
        
        // 应用窗口背景色到所有窗口
        const allWindows = document.querySelectorAll('.zos-gui-window');
        allWindows.forEach(window => {
            // 窗口背景使用主题的 backgroundElevated 或 backgroundSecondary
            const windowBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            window.style.backgroundColor = windowBg;
            window.style.borderColor = colors.border || colors.primary + '40';
        });
        
        // 应用窗口标题栏背景色
        const allTitleBars = document.querySelectorAll('.zos-window-titlebar');
        allTitleBars.forEach(titleBar => {
            const titleBarBg = colors.backgroundSecondary || colors.background;
            titleBar.style.backgroundColor = titleBarBg;
            titleBar.style.borderBottomColor = colors.border || colors.primary + '33';
        });
        
        // 应用任务栏背景色
        const taskbar = document.getElementById('taskbar') || document.querySelector('.taskbar');
        if (taskbar) {
            const taskbarBg = colors.backgroundSecondary || colors.background;
            taskbar.style.backgroundColor = taskbarBg;
            taskbar.style.borderColor = colors.border || colors.primary + '33';
        }
        
        // 应用任务栏弹出面板的背景色
        const appMenu = document.getElementById('taskbar-app-menu');
        if (appMenu) {
            const panelBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            appMenu.style.backgroundColor = panelBg;
            appMenu.style.borderColor = colors.border || colors.primary + '33';
        }
        
        const timeWheel = document.getElementById('taskbar-time-wheel');
        if (timeWheel) {
            const panelBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            timeWheel.style.backgroundColor = panelBg;
            timeWheel.style.borderColor = colors.border || colors.primary + '33';
        }
        
        const networkPanel = document.getElementById('taskbar-network-panel');
        if (networkPanel) {
            const panelBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            networkPanel.style.backgroundColor = panelBg;
            networkPanel.style.borderColor = colors.border || colors.primary + '33';
        }
        
        const batteryPanel = document.getElementById('taskbar-battery-panel');
        if (batteryPanel) {
            const panelBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            batteryPanel.style.backgroundColor = panelBg;
            batteryPanel.style.borderColor = colors.border || colors.primary + '33';
        }
        
        const powerMenu = document.getElementById('taskbar-power-menu');
        if (powerMenu) {
            const panelBg = colors.backgroundElevated || colors.backgroundSecondary || colors.background;
            powerMenu.style.backgroundColor = panelBg;
            powerMenu.style.borderColor = colors.border || colors.primary + '33';
        }
        
        KernelLogger.debug("ThemeManager", `主题已应用到DOM: ${themeId}`);
    }
    
    /**
     * 应用风格到 DOM
     * @param {string} styleId 风格ID
     */
    static _applyStyle(styleId) {
        const style = ThemeManager._styles.get(styleId);
        if (!style) {
            KernelLogger.warn("ThemeManager", `应用风格失败：风格 ${styleId} 不存在`);
            return;
        }
        
        ThemeManager._currentStyleId = styleId;
        
        // 获取根元素
        const root = document.documentElement;
        if (!root) {
            KernelLogger.warn("ThemeManager", "无法获取根元素，跳过风格应用");
            return;
        }
        
        // 应用CSS变量
        const styles = style.styles;
        
        // 窗口样式
        if (styles.window) {
            root.style.setProperty('--style-window-border-radius', styles.window.borderRadius);
            root.style.setProperty('--style-window-border-width', styles.window.borderWidth);
            root.style.setProperty('--style-window-backdrop-filter', styles.window.backdropFilter);
            root.style.setProperty('--style-window-box-shadow', styles.window.boxShadow);
            root.style.setProperty('--style-window-box-shadow-focused', styles.window.boxShadowFocused);
            root.style.setProperty('--style-window-box-shadow-unfocused', styles.window.boxShadowUnfocused);
            root.style.setProperty('--style-window-opacity-unfocused', styles.window.opacityUnfocused);
        }
        
        // 任务栏样式
        if (styles.taskbar) {
            root.style.setProperty('--style-taskbar-border-radius', styles.taskbar.borderRadius);
            root.style.setProperty('--style-taskbar-backdrop-filter', styles.taskbar.backdropFilter);
            root.style.setProperty('--style-taskbar-box-shadow', styles.taskbar.boxShadow);
        }
        
        // 按钮样式
        if (styles.button) {
            root.style.setProperty('--style-button-border-radius', styles.button.borderRadius);
            root.style.setProperty('--style-button-padding', styles.button.padding);
            root.style.setProperty('--style-button-font-size', styles.button.fontSize);
            root.style.setProperty('--style-button-font-weight', styles.button.fontWeight);
            root.style.setProperty('--style-button-transition', styles.button.transition);
            root.style.setProperty('--style-button-box-shadow', styles.button.boxShadow);
            root.style.setProperty('--style-button-box-shadow-hover', styles.button.boxShadowHover);
        }
        
        // 输入框样式
        if (styles.input) {
            root.style.setProperty('--style-input-border-radius', styles.input.borderRadius);
            root.style.setProperty('--style-input-padding', styles.input.padding);
            root.style.setProperty('--style-input-font-size', styles.input.fontSize);
            root.style.setProperty('--style-input-border-width', styles.input.borderWidth);
            root.style.setProperty('--style-input-transition', styles.input.transition);
        }
        
        // 菜单样式
        if (styles.menu) {
            root.style.setProperty('--style-menu-border-radius', styles.menu.borderRadius);
            root.style.setProperty('--style-menu-backdrop-filter', styles.menu.backdropFilter);
            root.style.setProperty('--style-menu-box-shadow', styles.menu.boxShadow);
            root.style.setProperty('--style-menu-padding', styles.menu.padding);
        }
        
        // 动画风格
        if (styles.animation) {
            root.style.setProperty('--style-animation-easing', styles.animation.easing);
            root.style.setProperty('--style-animation-duration-fast', styles.animation.durationFast);
            root.style.setProperty('--style-animation-duration-normal', styles.animation.durationNormal);
            root.style.setProperty('--style-animation-duration-slow', styles.animation.durationSlow);
        }
        
        // 字体
        if (styles.font) {
            root.style.setProperty('--style-font-family', styles.font.family);
            root.style.setProperty('--style-font-size-base', styles.font.sizeBase);
            root.style.setProperty('--style-font-size-small', styles.font.sizeSmall);
            root.style.setProperty('--style-font-size-large', styles.font.sizeLarge);
            root.style.setProperty('--style-font-weight-normal', styles.font.weightNormal);
            root.style.setProperty('--style-font-weight-medium', styles.font.weightMedium);
            root.style.setProperty('--style-font-weight-bold', styles.font.weightBold);
            
            // 应用到 body
            if (document.body) {
                document.body.style.fontFamily = styles.font.family;
            }
        }
        
        // 间距
        if (styles.spacing) {
            root.style.setProperty('--style-spacing-xs', styles.spacing.xs);
            root.style.setProperty('--style-spacing-sm', styles.spacing.sm);
            root.style.setProperty('--style-spacing-md', styles.spacing.md);
            root.style.setProperty('--style-spacing-lg', styles.spacing.lg);
            root.style.setProperty('--style-spacing-xl', styles.spacing.xl);
        }
        
        // 图标风格
        if (styles.icon) {
            root.style.setProperty('--style-icon-size-small', styles.icon.sizeSmall);
            root.style.setProperty('--style-icon-size-medium', styles.icon.sizeMedium);
            root.style.setProperty('--style-icon-size-large', styles.icon.sizeLarge);
            root.style.setProperty('--style-icon-border-radius', styles.icon.borderRadius);
            root.style.setProperty('--style-icon-padding', styles.icon.padding);
            root.style.setProperty('--style-icon-fill-color', styles.icon.fillColor);
            root.style.setProperty('--style-icon-stroke-color', styles.icon.strokeColor);
            root.style.setProperty('--style-icon-stroke-width', styles.icon.strokeWidth);
            root.style.setProperty('--style-icon-opacity', styles.icon.opacity);
            root.style.setProperty('--style-icon-opacity-hover', styles.icon.opacityHover);
            root.style.setProperty('--style-icon-transition', styles.icon.transition);
            root.style.setProperty('--style-icon-filter', styles.icon.filter);
            root.style.setProperty('--style-icon-filter-hover', styles.icon.filterHover);
            root.style.setProperty('--style-icon-style', styles.icon.style);
        }
        
        // 应用风格类到 body
        if (document.body) {
            // 移除所有风格类
            document.body.classList.remove(...Array.from(ThemeManager._styles.keys()).map(id => `style-${id}`));
            // 添加当前风格类
            document.body.classList.add(`style-${styleId}`);
        }
        
        // 直接应用窗口样式到所有窗口
        if (styles.window) {
            const allWindows = document.querySelectorAll('.zos-gui-window');
            allWindows.forEach(window => {
                window.style.borderRadius = styles.window.borderRadius;
                window.style.borderWidth = styles.window.borderWidth;
                window.style.backdropFilter = styles.window.backdropFilter;
                window.style.webkitBackdropFilter = styles.window.backdropFilter;
                
                // 根据焦点状态应用不同的阴影
                if (window.classList.contains('zos-window-focused')) {
                    window.style.boxShadow = styles.window.boxShadowFocused || styles.window.boxShadow;
                } else {
                    window.style.boxShadow = styles.window.boxShadowUnfocused || styles.window.boxShadow;
                    window.style.opacity = styles.window.opacityUnfocused || '1';
                }
            });
        }
        
        // 直接应用任务栏样式
        if (styles.taskbar) {
            const taskbar = document.getElementById('taskbar') || document.querySelector('.taskbar');
            if (taskbar) {
                taskbar.style.borderRadius = styles.taskbar.borderRadius;
                taskbar.style.backdropFilter = styles.taskbar.backdropFilter;
                taskbar.style.webkitBackdropFilter = styles.taskbar.backdropFilter;
                taskbar.style.boxShadow = styles.taskbar.boxShadow;
            }
        }
        
        KernelLogger.debug("ThemeManager", `风格已应用到DOM: ${styleId}`);
    }
    
    /**
     * 获取当前主题ID
     * @returns {string} 当前主题ID
     */
    static getCurrentThemeId() {
        return ThemeManager._currentThemeId || 'default';
    }
    
    /**
     * 获取当前主题配置
     * @returns {Object|null} 当前主题配置
     */
    static getCurrentTheme() {
        return ThemeManager._themes.get(ThemeManager._currentThemeId) || null;
    }
    
    /**
     * 获取当前风格ID
     * @returns {string} 当前风格ID
     */
    static getCurrentStyleId() {
        return ThemeManager._currentStyleId || 'ubuntu';
    }
    
    /**
     * 获取当前风格配置
     * @returns {Object|null} 当前风格配置
     */
    static getCurrentStyle() {
        return ThemeManager._styles.get(ThemeManager._currentStyleId) || null;
    }
    
    /**
     * 获取所有主题列表
     * @returns {Array<Object>} 主题列表
     */
    static getAllThemes() {
        return Array.from(ThemeManager._themes.values()).map(theme => ({
            id: theme.id,
            name: theme.name,
            description: theme.description
        }));
    }
    
    /**
     * 获取所有风格列表
     * @returns {Array<Object>} 风格列表
     */
    static getAllStyles() {
        return Array.from(ThemeManager._styles.values()).map(style => ({
            id: style.id,
            name: style.name,
            description: style.description
        }));
    }
    
    /**
     * 注册内置桌面背景图
     */
    static _registerBuiltinDesktopBackgrounds() {
        // 默认背景
        ThemeManager.registerDesktopBackground('default', {
            id: 'default',
            name: '默认背景',
            description: '深色科技风格，紫色和蓝色渐变',
            path: 'assets/desktopBG/default.svg'
        });
        
        // 赛博朋克背景
        ThemeManager.registerDesktopBackground('cyberpunk', {
            id: 'cyberpunk',
            name: '赛博朋克',
            description: '霓虹风格，青色和品红色，未来感十足',
            path: 'assets/desktopBG/cyberpunk.svg'
        });
        
        // 极简背景
        ThemeManager.registerDesktopBackground('minimalist', {
            id: 'minimalist',
            name: '极简风格',
            description: '简洁优雅，蓝色渐变，适合长时间使用',
            path: 'assets/desktopBG/minimalist.svg'
        });
        
        // 自然背景
        ThemeManager.registerDesktopBackground('nature', {
            id: 'nature',
            name: '自然风格',
            description: '绿色和蓝色，自然清新，护眼舒适',
            path: 'assets/desktopBG/nature.svg'
        });
        
        // 宇宙背景
        ThemeManager.registerDesktopBackground('cosmic', {
            id: 'cosmic',
            name: '宇宙风格',
            description: '深蓝星空，星星闪烁，神秘深邃',
            path: 'assets/desktopBG/cosmic.svg'
        });
        
        // 温暖背景
        ThemeManager.registerDesktopBackground('warm', {
            id: 'warm',
            name: '温暖风格',
            description: '橙色和棕色，温暖舒适，适合夜间使用',
            path: 'assets/desktopBG/warm.svg'
        });
    }
    
    /**
     * 注册桌面背景图
     * @param {string} backgroundId 背景图ID
     * @param {Object} background 背景图配置 { id, name, description, path }
     * @returns {boolean} 是否注册成功
     */
    static registerDesktopBackground(backgroundId, background) {
        if (!backgroundId || typeof backgroundId !== 'string') {
            KernelLogger.warn("ThemeManager", `注册桌面背景失败：背景ID无效`);
            return false;
        }
        
        if (!background || typeof background !== 'object') {
            KernelLogger.warn("ThemeManager", `注册桌面背景失败：背景配置无效`);
            return false;
        }
        
        if (!background.path || typeof background.path !== 'string') {
            KernelLogger.warn("ThemeManager", `注册桌面背景失败：背景 ${backgroundId} 缺少 path 配置`);
            return false;
        }
        
        ThemeManager._desktopBackgrounds.set(backgroundId, {
            id: backgroundId,
            name: background.name || backgroundId,
            description: background.description || '',
            path: background.path
        });
        
        KernelLogger.debug("ThemeManager", `注册桌面背景: ${backgroundId} - ${background.name || backgroundId}`);
        return true;
    }
    
    /**
     * 设置桌面背景图
     * @param {string} backgroundId 背景图ID
     * @param {boolean} save 是否保存到 LStorage（默认 true）
     * @returns {Promise<boolean>} 是否设置成功
     */
    static async setDesktopBackground(backgroundId, save = true) {
        if (!ThemeManager._initialized) {
            await ThemeManager.init();
        }
        
        if (!ThemeManager._desktopBackgrounds.has(backgroundId)) {
            KernelLogger.warn("ThemeManager", `桌面背景不存在: ${backgroundId}`);
            return false;
        }
        
        // 应用桌面背景
        ThemeManager._applyDesktopBackground(backgroundId);
        
        // 更新当前背景ID（立即更新，即使保存失败）
        ThemeManager._currentDesktopBackgroundId = backgroundId;
        
        // 保存到 LStorage
        if (save && typeof LStorage !== 'undefined') {
            try {
                // 确保 backgroundId 是字符串类型
                const backgroundIdToSave = String(backgroundId);
                const saveResult = await LStorage.setSystemStorage(ThemeManager.STORAGE_KEY_DESKTOP_BACKGROUND, backgroundIdToSave);
                if (saveResult) {
                    KernelLogger.info("ThemeManager", `桌面背景已保存: ${backgroundIdToSave}`);
                } else {
                    // setSystemStorage 返回 false，但数据已在内存中，LStorage 会安排延迟保存
                    KernelLogger.debug("ThemeManager", `桌面背景已更新，保存将在 D: 分区可用后自动完成: ${backgroundIdToSave}`);
                }
            } catch (e) {
                // 即使保存失败，背景已经应用，LStorage 会安排延迟保存
                if (e.message && e.message.includes('分区不存在')) {
                    KernelLogger.debug("ThemeManager", `桌面背景已更新，保存将在 D: 分区可用后自动完成: ${backgroundId}`);
                } else {
                    KernelLogger.warn("ThemeManager", `保存桌面背景失败: ${e.message}`);
                }
            }
        }
        
        KernelLogger.info("ThemeManager", `桌面背景已切换: ${backgroundId}`);
        return true;
    }
    
    /**
     * 应用桌面背景图到 DOM
     * @param {string} backgroundId 背景图ID
     */
    static _applyDesktopBackground(backgroundId) {
        const background = ThemeManager._desktopBackgrounds.get(backgroundId);
        if (!background) {
            KernelLogger.warn("ThemeManager", `应用桌面背景失败：背景 ${backgroundId} 不存在`);
            return;
        }
        
        ThemeManager._currentDesktopBackgroundId = backgroundId;
        
        // 获取 GUI 容器
        const guiContainer = document.getElementById('gui-container');
        if (!guiContainer) {
            KernelLogger.warn("ThemeManager", "无法获取 GUI 容器，跳过桌面背景应用");
            return;
        }
        
        // 应用背景图
        guiContainer.style.backgroundImage = `url('${background.path}')`;
        guiContainer.style.backgroundSize = 'cover';
        guiContainer.style.backgroundPosition = 'center';
        guiContainer.style.backgroundRepeat = 'no-repeat';
        guiContainer.style.backgroundAttachment = 'fixed';
        
        // 设置 CSS 变量（供其他地方使用）
        const root = document.documentElement;
        if (root) {
            root.style.setProperty('--desktop-background-image', `url('${background.path}')`);
        }
        
        KernelLogger.debug("ThemeManager", `桌面背景已应用到DOM: ${backgroundId}`);
    }
    
    /**
     * 获取当前桌面背景图ID
     * @returns {string|null} 当前桌面背景图ID
     */
    static getCurrentDesktopBackground() {
        return ThemeManager._currentDesktopBackgroundId;
    }
    
    /**
     * 获取所有桌面背景图
     * @returns {Array<Object>} 桌面背景图数组
     */
    static getAllDesktopBackgrounds() {
        return Array.from(ThemeManager._desktopBackgrounds.values());
    }
    
    /**
     * 获取桌面背景图信息
     * @param {string} backgroundId 背景图ID
     * @returns {Object|null} 桌面背景图信息
     */
    static getDesktopBackground(backgroundId) {
        return ThemeManager._desktopBackgrounds.get(backgroundId) || null;
    }
    
    /**
     * 获取主题配置
     * @param {string} themeId 主题ID
     * @returns {Object|null} 主题配置
     */
    static getTheme(themeId) {
        return ThemeManager._themes.get(themeId) || null;
    }
    
    /**
     * 获取风格配置
     * @param {string} styleId 风格ID
     * @returns {Object|null} 风格配置
     */
    static getStyle(styleId) {
        return ThemeManager._styles.get(styleId) || null;
    }
    
    /**
     * 获取系统图标路径
     * @param {string} iconName 图标名称（如 'network', 'battery'）
     * @param {string} styleId 风格ID（可选，默认使用当前风格）
     * @returns {string} 图标文件路径
     */
    static getSystemIconPath(iconName, styleId = null) {
        const currentStyleId = styleId || ThemeManager._currentStyleId || 'ubuntu';
        // 图标路径：assets/icons/{styleId}/{iconName}.svg
        return `assets/icons/${currentStyleId}/${iconName}.svg`;
    }
    
    /**
     * 获取系统图标SVG内容（异步加载）
     * @param {string} iconName 图标名称
     * @param {string} styleId 风格ID（可选，默认使用当前风格）
     * @returns {Promise<string>} SVG内容
     */
    static async getSystemIconSVG(iconName, styleId = null) {
        const iconPath = ThemeManager.getSystemIconPath(iconName, styleId);
        try {
            // 使用 AbortController 设置超时，避免资源耗尽
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
            
            const response = await fetch(iconPath, { 
                signal: controller.signal,
                cache: 'no-cache' // 禁用缓存，确保获取最新图标
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.text();
            } else {
                KernelLogger.warn("ThemeManager", `无法加载图标: ${iconPath}，使用默认图标`);
                // 降级：返回内联SVG
                return ThemeManager._getDefaultIconSVG(iconName);
            }
        } catch (e) {
            // 如果是 AbortError（超时），记录更详细的错误
            if (e.name === 'AbortError') {
                KernelLogger.warn("ThemeManager", `加载图标超时: ${iconPath}，使用默认图标`);
            } else {
                KernelLogger.warn("ThemeManager", `加载图标失败: ${iconPath}, ${e.message}，使用默认图标`);
            }
            return ThemeManager._getDefaultIconSVG(iconName);
        }
    }
    
    /**
     * 获取默认图标SVG（降级方案）
     * @param {string} iconName 图标名称
     * @returns {string} SVG内容
     */
    static _getDefaultIconSVG(iconName) {
        const defaultIcons = {
            network: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" 
                      fill="currentColor" 
                      opacity="0.9"/>
            </svg>`,
            battery: `<svg width="24" height="12" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="2" width="18" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                <rect x="19" y="4" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>
                <rect id="battery-fill" x="2" y="3" width="16" height="6" rx="0.5" fill="currentColor" opacity="0.9"/>
            </svg>`,
            minimize: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            maximize: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
            </svg>`,
            restore: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <rect x="5" y="5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
            </svg>`,
            close: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>`,
            power: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7z" 
                      fill="currentColor" 
                      opacity="0.9"/>
            </svg>`,
            restart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" 
                      fill="currentColor" 
                      opacity="0.9"/>
            </svg>`,
            shutdown: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.59-5.41L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z" 
                      fill="currentColor" 
                      opacity="0.9"/>
            </svg>`,
            'app-default': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 8h8v8H8z" fill="currentColor" opacity="0.5"/>
            </svg>`
        };
        return defaultIcons[iconName] || '';
    }
    
    /**
     * 添加主题变更监听器
     * @param {Function} listener 监听器函数
     * @returns {Function} 取消监听的函数
     */
    static onThemeChange(listener) {
        if (typeof listener !== 'function') {
            KernelLogger.warn("ThemeManager", "监听器必须是函数");
            return () => {};
        }
        
        ThemeManager._themeChangeListeners.push(listener);
        
        // 立即调用一次，传递当前主题
        try {
            listener(ThemeManager._currentThemeId, ThemeManager.getCurrentTheme());
        } catch (e) {
            KernelLogger.warn("ThemeManager", `主题变更监听器初始化失败: ${e.message}`);
        }
        
        return () => {
            const index = ThemeManager._themeChangeListeners.indexOf(listener);
            if (index > -1) {
                ThemeManager._themeChangeListeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 添加风格变更监听器
     * @param {Function} listener 监听器函数
     * @returns {Function} 取消监听的函数
     */
    static onStyleChange(listener) {
        if (typeof listener !== 'function') {
            KernelLogger.warn("ThemeManager", "监听器必须是函数");
            return () => {};
        }
        
        ThemeManager._styleChangeListeners.push(listener);
        
        // 立即调用一次，传递当前风格
        try {
            listener(ThemeManager._currentStyleId, ThemeManager.getCurrentStyle());
        } catch (e) {
            KernelLogger.warn("ThemeManager", `风格变更监听器初始化失败: ${e.message}`);
        }
        
        return () => {
            const index = ThemeManager._styleChangeListeners.indexOf(listener);
            if (index > -1) {
                ThemeManager._styleChangeListeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 移除主题变更监听器
     * @param {Function} listener 监听器函数
     */
    static offThemeChange(listener) {
        const index = ThemeManager._themeChangeListeners.indexOf(listener);
        if (index > -1) {
            ThemeManager._themeChangeListeners.splice(index, 1);
        }
    }
    
    /**
     * 移除风格变更监听器
     * @param {Function} listener 监听器函数
     */
    static offStyleChange(listener) {
        const index = ThemeManager._styleChangeListeners.indexOf(listener);
        if (index > -1) {
            ThemeManager._styleChangeListeners.splice(index, 1);
        }
    }
    
    /**
     * 通知主题变更
     * @param {string} themeId 新主题ID
     */
    static _notifyThemeChange(themeId) {
        const theme = ThemeManager.getCurrentTheme();
        ThemeManager._themeChangeListeners.forEach(listener => {
            try {
                listener(themeId, theme);
            } catch (e) {
                KernelLogger.warn("ThemeManager", `主题变更监听器执行失败: ${e.message}`);
            }
        });
    }
    
    /**
     * 通知风格变更
     * @param {string} styleId 新风格ID
     */
    static _notifyStyleChange(styleId) {
        const style = ThemeManager.getCurrentStyle();
        ThemeManager._styleChangeListeners.forEach(listener => {
            try {
                listener(styleId, style);
            } catch (e) {
                KernelLogger.warn("ThemeManager", `风格变更监听器执行失败: ${e.message}`);
            }
        });
    }
}

// 注册到 POOL
if (typeof POOL !== 'undefined' && typeof POOL.__ADD__ === 'function') {
    try {
        if (!POOL.__HAS__("KERNEL_GLOBAL_POOL")) {
            POOL.__INIT__("KERNEL_GLOBAL_POOL");
        }
        POOL.__ADD__("KERNEL_GLOBAL_POOL", "ThemeManager", ThemeManager);
    } catch (e) {
        KernelLogger.error("ThemeManager", `注册到POOL失败: ${e.message}`);
    }
}

// 自动初始化（异步，不阻塞）
(async () => {
    try {
        await ThemeManager.init();
    } catch (e) {
        if (typeof KernelLogger !== 'undefined') {
            KernelLogger.error("ThemeManager", `自动初始化失败: ${e.message}`);
        } else {
            console.error("[ThemeManager] 自动初始化失败:", e);
        }
    }
})();

// 发布信号
if (typeof DependencyConfig !== 'undefined') {
    DependencyConfig.publishSignal("../kernel/process/themeManager.js");
}
