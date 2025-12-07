// ZerOS 主题与动画管理器
// 负责系统主题和GUI风格的切换，以及动画参数的调整
// 注意：此程序必须禁止自动初始化，通过 ProcessManager 管理

(function(window) {
    'use strict';
    
    const THEMEANIMATOR = {
        pid: null,
        window: null,
        currentThemeId: null,
        currentStyleId: null,
        themeChangeUnsubscribe: null,
        styleChangeUnsubscribe: null,
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建主窗口
            this.window = document.createElement('div');
            this.window.className = 'themeanimator-window zos-gui-window';
            this.window.dataset.pid = pid.toString();
            this.window.style.cssText = `
                width: 900px;
                height: 700px;
            `;
            
            // 使用GUIManager注册窗口
            if (typeof GUIManager !== 'undefined') {
                // 获取程序图标
                let icon = null;
                if (typeof ApplicationAssetManager !== 'undefined') {
                    icon = ApplicationAssetManager.getIcon('themeanimator');
                }
                
                GUIManager.registerWindow(pid, this.window, {
                    title: '主题与动画管理器',
                    icon: icon,
                    onClose: () => {
                        // 调用 ProcessManager.killProgram 来终止程序
                        // 这会触发 __exit__ 方法并清理所有资源
                        if (typeof ProcessManager !== 'undefined' && this.pid) {
                            ProcessManager.killProgram(this.pid).catch(e => {
                                console.error('[themeanimator] 关闭程序失败:', e);
                            });
                        } else {
                            // 降级：直接调用 __exit__
                            this.__exit__();
                        }
                    }
                });
            }
            
            // 创建主内容区域
            const content = document.createElement('div');
            content.className = 'themeanimator-content';
            content.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                padding: 20px;
                gap: 20px;
            `;
            
            // 创建标签页容器
            const tabsContainer = this._createTabsContainer();
            content.appendChild(tabsContainer);
            
            // 创建内容面板容器
            const panelsContainer = document.createElement('div');
            panelsContainer.className = 'themeanimator-panels';
            panelsContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding-top: 20px;
            `;
            
            // 创建主题管理面板
            const themePanel = this._createThemePanel();
            themePanel.classList.add('active');
            themePanel.style.display = 'flex';
            panelsContainer.appendChild(themePanel);
            
            // 创建风格管理面板
            const stylePanel = this._createStylePanel();
            panelsContainer.appendChild(stylePanel);
            
            // 创建背景图管理面板
            const backgroundPanel = this._createBackgroundPanel();
            panelsContainer.appendChild(backgroundPanel);
            
            // 创建动画管理面板
            const animationPanel = this._createAnimationPanel();
            panelsContainer.appendChild(animationPanel);
            
            content.appendChild(panelsContainer);
            this.window.appendChild(content);
            
            // 添加到容器
            guiContainer.appendChild(this.window);
            
            // 初始化数据
            await this._loadCurrentSettings();
            
            // 监听主题和风格变更
            this._setupListeners();
        },
        
        __info__: function() {
            return {
                name: '主题与动画管理器',
                description: '系统主题与动画的调控与管理',
                version: '1.0.0',
                author: 'ZerOS'
            };
        },
        
        __exit__: function(pid, force) {
            // 防止递归调用：如果已经标记为退出中，直接返回
            if (this._exiting) {
                return;
            }
            this._exiting = true;
            
            // 移除监听器（onThemeChange和onStyleChange返回取消函数）
            if (this.themeChangeUnsubscribe && typeof this.themeChangeUnsubscribe === 'function') {
                try {
                    this.themeChangeUnsubscribe();
                } catch (e) {
                    // 忽略错误
                }
            }
            if (this.styleChangeUnsubscribe && typeof this.styleChangeUnsubscribe === 'function') {
                try {
                    this.styleChangeUnsubscribe();
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 移除窗口
            if (this.window && this.window.parentElement) {
                try {
                    this.window.parentElement.removeChild(this.window);
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 注销窗口
            if (typeof GUIManager !== 'undefined' && this.pid) {
                try {
                    GUIManager.unregisterWindow(this.pid);
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 注意：不要在这里调用 ProcessManager.killProgram，因为 killProgram 会调用 __exit__
            // ProcessManager 会在调用 __exit__ 后自动清理资源
        },
        
        /**
         * 创建标签页容器
         */
        _createTabsContainer: function() {
            const container = document.createElement('div');
            container.className = 'themeanimator-tabs';
            container.style.cssText = `
                display: flex;
                gap: 8px;
                border-bottom: 2px solid rgba(139, 92, 246, 0.3);
                padding-bottom: 8px;
            `;
            
            const tabs = [
                { id: 'theme', label: '主题', icon: '🎨' },
                { id: 'style', label: '风格', icon: '💅' },
                { id: 'background', label: '背景', icon: '🖼️' },
                { id: 'animation', label: '动画', icon: '✨' }
            ];
            
            tabs.forEach((tab, index) => {
                const tabBtn = document.createElement('button');
                tabBtn.className = 'themeanimator-tab';
                tabBtn.dataset.tab = tab.id;
                tabBtn.style.cssText = `
                    padding: 10px 20px;
                    background: transparent;
                    border: none;
                    color: rgba(215, 224, 221, 0.7);
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    border-radius: 6px 6px 0 0;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;
                tabBtn.innerHTML = `<span>${tab.icon}</span><span>${tab.label}</span>`;
                
                if (index === 0) {
                    tabBtn.classList.add('active');
                    tabBtn.style.color = 'rgba(139, 92, 246, 1)';
                    tabBtn.style.background = 'rgba(139, 92, 246, 0.1)';
                }
                
                tabBtn.addEventListener('click', () => {
                    this._switchTab(tab.id);
                });
                
                tabBtn.addEventListener('mouseenter', () => {
                    if (!tabBtn.classList.contains('active')) {
                        tabBtn.style.background = 'rgba(139, 92, 246, 0.05)';
                    }
                });
                
                tabBtn.addEventListener('mouseleave', () => {
                    if (!tabBtn.classList.contains('active')) {
                        tabBtn.style.background = 'transparent';
                    }
                });
                
                container.appendChild(tabBtn);
            });
            
            return container;
        },
        
        /**
         * 切换标签页
         */
        _switchTab: function(tabId) {
            // 更新标签按钮
            const tabs = this.window.querySelectorAll('.themeanimator-tab');
            tabs.forEach(tab => {
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                    tab.style.color = 'rgba(139, 92, 246, 1)';
                    tab.style.background = 'rgba(139, 92, 246, 0.1)';
                } else {
                    tab.classList.remove('active');
                    tab.style.color = 'rgba(215, 224, 221, 0.7)';
                    tab.style.background = 'transparent';
                }
            });
            
            // 更新面板
            const panels = this.window.querySelectorAll('.themeanimator-panel');
            panels.forEach(panel => {
                if (panel.dataset.panel === tabId) {
                    panel.style.display = 'flex';
                    panel.classList.add('active');
                } else {
                    panel.style.display = 'none';
                    panel.classList.remove('active');
                }
            });
        },
        
        /**
         * 创建主题管理面板
         */
        _createThemePanel: function() {
            const panel = document.createElement('div');
            panel.className = 'themeanimator-panel';
            panel.dataset.panel = 'theme';
            panel.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 20px;
            `;
            
            // 当前主题显示
            const currentSection = document.createElement('div');
            currentSection.className = 'themeanimator-section';
            currentSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">当前主题</h3>
                <div class="current-theme-display" style="
                    padding: 16px;
                    background: rgba(139, 92, 246, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(139, 92, 246, 0.3);
                ">
                    <div id="current-theme-name" style="font-size: 18px; font-weight: 600; color: rgba(139, 92, 246, 1); margin-bottom: 8px;">加载中...</div>
                    <div id="current-theme-description" style="font-size: 13px; color: rgba(215, 224, 221, 0.7);">正在加载主题信息...</div>
                </div>
            `;
            panel.appendChild(currentSection);
            
            // 主题列表
            const themesSection = document.createElement('div');
            themesSection.className = 'themeanimator-section';
            themesSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">可用主题</h3>
                <div id="themes-list" class="themes-list" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                "></div>
            `;
            panel.appendChild(themesSection);
            
            // 加载主题列表
            this._loadThemesList(themesSection.querySelector('#themes-list'));
            
            return panel;
        },
        
        /**
         * 创建风格管理面板
         */
        _createStylePanel: function() {
            const panel = document.createElement('div');
            panel.className = 'themeanimator-panel';
            panel.dataset.panel = 'style';
            panel.style.cssText = `
                display: none;
                flex-direction: column;
                gap: 20px;
            `;
            
            // 当前风格显示
            const currentSection = document.createElement('div');
            currentSection.className = 'themeanimator-section';
            currentSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">当前风格</h3>
                <div class="current-style-display" style="
                    padding: 16px;
                    background: rgba(139, 92, 246, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(139, 92, 246, 0.3);
                ">
                    <div id="current-style-name" style="font-size: 18px; font-weight: 600; color: rgba(139, 92, 246, 1); margin-bottom: 8px;">加载中...</div>
                    <div id="current-style-description" style="font-size: 13px; color: rgba(215, 224, 221, 0.7);">正在加载风格信息...</div>
                </div>
            `;
            panel.appendChild(currentSection);
            
            // 风格列表
            const stylesSection = document.createElement('div');
            stylesSection.className = 'themeanimator-section';
            stylesSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">可用风格</h3>
                <div id="styles-list" class="styles-list" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                "></div>
            `;
            panel.appendChild(stylesSection);
            
            // 加载风格列表
            this._loadStylesList(stylesSection.querySelector('#styles-list'));
            
            return panel;
        },
        
        /**
         * 创建背景图管理面板
         */
        _createBackgroundPanel: function() {
            const panel = document.createElement('div');
            panel.className = 'themeanimator-panel';
            panel.dataset.panel = 'background';
            panel.style.cssText = `
                display: none;
                flex-direction: column;
                gap: 20px;
            `;
            
            // 当前背景显示
            const currentSection = document.createElement('div');
            currentSection.className = 'themeanimator-section';
            currentSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">当前背景</h3>
                <div class="current-background-display" style="
                    padding: 16px;
                    background: rgba(139, 92, 246, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(139, 92, 246, 0.3);
                ">
                    <div id="current-background-name" style="font-size: 18px; font-weight: 600; color: rgba(139, 92, 246, 1); margin-bottom: 8px;">加载中...</div>
                    <div id="current-background-description" style="font-size: 13px; color: rgba(215, 224, 221, 0.7);">正在加载背景信息...</div>
                </div>
            `;
            panel.appendChild(currentSection);
            
            // 背景图列表
            const backgroundsSection = document.createElement('div');
            backgroundsSection.className = 'themeanimator-section';
            backgroundsSection.innerHTML = `
                <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">可用背景</h3>
                <div id="backgrounds-list" class="backgrounds-list" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                "></div>
            `;
            panel.appendChild(backgroundsSection);
            
            // 加载背景图列表
            this._loadBackgroundsList(backgroundsSection.querySelector('#backgrounds-list'));
            
            return panel;
        },
        
        /**
         * 创建动画管理面板
         */
        _createAnimationPanel: function() {
            const panel = document.createElement('div');
            panel.className = 'themeanimator-panel';
            panel.dataset.panel = 'animation';
            panel.style.cssText = `
                display: none;
                flex-direction: column;
                gap: 20px;
            `;
            
            panel.innerHTML = `
                <div class="themeanimator-section">
                    <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">动画预设</h3>
                    <div style="padding: 16px; background: rgba(139, 92, 246, 0.05); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
                        <p style="margin: 0; color: rgba(215, 224, 221, 0.7); font-size: 13px; line-height: 1.6;">
                            动画参数由系统统一管理，当前所有动画已通过 AnimateManager 进行优化配置。
                            如需调整动画速度或效果，请修改 AnimateManager 中的预设配置。
                        </p>
                    </div>
                </div>
                <div class="themeanimator-section">
                    <h3 style="margin: 0 0 12px 0; color: rgba(215, 224, 221, 0.9); font-size: 16px; font-weight: 600;">动画信息</h3>
                    <div id="animation-info" style="
                        padding: 16px;
                        background: rgba(139, 92, 246, 0.05);
                        border-radius: 8px;
                        border: 1px solid rgba(139, 92, 246, 0.2);
                    "></div>
                </div>
            `;
            
            // 加载动画信息
            this._loadAnimationInfo(panel.querySelector('#animation-info'));
            
            return panel;
        },
        
        /**
         * 加载当前设置
         */
        _loadCurrentSettings: async function() {
            if (typeof ProcessManager === 'undefined') {
                return;
            }
            
            try {
                // 获取当前主题
                const currentTheme = await ProcessManager.getCurrentTheme(this.pid);
                if (currentTheme) {
                    this.currentThemeId = currentTheme.id;
                    this._updateCurrentThemeDisplay(currentTheme);
                }
                
                // 获取当前风格
                const currentStyle = await ProcessManager.getCurrentStyle(this.pid);
                if (currentStyle) {
                    this.currentStyleId = currentStyle.id;
                    this._updateCurrentStyleDisplay(currentStyle);
                }
                
                // 获取当前桌面背景
                const currentBackgroundId = ProcessManager.getCurrentDesktopBackground(this.pid);
                if (currentBackgroundId) {
                    const currentBackground = ProcessManager.getDesktopBackground(currentBackgroundId, this.pid);
                    if (currentBackground) {
                        this._updateCurrentBackgroundDisplay(currentBackground);
                    }
                }
            } catch (e) {
                console.error('加载当前设置失败:', e);
            }
        },
        
        /**
         * 设置监听器
         */
        _setupListeners: function() {
            if (typeof ProcessManager === 'undefined') {
                return;
            }
            
            // 监听主题变更
            try {
                const themeChangeListener = (themeId, theme) => {
                    this.currentThemeId = themeId;
                    this._updateCurrentThemeDisplay(theme);
                    this._updateThemesList();
                };
                this.themeChangeUnsubscribe = ProcessManager.onThemeChange(themeChangeListener, this.pid);
            } catch (e) {
                console.error('注册主题变更监听器失败:', e);
            }
            
            // 监听风格变更
            try {
                const styleChangeListener = (styleId, style) => {
                    this.currentStyleId = styleId;
                    this._updateCurrentStyleDisplay(style);
                    this._updateStylesList();
                };
                this.styleChangeUnsubscribe = ProcessManager.onStyleChange(styleChangeListener, this.pid);
            } catch (e) {
                console.error('注册风格变更监听器失败:', e);
            }
        },
        
        /**
         * 加载主题列表
         */
        _loadThemesList: async function(container) {
            if (typeof ProcessManager === 'undefined') {
                container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">ProcessManager 不可用</p>';
                return;
            }
            
            try {
                const themes = await ProcessManager.getAllThemes(this.pid);
                if (!themes || themes.length === 0) {
                    container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">没有可用的主题</p>';
                    return;
                }
                
                container.innerHTML = '';
                themes.forEach(theme => {
                    const themeCard = this._createThemeCard(theme);
                    container.appendChild(themeCard);
                });
            } catch (e) {
                container.innerHTML = `<p style="color: rgba(255, 95, 87, 0.8);">加载主题列表失败: ${e.message}</p>`;
            }
        },
        
        /**
         * 创建主题卡片
         */
        _createThemeCard: function(theme) {
            const card = document.createElement('div');
            card.className = 'theme-card';
            const isActive = theme.id === this.currentThemeId;
            
            card.style.cssText = `
                padding: 16px;
                background: ${isActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.05)'};
                border: 2px solid ${isActive ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.2)'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // 主题预览（使用主题的主要颜色）
            const preview = document.createElement('div');
            preview.style.cssText = `
                width: 100%;
                height: 80px;
                border-radius: 6px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, 
                    ${theme.colors?.primary || '#8b5cf6'} 0%, 
                    ${theme.colors?.secondary || '#6366f1'} 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            card.appendChild(preview);
            
            // 主题名称
            const name = document.createElement('div');
            name.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: rgba(215, 224, 221, 0.9);
                margin-bottom: 4px;
            `;
            name.textContent = theme.name || theme.id;
            card.appendChild(name);
            
            // 主题描述
            if (theme.description) {
                const desc = document.createElement('div');
                desc.style.cssText = `
                    font-size: 12px;
                    color: rgba(215, 224, 221, 0.6);
                    line-height: 1.4;
                `;
                desc.textContent = theme.description;
                card.appendChild(desc);
            }
            
            // 激活标记
            if (isActive) {
                const badge = document.createElement('div');
                badge.style.cssText = `
                    margin-top: 8px;
                    padding: 4px 8px;
                    background: rgba(139, 92, 246, 0.3);
                    color: rgba(139, 92, 246, 1);
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    display: inline-block;
                `;
                badge.textContent = '当前主题';
                card.appendChild(badge);
            }
            
            // 点击切换主题
            if (!isActive) {
                card.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        console.log(`[themeanimator] 切换主题: ${theme.id}`);
                        const result = await ProcessManager.setTheme(theme.id, this.pid);
                        if (!result) {
                            console.error(`[themeanimator] 切换主题失败: 主题 ${theme.id} 不存在或无法应用`);
                            alert(`切换主题失败: 主题 ${theme.id} 不存在或无法应用`);
                        } else {
                            console.log(`[themeanimator] 主题切换成功: ${theme.id}`);
                            // 成功时，监听器会自动更新UI
                        }
                    } catch (e) {
                        console.error('[themeanimator] 切换主题失败:', e);
                        alert(`切换主题失败: ${e.message}`);
                    }
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.1)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.05)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                });
            }
            
            return card;
        },
        
        /**
         * 加载风格列表
         */
        _loadStylesList: async function(container) {
            if (typeof ProcessManager === 'undefined') {
                container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">ProcessManager 不可用</p>';
                return;
            }
            
            try {
                const styles = await ProcessManager.getAllStyles(this.pid);
                if (!styles || styles.length === 0) {
                    container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">没有可用的风格</p>';
                    return;
                }
                
                container.innerHTML = '';
                styles.forEach(style => {
                    const styleCard = this._createStyleCard(style);
                    container.appendChild(styleCard);
                });
            } catch (e) {
                container.innerHTML = `<p style="color: rgba(255, 95, 87, 0.8);">加载风格列表失败: ${e.message}</p>`;
            }
        },
        
        /**
         * 创建风格卡片
         */
        _createStyleCard: function(style) {
            const card = document.createElement('div');
            card.className = 'style-card';
            const isActive = style.id === this.currentStyleId;
            
            card.style.cssText = `
                padding: 16px;
                background: ${isActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.05)'};
                border: 2px solid ${isActive ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.2)'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // 风格预览（显示风格特征）
            const preview = document.createElement('div');
            preview.style.cssText = `
                width: 100%;
                height: 80px;
                border-radius: ${style.styles?.window?.borderRadius || '8px'};
                margin-bottom: 12px;
                background: rgba(139, 92, 246, 0.1);
                border: 1px solid rgba(139, 92, 246, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
            `;
            preview.textContent = style.name === 'Ubuntu' ? '🟣' : 
                                 style.name === 'Windows' ? '🟦' : 
                                 style.name === 'macOS' ? '⚪' : 
                                 style.name === 'GNOME' ? '🟢' : 
                                 style.name === 'Material' ? '🔷' : '🎨';
            card.appendChild(preview);
            
            // 风格名称
            const name = document.createElement('div');
            name.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: rgba(215, 224, 221, 0.9);
                margin-bottom: 4px;
            `;
            name.textContent = style.name || style.id;
            card.appendChild(name);
            
            // 风格描述
            if (style.description) {
                const desc = document.createElement('div');
                desc.style.cssText = `
                    font-size: 12px;
                    color: rgba(215, 224, 221, 0.6);
                    line-height: 1.4;
                `;
                desc.textContent = style.description;
                card.appendChild(desc);
            }
            
            // 激活标记
            if (isActive) {
                const badge = document.createElement('div');
                badge.style.cssText = `
                    margin-top: 8px;
                    padding: 4px 8px;
                    background: rgba(139, 92, 246, 0.3);
                    color: rgba(139, 92, 246, 1);
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    display: inline-block;
                `;
                badge.textContent = '当前风格';
                card.appendChild(badge);
            }
            
            // 点击切换风格
            if (!isActive) {
                card.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        console.log(`[themeanimator] 切换风格: ${style.id}`);
                        const result = await ProcessManager.setStyle(style.id, this.pid);
                        if (!result) {
                            console.error(`[themeanimator] 切换风格失败: 风格 ${style.id} 不存在或无法应用`);
                            alert(`切换风格失败: 风格 ${style.id} 不存在或无法应用`);
                        } else {
                            console.log(`[themeanimator] 风格切换成功: ${style.id}`);
                            // 成功时，监听器会自动更新UI
                        }
                    } catch (e) {
                        console.error('[themeanimator] 切换风格失败:', e);
                        alert(`切换风格失败: ${e.message}`);
                    }
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.1)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.05)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                });
            }
            
            return card;
        },
        
        /**
         * 更新当前主题显示
         */
        _updateCurrentThemeDisplay: function(theme) {
            const nameEl = this.window.querySelector('#current-theme-name');
            const descEl = this.window.querySelector('#current-theme-description');
            
            if (nameEl) {
                nameEl.textContent = theme.name || theme.id;
            }
            if (descEl) {
                descEl.textContent = theme.description || '无描述';
            }
        },
        
        /**
         * 更新当前风格显示
         */
        _updateCurrentStyleDisplay: function(style) {
            const nameEl = this.window.querySelector('#current-style-name');
            const descEl = this.window.querySelector('#current-style-description');
            
            if (nameEl) {
                nameEl.textContent = style.name || style.id;
            }
            if (descEl) {
                descEl.textContent = style.description || '无描述';
            }
        },
        
        /**
         * 更新主题列表
         */
        _updateThemesList: function() {
            const container = this.window.querySelector('#themes-list');
            if (container) {
                this._loadThemesList(container);
            }
        },
        
        /**
         * 更新风格列表
         */
        _updateStylesList: function() {
            const container = this.window.querySelector('#styles-list');
            if (container) {
                this._loadStylesList(container);
            }
        },
        
        /**
         * 加载背景图列表
         */
        _loadBackgroundsList: async function(container) {
            if (typeof ProcessManager === 'undefined') {
                container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">ProcessManager 不可用</p>';
                return;
            }
            
            try {
                const backgrounds = ProcessManager.getAllDesktopBackgrounds(this.pid);
                if (!backgrounds || backgrounds.length === 0) {
                    container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">没有可用的背景</p>';
                    return;
                }
                
                container.innerHTML = '';
                backgrounds.forEach(background => {
                    const backgroundCard = this._createBackgroundCard(background);
                    container.appendChild(backgroundCard);
                });
            } catch (e) {
                container.innerHTML = `<p style="color: rgba(255, 95, 87, 0.8);">加载背景列表失败: ${e.message}</p>`;
            }
        },
        
        /**
         * 创建背景图卡片
         */
        _createBackgroundCard: function(background) {
            const card = document.createElement('div');
            card.className = 'background-card';
            const currentBackgroundId = ProcessManager.getCurrentDesktopBackground(this.pid);
            const isActive = background.id === currentBackgroundId;
            
            card.style.cssText = `
                padding: 16px;
                background: ${isActive ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.05)'};
                border: 2px solid ${isActive ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.2)'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // 背景预览（使用背景图）
            const preview = document.createElement('div');
            preview.style.cssText = `
                width: 100%;
                height: 100px;
                border-radius: 6px;
                margin-bottom: 12px;
                background-image: url('${background.path}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                border: 1px solid rgba(255, 255, 255, 0.1);
                overflow: hidden;
            `;
            card.appendChild(preview);
            
            // 背景名称
            const name = document.createElement('div');
            name.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: rgba(215, 224, 221, 0.9);
                margin-bottom: 4px;
            `;
            name.textContent = background.name || background.id;
            card.appendChild(name);
            
            // 背景描述
            if (background.description) {
                const desc = document.createElement('div');
                desc.style.cssText = `
                    font-size: 12px;
                    color: rgba(215, 224, 221, 0.6);
                    line-height: 1.4;
                `;
                desc.textContent = background.description;
                card.appendChild(desc);
            }
            
            // 激活标记
            if (isActive) {
                const badge = document.createElement('div');
                badge.style.cssText = `
                    margin-top: 8px;
                    padding: 4px 8px;
                    background: rgba(139, 92, 246, 0.3);
                    color: rgba(139, 92, 246, 1);
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    display: inline-block;
                `;
                badge.textContent = '当前背景';
                card.appendChild(badge);
            }
            
            // 点击切换背景
            if (!isActive) {
                card.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        console.log(`[themeanimator] 切换桌面背景: ${background.id}`);
                        const result = await ProcessManager.setDesktopBackground(background.id, this.pid);
                        if (!result) {
                            console.error(`[themeanimator] 切换桌面背景失败: 背景 ${background.id} 不存在或无法应用`);
                            alert(`切换桌面背景失败: 背景 ${background.id} 不存在或无法应用`);
                        } else {
                            console.log(`[themeanimator] 桌面背景切换成功: ${background.id}`);
                            // 更新当前背景显示
                            this._updateCurrentBackgroundDisplay(background);
                            // 更新背景列表
                            this._updateBackgroundsList();
                        }
                    } catch (e) {
                        console.error('[themeanimator] 切换桌面背景失败:', e);
                        alert(`切换桌面背景失败: ${e.message}`);
                    }
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.1)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.background = 'rgba(139, 92, 246, 0.05)';
                    card.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                });
            }
            
            return card;
        },
        
        /**
         * 更新当前背景显示
         */
        _updateCurrentBackgroundDisplay: function(background) {
            const nameEl = this.window.querySelector('#current-background-name');
            const descEl = this.window.querySelector('#current-background-description');
            
            if (nameEl) {
                nameEl.textContent = background.name || background.id;
            }
            if (descEl) {
                descEl.textContent = background.description || '无描述';
            }
        },
        
        /**
         * 更新背景列表
         */
        _updateBackgroundsList: function() {
            const container = this.window.querySelector('#backgrounds-list');
            if (container) {
                this._loadBackgroundsList(container);
            }
        },
        
        /**
         * 加载动画信息
         */
        _loadAnimationInfo: function(container) {
            if (typeof AnimateManager === 'undefined') {
                container.innerHTML = '<p style="color: rgba(215, 224, 221, 0.7);">AnimateManager 不可用</p>';
                return;
            }
            
            try {
                const presets = AnimateManager.ANIMATION_PRESETS || {};
                const keyframes = AnimateManager.KEYFRAMES || {};
                
                let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
                
                // 动画预设数量
                const presetCount = Object.keys(presets).length;
                html += `<div style="padding: 12px; background: rgba(139, 92, 246, 0.05); border-radius: 6px;">
                    <strong style="color: rgba(215, 224, 221, 0.9);">动画预设:</strong> 
                    <span style="color: rgba(139, 92, 246, 1);">${presetCount} 个</span>
                </div>`;
                
                // Keyframes数量
                const keyframeCount = Object.keys(keyframes).length;
                html += `<div style="padding: 12px; background: rgba(139, 92, 246, 0.05); border-radius: 6px;">
                    <strong style="color: rgba(215, 224, 221, 0.9);">关键帧动画:</strong> 
                    <span style="color: rgba(139, 92, 246, 1);">${keyframeCount} 个</span>
                </div>`;
                
                html += '</div>';
                container.innerHTML = html;
            } catch (e) {
                container.innerHTML = `<p style="color: rgba(255, 95, 87, 0.8);">加载动画信息失败: ${e.message}</p>`;
            }
        }
    };
    
    // 导出到全局（通过POOL管理）
    if (typeof POOL !== 'undefined' && typeof POOL.__ADD__ === 'function') {
        try {
            if (!POOL.__HAS__("APPLICATION_POOL")) {
                POOL.__INIT__("APPLICATION_POOL");
            }
            POOL.__ADD__("APPLICATION_POOL", "THEMEANIMATOR", THEMEANIMATOR);
        } catch (e) {
            // 降级方案
            if (typeof window !== 'undefined') {
                window.THEMEANIMATOR = THEMEANIMATOR;
            }
        }
    } else {
        if (typeof window !== 'undefined') {
            window.THEMEANIMATOR = THEMEANIMATOR;
        }
    }
    
})(window);

