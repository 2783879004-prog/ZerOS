// ZerOS 浏览器
// 提供基于iframe的简单网页浏览功能
// 注意：此程序必须禁止自动初始化，通过 ProcessManager 管理

(function(window) {
    'use strict';
    
    const BROWSER = {
        pid: null,
        window: null,
        iframe: null,
        addressBar: null,
        bookmarksBar: null,
        currentUrl: 'https://www.bing.com',
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建主窗口
            this.window = document.createElement('div');
            this.window.className = 'browser-window zos-gui-window';
            this.window.dataset.pid = pid.toString();
            
            // 如果 GUIManager 不可用，设置完整样式
            if (typeof GUIManager === 'undefined') {
                this.window.style.cssText = `
                    width: 1000px;
                    height: 700px;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(180deg, rgba(26, 31, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
                    border: 1px solid rgba(108, 142, 255, 0.3);
                    border-radius: 12px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(30px) saturate(180%);
                    -webkit-backdrop-filter: blur(30px) saturate(180%);
                    overflow: hidden;
                `;
            } else {
                this.window.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                `;
            }
            
            // 使用GUIManager注册窗口
            if (typeof GUIManager !== 'undefined') {
                let icon = null;
                if (typeof ApplicationAssetManager !== 'undefined') {
                    icon = ApplicationAssetManager.getIcon('browser');
                }
                
                GUIManager.registerWindow(pid, this.window, {
                    title: '浏览器',
                    icon: icon,
                    onClose: () => {
                        if (typeof ProcessManager !== 'undefined') {
                            ProcessManager.killProgram(this.pid);
                        }
                    }
                });
            }
            
            // 创建工具栏
            const toolbar = this._createToolbar();
            this.window.appendChild(toolbar);
            
            // 创建书签栏
            const bookmarksBar = this._createBookmarksBar();
            this.bookmarksBar = bookmarksBar;
            this.window.appendChild(bookmarksBar);
            
            // 创建内容区域（iframe）
            const content = this._createContent();
            this.window.appendChild(content);
            
            // 添加到GUI容器
            guiContainer.appendChild(this.window);
            
            // 加载默认页面
            this._navigateTo(this.currentUrl);
        },
        
        /**
         * 创建工具栏
         */
        _createToolbar: function() {
            const toolbar = document.createElement('div');
            toolbar.className = 'browser-toolbar';
            // 确保工具栏固定高度
            toolbar.style.cssText = `
                height: 56px;
                min-height: 56px;
                max-height: 56px;
                flex-shrink: 0;
                box-sizing: border-box;
                overflow: hidden;
            `;
            
            // 导航按钮组
            const navGroup = document.createElement('div');
            navGroup.className = 'browser-nav-group';
            
            // 后退按钮
            const backBtn = this._createToolbarButton('‹', '后退', () => {
                if (this.iframe && this.iframe.contentWindow) {
                    try {
                        this.iframe.contentWindow.history.back();
                    } catch (e) {
                        console.warn('无法后退:', e);
                    }
                }
            });
            navGroup.appendChild(backBtn);
            
            // 前进按钮
            const forwardBtn = this._createToolbarButton('›', '前进', () => {
                if (this.iframe && this.iframe.contentWindow) {
                    try {
                        this.iframe.contentWindow.history.forward();
                    } catch (e) {
                        console.warn('无法前进:', e);
                    }
                }
            });
            navGroup.appendChild(forwardBtn);
            
            // 刷新按钮
            const refreshBtn = this._createToolbarButton('↻', '刷新', () => {
                if (this.iframe) {
                    this.iframe.src = this.iframe.src;
                }
            });
            navGroup.appendChild(refreshBtn);
            
            toolbar.appendChild(navGroup);
            
            // 地址栏
            const addressBarContainer = document.createElement('div');
            addressBarContainer.className = 'browser-address-container';
            
            const addressBar = document.createElement('input');
            addressBar.className = 'browser-address-bar';
            addressBar.type = 'text';
            addressBar.placeholder = '输入网址或搜索...';
            addressBar.value = this.currentUrl;
            addressBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this._handleAddressSubmit(addressBar.value);
                }
            });
            addressBar.addEventListener('focus', () => {
                addressBar.select();
            });
            
            this.addressBar = addressBar;
            addressBarContainer.appendChild(addressBar);
            
            // 转到按钮
            const goBtn = this._createToolbarButton('→', '转到', () => {
                this._handleAddressSubmit(addressBar.value);
            });
            addressBarContainer.appendChild(goBtn);
            
            toolbar.appendChild(addressBarContainer);
            
            return toolbar;
        },
        
        /**
         * 创建工具栏按钮
         */
        _createToolbarButton: function(text, title, onClick) {
            const btn = document.createElement('button');
            btn.className = 'browser-toolbar-btn';
            btn.textContent = text;
            btn.title = title;
            btn.addEventListener('click', onClick);
            return btn;
        },
        
        /**
         * 处理地址栏提交
         */
        _handleAddressSubmit: function(input) {
            let url = input.trim();
            
            // 如果没有协议，添加 https://
            if (!url.match(/^https?:\/\//i)) {
                // 检查是否是域名格式
                if (url.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)+$/)) {
                    url = 'https://' + url;
                } else {
                    // 否则作为搜索查询
                    url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
                }
            }
            
            this._navigateTo(url);
        },
        
        /**
         * 获取 NetworkManager 实例（辅助函数）
         */
        _getNetworkManager: function() {
            if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    return POOL.__GET__("KERNEL_GLOBAL_POOL", "NetworkManager");
                } catch (e) {
                    // 忽略错误
                }
            }
            // 降级：尝试从全局对象获取
            if (typeof window !== 'undefined' && window.NetworkManager) {
                return window.NetworkManager;
            } else if (typeof globalThis !== 'undefined' && globalThis.NetworkManager) {
                return globalThis.NetworkManager;
            }
            return null;
        },
        
        /**
         * 导航到指定URL
         */
        _navigateTo: function(url) {
            if (!this.iframe) return;
            
            this.currentUrl = url;
            if (this.addressBar) {
                this.addressBar.value = url;
            }
            
            // 添加加载动画
            this.iframe.classList.add('loading');
            
            // 通过 NetworkManager 记录网络请求（如果可用）
            // 注意：iframe.src 的加载会自动被 NetworkManager 拦截（在降级模式下）
            // 这里我们只是确保 NetworkManager 已初始化
            
            // 设置iframe源（iframe 的加载会被 NetworkManager 自动拦截）
            this.iframe.src = url;
            
            // 监听加载完成
            this.iframe.onload = () => {
                this.iframe.classList.remove('loading');
                
                if (this.addressBar) {
                    try {
                        // 尝试获取iframe的实际URL（可能因为跨域限制失败）
                        const iframeUrl = this.iframe.contentWindow.location.href;
                        this.addressBar.value = iframeUrl;
                        this.currentUrl = iframeUrl;
                    } catch (e) {
                        // 跨域限制，使用设置的URL
                        this.addressBar.value = url;
                    }
                }
            };
            
            this.iframe.onerror = () => {
                this.iframe.classList.remove('loading');
            };
        },
        
        /**
         * 创建书签栏
         */
        _createBookmarksBar: function() {
            const bar = document.createElement('div');
            bar.className = 'browser-bookmarks-bar';
            // 确保书签栏固定高度
            bar.style.cssText = `
                height: 40px;
                min-height: 40px;
                max-height: 40px;
                flex-shrink: 0;
                box-sizing: border-box;
            `;
            
            // 加载书签
            this._loadBookmarks(bar);
            
            return bar;
        },
        
        /**
         * 加载书签
         */
        _loadBookmarks: function(container) {
            // 清空容器
            container.innerHTML = '';
            
            // 获取书签数据
            let bookmarks = [];
            
            // 首先尝试从POOL获取
            if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    bookmarks = POOL.__GET__("KERNEL_GLOBAL_POOL", "BROWSER_BOOKMARKS") || [];
                } catch (e) {
                    // 忽略错误，继续尝试其他方式
                }
            }
            
            // 如果POOL中没有，尝试从全局对象获取
            if (bookmarks.length === 0) {
                if (typeof window !== 'undefined' && window.BROWSER_BOOKMARKS) {
                    bookmarks = window.BROWSER_BOOKMARKS;
                } else if (typeof globalThis !== 'undefined' && globalThis.BROWSER_BOOKMARKS) {
                    bookmarks = globalThis.BROWSER_BOOKMARKS;
                }
            }
            
            // 如果没有书签，使用默认书签
            if (!bookmarks || bookmarks.length === 0) {
                bookmarks = [
                    { name: "必应", url: "https://www.bing.com" },
                    { name: "GitHub", url: "https://github.com" }
                ];
            }
            
            // 创建书签项
            bookmarks.forEach((bookmark, index) => {
                if (!bookmark || !bookmark.name || !bookmark.url) return;
                
                const item = document.createElement('button');
                item.className = 'browser-bookmark-item';
                item.textContent = bookmark.name;
                item.title = bookmark.url;
                item.addEventListener('click', () => {
                    this._navigateTo(bookmark.url);
                });
                
                // 添加动画延迟
                item.style.animationDelay = `${index * 0.05}s`;
                
                container.appendChild(item);
            });
        },
        
        /**
         * 创建内容区域（iframe）
         */
        _createContent: function() {
            const content = document.createElement('div');
            content.className = 'browser-content';
            
            const iframe = document.createElement('iframe');
            iframe.className = 'browser-iframe';
            iframe.frameBorder = '0';
            iframe.allow = 'fullscreen';
            iframe.style.cssText = `
                width: 100%;
                height: 100%;
                border: none;
                background: #ffffff;
            `;
            
            this.iframe = iframe;
            content.appendChild(iframe);
            
            // 加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'browser-loading-indicator';
            loadingIndicator.innerHTML = `
                <div class="browser-loading-spinner"></div>
                <div class="browser-loading-text">正在加载...</div>
            `;
            content.appendChild(loadingIndicator);
            
            // 监听iframe加载状态
            iframe.addEventListener('load', () => {
                loadingIndicator.style.display = 'none';
            });
            
            iframe.addEventListener('loadstart', () => {
                loadingIndicator.style.display = 'flex';
            });
            
            return content;
        },
        
        /**
         * 程序退出
         */
        __exit__: function() {
            // 清理定时器
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            
            // 注销窗口
            if (typeof GUIManager !== 'undefined') {
                GUIManager.unregisterWindow(this.pid);
            }
            
            // 清理 DOM
            if (this.window && this.window.parentElement) {
                this.window.parentElement.removeChild(this.window);
            }
            
            // 清理引用
            this.window = null;
            this.iframe = null;
            this.addressBar = null;
            this.bookmarksBar = null;
        },
        
        /**
         * 程序信息
         */
        __info__: function() {
            return {
                name: 'browser',
                pid: this.pid,
                status: this.window ? 'running' : 'exited',
                currentUrl: this.currentUrl
            };
        }
    };
    
    // 导出到全局
    if (typeof window !== 'undefined') {
        window.BROWSER = BROWSER;
    } else if (typeof globalThis !== 'undefined') {
        globalThis.BROWSER = BROWSER;
    }
    
})(typeof window !== 'undefined' ? window : globalThis);

