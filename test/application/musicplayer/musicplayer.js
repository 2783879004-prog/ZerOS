// ZerOS 音乐播放器
// 高仿网易云音乐风格的在线音乐播放器
// 注意：此程序必须禁止自动初始化，通过 ProcessManager 管理

(function(window) {
    'use strict';
    
    const MUSICPLAYER = {
        pid: null,
        window: null,
        
        // 内存管理引用
        _heap: null,
        _shed: null,
        
        // 播放器状态
        _audio: null,
        _currentSong: null,
        _playlist: [],
        _currentIndex: -1,
        _isPlaying: false,
        _isLoading: false, // 是否正在加载音频
        _volume: 0.7,
        _lyrics: null,
        _currentLyricIndex: -1,
        _playMode: 'list', // 播放模式: 'list'(列表循环), 'single'(单曲循环), 'random'(随机播放)
        _networkManager: null, // NetworkManager 实例
        
        // UI元素引用
        _leftSidebar: null,
        _mainContent: null,
        _playerBar: null,
        _searchInput: null,
        _searchResults: null,
        _playlistView: null,
        _lyricsView: null,
        _immersiveView: null,  // 沉浸式播放页面
        _isImmersiveMode: false,  // 是否处于沉浸式模式
        _desktopComponentId: null,  // 桌面组件ID
        _desktopComponent: null,  // 桌面组件元素引用
        _windowSize: { width: 0, height: 0 },  // 窗口大小
        _useNotification: false,  // 是否使用通知依赖（false=桌面组件，true=通知依赖）
        _notificationId: null,  // 通知ID（如果使用通知依赖）
        
        // API基础URL
        API_BASE: 'https://kw-api.cenguigui.cn',
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 初始化内存管理
            this._initMemory(pid);
            
            // 获取 NetworkManager 实例
            this._initNetworkManager();
            
            // 初始化音频播放器
            this._initAudio();
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建主窗口
            this.window = document.createElement('div');
            this.window.className = 'musicplayer-window';
            this.window.dataset.pid = pid.toString();
            this.window.style.cssText = `
                width: 1200px;
                height: 800px;
                min-width: 400px;
                min-height: 300px;
                max-width: 100vw;
                max-height: 100vh;
            `;
            
            // 使用GUIManager注册窗口
            if (typeof GUIManager !== 'undefined') {
                // 获取程序图标
                let icon = null;
                if (typeof ApplicationAssetManager !== 'undefined') {
                    icon = ApplicationAssetManager.getIcon('musicplayer');
                }
                
                GUIManager.registerWindow(pid, this.window, {
                    title: '音乐播放器',
                    icon: icon,
                    onClose: () => {
                        this._cleanup();
                        if (typeof ProcessManager !== 'undefined') {
                            ProcessManager.killProgram(this.pid);
                        }
                    },
                    onMinimize: () => {
                        // 最小化回调
                    },
                    onMaximize: (isMaximized) => {
                        // 最大化/还原回调
                        if (isMaximized) {
                            // 最大化时，调整窗口样式以实现沉浸式体验
                            this.window.style.borderRadius = '0';
                            this.window.style.border = 'none';
                        } else {
                            // 还原时，恢复窗口样式
                            this.window.style.borderRadius = '';
                            this.window.style.border = '';
                        }
                    }
                });
            }
            
            // 创建主内容
            const content = this._createContent();
            this.window.appendChild(content);
            
            // 添加到容器
            guiContainer.appendChild(this.window);
            
            // 加载用户设置
            await this._loadSettings();
            
            // 根据设置创建桌面组件或通知依赖
            if (this._useNotification) {
                this._createNotificationDependent();
            } else {
                this._createDesktopComponent();
            }
            
            // 监听窗口大小变化
            this._setupWindowSizeListener();
            
            // 加载默认内容（热门搜索）
            this._loadHotSearches();
        },
        
        _initMemory: function(pid) {
            if (typeof MemoryManager !== 'undefined') {
                try {
                    if (typeof MemoryUtils !== 'undefined' && typeof MemoryUtils.getAppMemory === 'function') {
                        const memory = MemoryUtils.getAppMemory(pid);
                        if (memory) {
                            this._heap = memory.heap;
                            this._shed = memory.shed;
                        }
                    } else {
                        const appSpace = MemoryManager.APPLICATION_SOP.get(pid);
                        if (appSpace) {
                            this._heap = appSpace.heaps.get(1) || null;
                            this._shed = appSpace.sheds.get(1) || null;
                        }
                    }
                } catch (e) {
                    console.warn('[MusicPlayer] 内存初始化失败:', e);
                }
            }
        },
        
        _initNetworkManager: function() {
            // 获取 NetworkManager 实例
            if (typeof NetworkManager !== 'undefined') {
                this._networkManager = NetworkManager;
            } else if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    this._networkManager = POOL.__GET__('KERNEL_GLOBAL_POOL', 'NetworkManager');
                } catch (e) {
                    console.warn('[MusicPlayer] 从 POOL 获取 NetworkManager 失败:', e);
                }
            }
            
            if (!this._networkManager) {
                console.warn('[MusicPlayer] NetworkManager 不可用，将使用原生 fetch');
            }
        },
        
        _fetch: function(url, options = {}) {
            // 如果 NetworkManager 可用，使用它的 fetch 方法
            if (this._networkManager && typeof this._networkManager.fetch === 'function') {
                return this._networkManager.fetch(url, options);
            }
            // 否则使用原生 fetch
            return fetch(url, options);
        },
        
        _initAudio: function() {
            this._audio = new Audio();
            this._audio.volume = this._volume;
            
            // 播放事件
            this._audio.addEventListener('play', () => {
                this._isPlaying = true;
                this._updatePlayButton();
                // 更新通知中的播放状态
                if (this._useNotification) {
                    this._updateNotificationDependent();
                }
            });
            
            // 暂停事件
            this._audio.addEventListener('pause', () => {
                this._isPlaying = false;
                this._updatePlayButton();
                // 更新通知中的播放状态
                if (this._useNotification) {
                    this._updateNotificationDependent();
                }
            });
            
            // 时间更新
            this._audio.addEventListener('timeupdate', () => {
                this._updateProgress();
                this._updateLyrics();
            });
            
            // 加载完成
            this._audio.addEventListener('loadedmetadata', () => {
                this._updateDuration();
            });
            
            // 播放结束
            this._audio.addEventListener('ended', () => {
                if (this._playMode === 'single') {
                    // 单曲循环：重新播放当前歌曲
                    this._audio.currentTime = 0;
                    this._audio.play();
                } else {
                    // 其他模式：播放下一首
                    this._playNext();
                }
            });
            
            // 错误处理
            this._audio.addEventListener('error', (e) => {
                console.error('[MusicPlayer] 播放错误:', e);
                this._showMessage('播放失败，请稍后重试');
            });
        },
        
        _createContent: function() {
            const container = document.createElement('div');
            container.className = 'musicplayer-container';
            container.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                background: #1e1e1e;
                color: #e0e0e0;
                overflow: hidden;
            `;
            
            // 顶部搜索栏
            const topBar = this._createTopBar();
            container.appendChild(topBar);
            
            // 主体区域
            const body = document.createElement('div');
            body.className = 'musicplayer-body';
            body.style.cssText = `
                flex: 1;
                display: flex;
                overflow: hidden;
            `;
            
            // 左侧边栏
            this._leftSidebar = this._createLeftSidebar();
            body.appendChild(this._leftSidebar);
            
            // 主内容区（必须在侧边栏之后创建，因为侧边栏的点击事件需要访问这些元素）
            this._mainContent = this._createMainContent();
            body.appendChild(this._mainContent);
            
            container.appendChild(body);
            
            // 底部播放栏
            this._playerBar = this._createPlayerBar();
            container.appendChild(this._playerBar);
            
            // 创建沉浸式播放页面（初始隐藏）
            this._immersiveView = this._createImmersiveView();
            container.appendChild(this._immersiveView);
            
            // 在创建完所有元素后，默认选中"发现音乐"
            if (this._leftSidebar) {
                const discoverItem = this._leftSidebar.querySelector('[data-id="discover"]');
                if (discoverItem) {
                    discoverItem.click();
                }
            }
            
            return container;
        },
        
        _createTopBar: function() {
            const topBar = document.createElement('div');
            topBar.className = 'musicplayer-topbar';
            topBar.style.cssText = `
                height: 60px;
                background: #252525;
                border-bottom: 1px solid #333;
                display: flex;
                align-items: center;
                padding: 0 20px;
                gap: 20px;
            `;
            
            // 搜索框
            const searchContainer = document.createElement('div');
            searchContainer.style.cssText = `
                flex: 1;
                max-width: 500px;
                position: relative;
            `;
            
            this._searchInput = document.createElement('input');
            this._searchInput.type = 'text';
            this._searchInput.placeholder = '搜索歌曲、歌手、专辑...';
            this._searchInput.className = 'musicplayer-search-input';
            this._searchInput.style.cssText = `
                width: 100%;
                height: 36px;
                padding: 0 40px 0 15px;
                background: rgba(42, 42, 42, 0.8);
                border: 1px solid rgba(58, 58, 58, 0.6);
                border-radius: 18px;
                color: #e0e0e0;
                font-size: 14px;
                outline: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
            `;
            
            // 添加焦点动画
            this._searchInput.addEventListener('focus', () => {
                this._searchInput.style.background = 'rgba(58, 58, 58, 0.9)';
                this._searchInput.style.borderColor = '#ec4141';
                this._searchInput.style.boxShadow = '0 0 0 3px rgba(236, 65, 65, 0.2)';
                searchIcon.style.transform = 'translateY(-50%) scale(1.1)';
            });
            
            this._searchInput.addEventListener('blur', () => {
                this._searchInput.style.background = 'rgba(42, 42, 42, 0.8)';
                this._searchInput.style.borderColor = 'rgba(58, 58, 58, 0.6)';
                this._searchInput.style.boxShadow = 'none';
                searchIcon.style.transform = 'translateY(-50%) scale(1)';
            });
            
            this._searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._performSearch();
                }
            });
            
            const searchIcon = document.createElement('div');
            searchIcon.innerHTML = '🔍';
            searchIcon.className = 'musicplayer-search-icon';
            searchIcon.style.cssText = `
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                filter: brightness(0.8);
            `;
            searchIcon.addEventListener('mouseenter', () => {
                searchIcon.style.transform = 'translateY(-50%) scale(1.2)';
                searchIcon.style.filter = 'brightness(1.2)';
            });
            searchIcon.addEventListener('mouseleave', () => {
                if (document.activeElement !== this._searchInput) {
                    searchIcon.style.transform = 'translateY(-50%) scale(1)';
                    searchIcon.style.filter = 'brightness(0.8)';
                }
            });
            searchIcon.addEventListener('click', () => this._performSearch());
            
            searchContainer.appendChild(this._searchInput);
            searchContainer.appendChild(searchIcon);
            topBar.appendChild(searchContainer);
            
            return topBar;
        },
        
        _createLeftSidebar: function() {
            const sidebar = document.createElement('div');
            sidebar.className = 'musicplayer-sidebar';
            sidebar.style.cssText = `
                width: 200px;
                background: #1a1a1a;
                border-right: 1px solid #333;
                display: flex;
                flex-direction: column;
                padding: 20px 0;
            `;
            
            const menuItems = [
                { id: 'discover', label: '发现音乐', icon: '🎵' },
                { id: 'playlist', label: '推荐歌单', icon: '📋' },
                { id: 'rank', label: '排行榜', icon: '🏆' },
                { id: 'artist', label: '歌手', icon: '👤' },
                { id: 'daily', label: '每日推荐', icon: '⭐' },
                { id: 'myplaylist', label: '我的播放列表', icon: '🎶' }
            ];
            
            menuItems.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'sidebar-menu-item';
                menuItem.dataset.id = item.id;
                menuItem.style.cssText = `
                    padding: 12px 20px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    transition: background 0.2s;
                `;
                menuItem.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
                
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.background = '#252525';
                });
                menuItem.addEventListener('mouseleave', () => {
                    if (!menuItem.classList.contains('active')) {
                        menuItem.style.background = 'transparent';
                    }
                });
                
                menuItem.addEventListener('click', () => {
                    document.querySelectorAll('.sidebar-menu-item').forEach(mi => {
                        mi.classList.remove('active');
                        mi.style.background = 'transparent';
                    });
                    menuItem.classList.add('active');
                    menuItem.style.background = '#2a2a2a';
                    this._handleMenuClick(item.id);
                });
                
                sidebar.appendChild(menuItem);
            });
            
            // 添加分隔线
            const divider = document.createElement('div');
            divider.style.cssText = `
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
                margin: 10px 20px;
            `;
            sidebar.appendChild(divider);
            
            // 添加设置项
            const settingsItem = document.createElement('div');
            settingsItem.className = 'sidebar-menu-item';
            settingsItem.dataset.id = 'settings';
            settingsItem.style.cssText = `
                padding: 12px 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                transition: background 0.2s;
                margin-top: auto;
            `;
            settingsItem.innerHTML = `<span>⚙️</span><span>设置</span>`;
            
            settingsItem.addEventListener('mouseenter', () => {
                settingsItem.style.background = '#252525';
            });
            settingsItem.addEventListener('mouseleave', () => {
                if (!settingsItem.classList.contains('active')) {
                    settingsItem.style.background = 'transparent';
                }
            });
            
            settingsItem.addEventListener('click', () => {
                this._showSettings();
            });
            
            sidebar.appendChild(settingsItem);
            
            // 注意：不要在这里触发点击事件，因为 _searchResults 和 _defaultContent 可能还未创建
            // 点击事件将在 _createContent 方法的最后触发
            
            return sidebar;
        },
        
        _createMainContent: function() {
            const content = document.createElement('div');
            content.className = 'musicplayer-main';
            content.style.cssText = `
                flex: 1;
                overflow-y: auto;
                background: #1e1e1e;
                padding: 20px;
            `;
            
            // 搜索结果显示区域
            this._searchResults = document.createElement('div');
            this._searchResults.className = 'search-results';
            this._searchResults.style.display = 'none';
            content.appendChild(this._searchResults);
            
            // 默认内容区域
            this._defaultContent = document.createElement('div');
            this._defaultContent.className = 'default-content';
            content.appendChild(this._defaultContent);
            
            return content;
        },
        
        _createPlayerBar: function() {
            const playerBar = document.createElement('div');
            playerBar.className = 'musicplayer-playerbar';
            playerBar.style.cssText = `
                height: 80px;
                background: #252525;
                border-top: 1px solid #333;
                display: flex;
                align-items: center;
                padding: 0 20px;
                gap: 20px;
            `;
            
            // 专辑封面
            const cover = document.createElement('div');
            cover.className = 'player-cover';
            cover.style.cssText = `
                width: 60px;
                height: 60px;
                background: #2a2a2a;
                border-radius: 4px;
                overflow: hidden;
                flex-shrink: 0;
            `;
            cover.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🎵</div>';
            playerBar.appendChild(cover);
            this._playerCover = cover;
            
            // 歌曲信息
            const songInfo = document.createElement('div');
            songInfo.className = 'player-info';
            songInfo.style.cssText = `
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 5px;
            `;
            
            const songName = document.createElement('div');
            songName.className = 'player-song-name';
            songName.textContent = '未播放';
            songName.style.cssText = `
                font-size: 14px;
                font-weight: 500;
                color: #e0e0e0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            
            const artistName = document.createElement('div');
            artistName.className = 'player-artist-name';
            artistName.textContent = '--';
            artistName.style.cssText = `
                font-size: 12px;
                color: #999;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            
            songInfo.appendChild(songName);
            songInfo.appendChild(artistName);
            playerBar.appendChild(songInfo);
            this._playerSongName = songName;
            this._playerArtistName = artistName;
            
            // 播放控制
            const controls = document.createElement('div');
            controls.className = 'player-controls';
            controls.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                flex: 1;
            `;
            
            // 控制按钮
            const controlButtons = document.createElement('div');
            controlButtons.style.cssText = `
                display: flex;
                align-items: center;
                gap: 15px;
            `;
            
            const prevBtn = this._createButton('⏮', () => this._playPrev());
            const playBtn = this._createButton('▶', () => this._togglePlay());
            playBtn.className = 'play-button';
            const nextBtn = this._createButton('⏭', () => this._playNext());
            
            // 播放模式切换按钮
            const modeBtn = this._createButton('🔁', () => this._togglePlayMode());
            modeBtn.className = 'play-mode-button';
            modeBtn.title = '列表循环';
            this._playModeButton = modeBtn;
            
            controlButtons.appendChild(prevBtn);
            controlButtons.appendChild(playBtn);
            controlButtons.appendChild(nextBtn);
            controlButtons.appendChild(modeBtn);
            this._playButton = playBtn;
            
            // 进度条
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                width: 100%;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            
            const timeCurrent = document.createElement('div');
            timeCurrent.className = 'time-current';
            timeCurrent.textContent = '00:00';
            timeCurrent.style.cssText = `
                font-size: 12px;
                color: #999;
                min-width: 40px;
            `;
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.cssText = `
                flex: 1;
                height: 4px;
                background: #3a3a3a;
                border-radius: 2px;
                cursor: pointer;
                position: relative;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.cssText = `
                height: 100%;
                background: #ec4141;
                border-radius: 2px;
                width: 0%;
                transition: width 0.1s;
            `;
            progressBar.appendChild(progressFill);
            this._progressFill = progressFill;
            
            progressBar.addEventListener('click', (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this._seekTo(percent);
            });
            
            const timeTotal = document.createElement('div');
            timeTotal.className = 'time-total';
            timeTotal.textContent = '00:00';
            timeTotal.style.cssText = `
                font-size: 12px;
                color: #999;
                min-width: 40px;
            `;
            this._timeCurrent = timeCurrent;
            this._timeTotal = timeTotal;
            
            progressContainer.appendChild(timeCurrent);
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(timeTotal);
            
            // 音量控制
            const volumeContainer = document.createElement('div');
            volumeContainer.className = 'volume-container';
            volumeContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 120px;
            `;
            
            const volumeIcon = this._createButton('🔊', () => {
                if (this._volume > 0) {
                    this._setVolume(0);
                } else {
                    this._setVolume(0.7);
                }
            });
            volumeIcon.style.cssText = `
                width: 32px;
                height: 32px;
                font-size: 16px;
                background: transparent;
                border: none;
                color: #999;
                cursor: pointer;
                padding: 0;
            `;
            this._volumeIcon = volumeIcon;
            
            const volumeBar = document.createElement('div');
            volumeBar.className = 'volume-bar';
            volumeBar.style.cssText = `
                flex: 1;
                height: 4px;
                background: #3a3a3a;
                border-radius: 2px;
                cursor: pointer;
                position: relative;
            `;
            
            const volumeFill = document.createElement('div');
            volumeFill.className = 'volume-fill';
            volumeFill.style.cssText = `
                height: 100%;
                background: #ec4141;
                border-radius: 2px;
                width: ${this._volume * 100}%;
                transition: width 0.1s;
            `;
            volumeBar.appendChild(volumeFill);
            this._volumeFill = volumeFill;
            
            volumeBar.addEventListener('click', (e) => {
                const rect = volumeBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this._setVolume(percent);
            });
            
            volumeContainer.appendChild(volumeIcon);
            volumeContainer.appendChild(volumeBar);
            
            controls.appendChild(controlButtons);
            controls.appendChild(progressContainer);
            playerBar.appendChild(controls);
            playerBar.appendChild(volumeContainer);
            
            // 为播放栏添加点击事件，展开沉浸式播放页面
            playerBar.addEventListener('click', (e) => {
                // 如果点击的不是控制按钮，则展开沉浸式页面
                if (!e.target.closest('.player-controls') && !e.target.closest('.player-volume')) {
                    this._toggleImmersiveView();
                }
            });
            playerBar.style.cursor = 'pointer';
            
            return playerBar;
        },
        
        _createImmersiveView: function() {
            const immersiveView = document.createElement('div');
            immersiveView.className = 'immersive-player-view';
            immersiveView.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 30%, #2d1b3d 60%, #1a1a2e 100%);
                display: none;
                flex-direction: column;
                z-index: 1;
                overflow: hidden;
                pointer-events: none;
            `;
            
            // 背景装饰
            const bgPattern = document.createElement('div');
            bgPattern.className = 'immersive-bg-pattern';
            bgPattern.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: 
                    radial-gradient(circle at 20% 50%, rgba(236, 65, 65, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                    linear-gradient(0deg, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
                pointer-events: none;
                z-index: 0;
            `;
            immersiveView.appendChild(bgPattern);
            
            // 关闭按钮
            const closeBtn = document.createElement('div');
            closeBtn.className = 'immersive-close-btn';
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(10px);
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                color: #e0e0e0;
                z-index: 10;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(236, 65, 65, 0.3)';
                closeBtn.style.transform = 'scale(1.1) rotate(90deg)';
                closeBtn.style.borderColor = 'rgba(236, 65, 65, 0.5)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(0, 0, 0, 0.4)';
                closeBtn.style.transform = 'scale(1) rotate(0deg)';
                closeBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            });
            closeBtn.addEventListener('click', () => {
                this._toggleImmersiveView();
            });
            immersiveView.appendChild(closeBtn);
            
            // 主要内容区域
            const content = document.createElement('div');
            content.className = 'immersive-content';
            content.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 40px 40px 40px;
                overflow: hidden;
                min-height: 0;
                gap: 40px;
                pointer-events: none;
                position: relative;
                z-index: 1;
            `;
            
            // 左侧区域：封面和歌曲信息
            const leftSection = document.createElement('div');
            leftSection.className = 'immersive-left-section';
            leftSection.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 30px;
                flex: 0 0 auto;
                max-width: 500px;
            `;
            
            // 专辑封面（磁盘层叠样式）
            const coverStack = document.createElement('div');
            coverStack.className = 'immersive-cover-stack';
            coverStack.style.cssText = `
                position: relative;
                width: 500px;
                height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            // 底层磁盘（不旋转）
            const coverLayer1 = document.createElement('div');
            coverLayer1.className = 'immersive-cover-layer';
            coverLayer1.style.cssText = `
                position: absolute;
                width: 450px;
                height: 450px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.6),
                    inset 0 0 30px rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 100px;
                transform: translate(15px, 15px);
                z-index: 1;
            `;
            coverLayer1.innerHTML = '<div>🎵</div>';
            
            // 中层磁盘（不旋转）
            const coverLayer2 = document.createElement('div');
            coverLayer2.className = 'immersive-cover-layer';
            coverLayer2.style.cssText = `
                position: absolute;
                width: 480px;
                height: 480px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
                box-shadow: 
                    0 25px 70px rgba(0, 0, 0, 0.7),
                    inset 0 0 35px rgba(0, 0, 0, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 110px;
                transform: translate(10px, 10px);
                z-index: 2;
            `;
            coverLayer2.innerHTML = '<div>🎵</div>';
            
            // 顶层磁盘（旋转）
            const coverLayer3 = document.createElement('div');
            coverLayer3.className = 'immersive-cover-layer immersive-cover-top';
            coverLayer3.style.cssText = `
                position: absolute;
                width: 500px;
                height: 500px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                box-shadow: 
                    0 30px 80px rgba(0, 0, 0, 0.8),
                    0 0 60px rgba(236, 65, 65, 0.2),
                    inset 0 0 40px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 120px;
                z-index: 3;
                overflow: hidden;
            `;
            coverLayer3.innerHTML = '<div>🎵</div>';
            this._immersiveCover = coverLayer3;
            
            coverStack.appendChild(coverLayer1);
            coverStack.appendChild(coverLayer2);
            coverStack.appendChild(coverLayer3);
            this._immersiveCoverStack = coverStack;
            leftSection.appendChild(coverStack);
            
            // 歌曲信息
            const songInfo = document.createElement('div');
            songInfo.className = 'immersive-song-info';
            songInfo.style.cssText = `
                text-align: center;
                color: #e0e0e0;
                width: 100%;
            `;
            
            const songName = document.createElement('div');
            songName.className = 'immersive-song-name';
            songName.textContent = '未播放';
            this._immersiveSongName = songName;
            
            const artistName = document.createElement('div');
            artistName.className = 'immersive-artist-name';
            artistName.textContent = '--';
            this._immersiveArtistName = artistName;
            
            // 当前播放歌曲高亮显示
            const currentSongDisplay = document.createElement('div');
            currentSongDisplay.className = 'immersive-current-song';
            currentSongDisplay.style.cssText = `
                margin-top: 20px;
                padding: 12px 20px;
                background: rgba(236, 65, 65, 0.15);
                border-radius: 12px;
                border: 1px solid rgba(236, 65, 65, 0.3);
                font-size: 14px;
                color: #ec4141;
                font-weight: 500;
            `;
            this._immersiveCurrentSong = currentSongDisplay;
            
            songInfo.appendChild(songName);
            songInfo.appendChild(artistName);
            songInfo.appendChild(currentSongDisplay);
            leftSection.appendChild(songInfo);
            
            // 右侧区域：歌词和词曲信息
            const rightSection = document.createElement('div');
            rightSection.className = 'immersive-right-section';
            rightSection.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 30px;
                max-width: 600px;
                min-width: 400px;
            `;
            
            // 歌词显示区域
            const lyricsContainer = document.createElement('div');
            lyricsContainer.className = 'immersive-lyrics';
            lyricsContainer.style.cssText = `
                flex: 1;
                width: 100%;
                min-height: 300px;
                max-height: 500px;
                overflow-y: auto;
                text-align: center;
                padding: 30px 20px;
                color: #e0e0e0;
                font-size: 18px;
                line-height: 2.8;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                pointer-events: auto;
                background: rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            this._immersiveLyrics = lyricsContainer;
            rightSection.appendChild(lyricsContainer);
            
            // 词曲作者信息
            const creditsInfo = document.createElement('div');
            creditsInfo.className = 'immersive-credits';
            creditsInfo.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 20px;
                background: rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
                pointer-events: auto;
            `;
            this._immersiveCredits = creditsInfo;
            rightSection.appendChild(creditsInfo);
            
            // 水平布局：左右分栏
            const mainLayout = document.createElement('div');
            mainLayout.className = 'immersive-main-layout';
            mainLayout.style.cssText = `
                display: flex;
                flex-direction: row;
                align-items: flex-start;
                justify-content: center;
                gap: 60px;
                width: 100%;
                max-width: 1400px;
                flex: 1;
                min-height: 0;
            `;
            mainLayout.appendChild(leftSection);
            mainLayout.appendChild(rightSection);
            content.appendChild(mainLayout);
            
            // 播放控制（底部固定）
            const controls = document.createElement('div');
            controls.className = 'immersive-controls';
            controls.style.cssText = `
                width: 100%;
                max-width: 1200px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                padding: 30px 0;
                flex-shrink: 0;
                pointer-events: auto;
            `;
            
            // 进度条
            const progressContainer = document.createElement('div');
            progressContainer.className = 'immersive-progress-container';
            progressContainer.style.cssText = `
                width: 100%;
                display: flex;
                align-items: center;
                gap: 20px;
            `;
            
            const timeCurrent = document.createElement('div');
            timeCurrent.className = 'immersive-time';
            timeCurrent.textContent = '00:00';
            this._immersiveTimeCurrent = timeCurrent;
            
            const progressBar = document.createElement('div');
            progressBar.className = 'immersive-progress-bar';
            progressBar.style.cssText = `
                flex: 1;
                height: 6px;
                background: rgba(255, 255, 255, 0.15);
                border-radius: 3px;
                cursor: pointer;
                position: relative;
                pointer-events: auto;
            `;
            
            const progressFill = document.createElement('div');
            progressFill.className = 'immersive-progress-fill';
            progressFill.style.cssText = `
                height: 100%;
                background: linear-gradient(90deg, #ec4141 0%, #ff6b6b 100%);
                border-radius: 3px;
                width: 0%;
                transition: width 0.1s;
                position: relative;
            `;
            progressBar.appendChild(progressFill);
            this._immersiveProgressFill = progressFill;
            
            progressBar.addEventListener('click', (e) => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this._seekTo(percent);
            });
            
            const timeTotal = document.createElement('div');
            timeTotal.className = 'immersive-time';
            timeTotal.textContent = '00:00';
            this._immersiveTimeTotal = timeTotal;
            
            progressContainer.appendChild(timeCurrent);
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(timeTotal);
            
            // 控制按钮
            const controlButtons = document.createElement('div');
            controlButtons.className = 'immersive-control-buttons';
            controlButtons.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 40px;
            `;
            
            const prevBtn = this._createImmersiveButton('⏮', () => this._playPrev());
            prevBtn.style.cssText += `font-size: 22px !important;`;
            const playBtn = this._createImmersiveButton('▶', () => this._togglePlay());
            playBtn.className = 'immersive-play-button';
            playBtn.style.cssText += `
                width: 72px !important;
                height: 72px !important;
                font-size: 32px !important;
            `;
            this._immersivePlayButton = playBtn;
            const nextBtn = this._createImmersiveButton('⏭', () => this._playNext());
            nextBtn.style.cssText += `font-size: 22px !important;`;
            
            controlButtons.appendChild(prevBtn);
            controlButtons.appendChild(playBtn);
            controlButtons.appendChild(nextBtn);
            
            controls.appendChild(progressContainer);
            controls.appendChild(controlButtons);
            content.appendChild(controls);
            
            immersiveView.appendChild(content);
            
            return immersiveView;
        },
        
        _createImmersiveButton: function(text, onClick) {
            const btn = document.createElement('div');
            btn.textContent = text;
            btn.style.cssText = `
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 50%;
                font-size: 24px;
                background: rgba(255, 255, 255, 0.1);
                color: #e0e0e0;
                transition: all 0.2s;
                pointer-events: auto;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.2)';
                btn.style.transform = 'scale(1.1)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.transform = 'scale(1)';
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
            });
            return btn;
        },
        
        _toggleImmersiveView: function() {
            if (!this._immersiveView) return;
            
            this._isImmersiveMode = !this._isImmersiveMode;
            
            if (this._isImmersiveMode) {
                this._immersiveView.style.display = 'flex';
                // 更新窗口大小（确保布局正确）
                this._updateWindowSize();
                // 更新沉浸式页面的内容
                this._updateImmersiveView();
            } else {
                this._immersiveView.style.display = 'none';
            }
        },
        
        _updateImmersiveView: function() {
            if (!this._currentSong) return;
            
            // 更新歌曲信息
            if (this._immersiveSongName) {
                this._immersiveSongName.textContent = this._currentSong.name || '未播放';
            }
            if (this._immersiveArtistName) {
                this._immersiveArtistName.textContent = this._currentSong.artist || '--';
            }
            
            // 更新当前播放歌曲显示
            if (this._immersiveCurrentSong) {
                const songText = `${this._currentSong.name || '未播放'} - ${this._currentSong.artist || '--'}`;
                this._immersiveCurrentSong.textContent = songText;
            }
            
            // 更新封面（所有层）
            if (this._immersiveCoverStack) {
                const layers = this._immersiveCoverStack.querySelectorAll('.immersive-cover-layer');
                const coverImg = this._currentSong.pic;
                
                layers.forEach((layer, index) => {
                    if (coverImg) {
                        layer.innerHTML = `<img src="${coverImg}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    } else {
                        const emojiSize = index === 0 ? '100px' : (index === 1 ? '110px' : '120px');
                        layer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:${emojiSize};">🎵</div>`;
                    }
                });
                
                // 如果正在播放，顶层添加旋转动画
                if (this._immersiveCover) {
                    if (this._isPlaying) {
                        this._immersiveCover.classList.add('playing');
                    } else {
                        this._immersiveCover.classList.remove('playing');
                    }
                }
            }
            
            // 更新歌词
            this._updateImmersiveLyrics();
            
            // 更新词曲作者信息
            this._updateImmersiveCredits();
            
            // 更新播放按钮
            if (this._immersivePlayButton) {
                this._immersivePlayButton.textContent = this._isPlaying ? '⏸' : '▶';
            }
        },
        
        _updateImmersiveCredits: function() {
            if (!this._immersiveCredits || !this._currentSong) return;
            
            // 从歌词数据中提取词曲作者信息
            let lyricist = '未知';
            let composer = '未知';
            
            if (this._lyrics && this._lyrics.length > 0) {
                // 查找包含词曲信息的歌词行
                for (const lyric of this._lyrics) {
                    const text = lyric.text || '';
                    if (text.includes('词:')) {
                        const match = text.match(/词[：:]\s*([^曲]+)/);
                        if (match) {
                            lyricist = match[1].trim();
                        }
                    }
                    if (text.includes('曲:')) {
                        const match = text.match(/曲[：:]\s*(.+)/);
                        if (match) {
                            composer = match[1].trim();
                        }
                    }
                }
            }
            
            // 如果歌词中没有找到，尝试从歌曲数据中获取
            if (lyricist === '未知' && this._currentSong.lyricist) {
                lyricist = this._currentSong.lyricist;
            }
            if (composer === '未知' && this._currentSong.composer) {
                composer = this._currentSong.composer;
            }
            
            const creditsHTML = `
                <div style="color: rgba(255, 255, 255, 0.9); margin-bottom: 4px; font-weight: 500;">词: ${lyricist}</div>
                <div style="color: rgba(255, 255, 255, 0.7);">曲: ${composer}</div>
            `;
            
            this._immersiveCredits.innerHTML = creditsHTML;
        },
        
        _updateImmersiveLyrics: function() {
            if (!this._immersiveLyrics) return;
            
            if (!this._lyrics || this._lyrics.length === 0) {
                this._immersiveLyrics.innerHTML = '<div style="color: rgba(255, 255, 255, 0.5); padding: 60px 20px; font-size: 16px;">暂无歌词</div>';
                return;
            }
            
            // 过滤掉词曲信息行（通常包含"词:"或"曲:"）
            const filteredLyrics = this._lyrics.filter(lyric => {
                const text = lyric.text || '';
                return !text.includes('词:') && !text.includes('曲:') && text.trim().length > 0;
            });
            
            // 显示所有歌词，高亮当前行
            const lyricsHTML = filteredLyrics.map((lyric, index) => {
                // 找到原始索引
                const originalIndex = this._lyrics.indexOf(lyric);
                const isActive = originalIndex === this._currentLyricIndex;
                return `
                    <div class="lyric-line ${isActive ? 'active' : ''}" data-index="${originalIndex}" style="
                        margin: 12px 0;
                        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        color: ${isActive ? '#ec4141' : 'rgba(255, 255, 255, 0.6)'};
                        font-size: ${isActive ? '24px' : '18px'};
                        font-weight: ${isActive ? '600' : '400'};
                        opacity: ${isActive ? '1' : '0.6'};
                        transform: ${isActive ? 'scale(1.05)' : 'scale(1)'};
                    ">${lyric.text || ''}</div>
                `;
            }).join('');
            
            this._immersiveLyrics.innerHTML = lyricsHTML;
            
            // 滚动到当前歌词（延迟执行，确保DOM已更新）
            if (this._currentLyricIndex >= 0) {
                setTimeout(() => {
                    const activeLine = this._immersiveLyrics.querySelector(`.lyric-line[data-index="${this._currentLyricIndex}"]`);
                    if (activeLine) {
                        // 计算滚动位置，使当前歌词居中显示
                        const container = this._immersiveLyrics;
                        const containerHeight = container.clientHeight;
                        const lineHeight = activeLine.offsetHeight;
                        const lineTop = activeLine.offsetTop;
                        const scrollTop = lineTop - (containerHeight / 2) + (lineHeight / 2);
                        
                        container.scrollTo({
                            top: Math.max(0, scrollTop),
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
        },
        
        _createButton: function(text, onClick) {
            const btn = document.createElement('div');
            btn.textContent = text;
            btn.className = 'musicplayer-control-btn';
            btn.style.cssText = `
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 50%;
                font-size: 18px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                background: rgba(58, 58, 58, 0.3);
                color: #e0e0e0;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(236, 65, 65, 0.3)';
                btn.style.transform = 'scale(1.1)';
                btn.style.color = '#ec4141';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(58, 58, 58, 0.3)';
                btn.style.transform = 'scale(1)';
                btn.style.color = '#e0e0e0';
            });
            btn.addEventListener('click', (e) => {
                btn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                }, 100);
                onClick(e);
            });
            return btn;
        },
        
        _handleMenuClick: function(menuId) {
            // 确保元素已创建
            if (!this._searchResults || !this._defaultContent) {
                console.warn('[MusicPlayer] _searchResults 或 _defaultContent 未创建，跳过菜单点击处理');
                return;
            }
            
            this._searchResults.style.display = 'none';
            this._defaultContent.style.display = 'block';
            this._defaultContent.innerHTML = '';
            
            switch(menuId) {
                case 'discover':
                    this._loadHotSearches();
                    break;
                case 'playlist':
                    this._loadPlaylists();
                    break;
                case 'rank':
                    this._loadRankList();
                    break;
                case 'artist':
                    this._loadArtists();
                    break;
                case 'daily':
                    this._loadDailyRecommend();
                    break;
                case 'myplaylist':
                    this._loadMyPlaylist();
                    break;
            }
        },
        
        _loadMyPlaylist: function() {
            if (this._playlist.length === 0) {
                this._defaultContent.innerHTML = `
                    <div style="padding: 60px 20px; text-align: center; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🎵</div>
                        <div style="font-size: 16px; margin-bottom: 10px;">播放列表为空</div>
                        <div style="font-size: 14px; color: #666;">播放歌曲后，它们会自动添加到播放列表</div>
                    </div>
                `;
                return;
            }
            
            this._defaultContent.innerHTML = `
                <div style="padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 20px; color: #e0e0e0;">我的播放列表</h2>
                        <div style="display: flex; gap: 10px;">
                            <button class="playlist-action-btn" data-action="clear" style="
                                padding: 8px 16px;
                                background: rgba(236, 65, 65, 0.2);
                                border: 1px solid rgba(236, 65, 65, 0.3);
                                border-radius: 6px;
                                color: #ec4141;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">清空列表</button>
                            <button class="playlist-action-btn" data-action="playall" style="
                                padding: 8px 16px;
                                background: rgba(236, 65, 65, 0.3);
                                border: 1px solid rgba(236, 65, 65, 0.4);
                                border-radius: 6px;
                                color: #fff;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">播放全部</button>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${this._playlist.map((song, index) => `
                            <div class="playlist-item" data-index="${index}" data-rid="${song.rid}" style="
                                display: flex;
                                align-items: center;
                                gap: 12px;
                                padding: 12px;
                                background: ${index === this._currentIndex ? 'rgba(236, 65, 65, 0.15)' : 'transparent'};
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s;
                                border: ${index === this._currentIndex ? '1px solid rgba(236, 65, 65, 0.3)' : '1px solid transparent'};
                            ">
                                <div style="
                                    width: 50px;
                                    height: 50px;
                                    background: #2a2a2a;
                                    border-radius: 6px;
                                    overflow: hidden;
                                    flex-shrink: 0;
                                ">
                                    ${song.pic ? `<img src="${song.pic}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</div>'}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 14px; color: ${index === this._currentIndex ? '#ec4141' : '#e0e0e0'}; font-weight: ${index === this._currentIndex ? '600' : '400'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${song.name || '未知歌曲'}
                                    </div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${song.artist || '未知艺术家'}
                                    </div>
                                </div>
                                <div style="
                                    width: 32px;
                                    height: 32px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: #999;
                                    font-size: 18px;
                                    cursor: pointer;
                                    opacity: 0;
                                    transition: all 0.2s;
                                " class="playlist-remove-btn" data-index="${index}">🗑️</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            // 绑定点击事件
            this._defaultContent.querySelectorAll('.playlist-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('playlist-remove-btn')) {
                        return; // 删除按钮的点击事件单独处理
                    }
                    const index = parseInt(item.dataset.index);
                    this._currentIndex = index;
                    this._playSong(this._playlist[index]);
                    this._loadMyPlaylist(); // 刷新列表以更新高亮
                });
                
                item.addEventListener('mouseenter', () => {
                    item.style.background = '#2a2a2a';
                    const removeBtn = item.querySelector('.playlist-remove-btn');
                    if (removeBtn) {
                        removeBtn.style.opacity = '1';
                    }
                });
                
                item.addEventListener('mouseleave', () => {
                    const index = parseInt(item.dataset.index);
                    item.style.background = index === this._currentIndex ? 'rgba(236, 65, 65, 0.15)' : 'transparent';
                    const removeBtn = item.querySelector('.playlist-remove-btn');
                    if (removeBtn) {
                        removeBtn.style.opacity = '0';
                    }
                });
            });
            
            // 绑定删除按钮事件
            this._defaultContent.querySelectorAll('.playlist-remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    if (index === this._currentIndex && this._isPlaying) {
                        this._audio.pause();
                        this._isPlaying = false;
                    }
                    this._playlist.splice(index, 1);
                    if (this._currentIndex >= index) {
                        this._currentIndex = Math.max(0, this._currentIndex - 1);
                    }
                    if (this._currentIndex >= this._playlist.length) {
                        this._currentIndex = this._playlist.length - 1;
                    }
                    this._loadMyPlaylist();
                });
            });
            
            // 绑定操作按钮事件
            this._defaultContent.querySelectorAll('.playlist-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action === 'clear') {
                        if (confirm('确定要清空播放列表吗？')) {
                            this._playlist = [];
                            this._currentIndex = -1;
                            this._currentSong = null;
                            if (this._audio) {
                                this._audio.pause();
                                this._audio.src = '';
                            }
                            this._isPlaying = false;
                            this._updatePlayButton();
                            this._loadMyPlaylist();
                        }
                    } else if (action === 'playall') {
                        if (this._playlist.length > 0) {
                            this._currentIndex = 0;
                            this._playSong(this._playlist[0]);
                        }
                    }
                });
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.opacity = '0.8';
                    btn.style.transform = 'scale(1.05)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.opacity = '1';
                    btn.style.transform = 'scale(1)';
                });
            });
        },
        
        async _loadHotSearches() {
            try {
                const response = await this._fetch(`${this.API_BASE}?type=searchKey`);
                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data.hots) {
                    const hots = data.data.hots;
                    this._defaultContent.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0; animation: fadeInUp 0.5s ease;">热门搜索</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            ${hots.map((item, index) => `
                                <div class="hot-search-item" data-keyword="${item.name}" style="animation: fadeInUp 0.5s ease ${index * 0.05}s both;">${item.name}</div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.hot-search-item').forEach(item => {
                        item.addEventListener('click', () => {
                            this._searchInput.value = item.dataset.keyword;
                            this._performSearch();
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#3a3a3a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#2a2a2a';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载热门搜索失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _loadPlaylists() {
            try {
                const response = await this._fetch(`${this.API_BASE}?type=new&page=1&limit=20`);
                const data = await response.json();
                
                if (data.code === 200 && data.data) {
                    const playlists = Array.isArray(data.data) ? data.data : [];
                    this._defaultContent.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0;">精选歌单</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px;">
                            ${playlists.map(playlist => `
                                <div class="playlist-item" data-id="${playlist.rid}" style="
                                    cursor: pointer;
                                    transition: transform 0.2s;
                                ">
                                    <img src="${playlist.pic}" style="
                                        width: 100%;
                                        aspect-ratio: 1;
                                        border-radius: 8px;
                                        object-fit: cover;
                                    " onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div style="display: none; width: 100%; aspect-ratio: 1; background: #2a2a2a; border-radius: 8px; align-items: center; justify-content: center; font-size: 48px;">🎵</div>
                                    <div style="margin-top: 8px; font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${playlist.name}</div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">${playlist.artist}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.playlist-item').forEach(item => {
                        item.addEventListener('click', () => {
                            this._loadPlaylistDetail(item.dataset.id);
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.transform = 'translateY(-5px)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.transform = 'translateY(0)';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载歌单失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _loadRankList() {
            try {
                const response = await this._fetch(`${this.API_BASE}?name=热歌榜&type=rank&limit=30`);
                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data.musicList) {
                    const songs = data.data.musicList;
                    this._defaultContent.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0;">热歌榜</h2>
                        <div class="rank-list" style="background: #252525; border-radius: 8px; overflow: hidden;">
                            ${songs.map((song, index) => `
                                <div class="rank-item" data-rid="${song.rid}" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 12px 20px;
                                    border-bottom: 1px solid #333;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                ">
                                    <div style="width: 40px; text-align: center; font-size: 16px; font-weight: bold; color: ${index < 3 ? '#ec4141' : '#999'};">
                                        ${index + 1}
                                    </div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.name}</div>
                                        <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.artist} - ${song.album}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.rank-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            const rid = item.dataset.rid;
                            // 从原始数据中获取歌曲信息（更可靠）
                            const songData = songs[index];
                            if (songData) {
                                const song = {
                                    rid: songData.rid || rid,
                                    name: songData.name || '未知歌曲',
                                    artist: songData.artist || '未知艺术家',
                                    pic: songData.pic || '',
                                    url: `${this.API_BASE}?id=${songData.rid || rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${songData.rid || rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            } else {
                                // 如果原始数据不可用，从DOM提取（备用方案）
                                const nameEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 14px"]');
                                const artistEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 12px"]');
                                
                                const song = {
                                    rid: rid,
                                    name: nameEl ? nameEl.textContent.trim() : '未知歌曲',
                                    artist: artistEl ? artistEl.textContent.trim().split(' - ')[0] : '未知艺术家',
                                    pic: '',
                                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            }
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#2a2a2a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载排行榜失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _loadArtists() {
            try {
                const response = await this._fetch(`${this.API_BASE}?type=artist&page=1&limit=30`);
                const data = await response.json();
                
                if (data.code === 200 && data.data) {
                    const artists = Array.isArray(data.data) ? data.data : [];
                    this._defaultContent.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0;">热门歌手</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px;">
                            ${artists.map(artist => `
                                <div class="artist-item" data-id="${artist.rid}" style="
                                    cursor: pointer;
                                    text-align: center;
                                    transition: transform 0.2s;
                                ">
                                    <img src="${artist.pic}" style="
                                        width: 120px;
                                        height: 120px;
                                        border-radius: 50%;
                                        object-fit: cover;
                                        margin: 0 auto;
                                    " onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div style="display: none; width: 120px; height: 120px; background: #2a2a2a; border-radius: 50%; margin: 0 auto; align-items: center; justify-content: center; font-size: 48px;">👤</div>
                                    <div style="margin-top: 12px; font-size: 14px; color: #e0e0e0;">${artist.name}</div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">${artist.artistFans || 0} 粉丝</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.artist-item').forEach(item => {
                        item.addEventListener('click', () => {
                            this._loadArtistSongs(item.dataset.id);
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.transform = 'translateY(-5px)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.transform = 'translateY(0)';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载歌手失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _loadDailyRecommend() {
            try {
                const response = await this._fetch(`${this.API_BASE}?type=daily30`);
                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data.musicList) {
                    const songs = data.data.musicList;
                    this._defaultContent.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0;">每日30首</h2>
                        <div class="daily-list" style="background: #252525; border-radius: 8px; overflow: hidden;">
                            ${songs.map((song, index) => `
                                <div class="daily-item" data-rid="${song.rid}" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 12px 20px;
                                    border-bottom: 1px solid #333;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                ">
                                    <img src="${song.pic}" style="
                                        width: 50px;
                                        height: 50px;
                                        border-radius: 4px;
                                        object-fit: cover;
                                        margin-right: 15px;
                                    " onerror="this.style.display='none';">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.name}</div>
                                        <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.artist} - ${song.album}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.daily-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            const rid = item.dataset.rid;
                            // 从原始数据中获取歌曲信息（更可靠）
                            const songData = songs[index];
                            if (songData) {
                                const song = {
                                    rid: songData.rid || rid,
                                    name: songData.name || '未知歌曲',
                                    artist: songData.artist || '未知艺术家',
                                    pic: songData.pic || '',
                                    url: `${this.API_BASE}?id=${songData.rid || rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${songData.rid || rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            } else {
                                // 如果原始数据不可用，从DOM提取（备用方案）
                                const nameEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 14px"]');
                                const artistEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 12px"]');
                                const imgEl = item.querySelector('img');
                                
                                const song = {
                                    rid: rid,
                                    name: nameEl ? nameEl.textContent.trim() : '未知歌曲',
                                    artist: artistEl ? artistEl.textContent.trim().split(' - ')[0] : '未知艺术家',
                                    pic: imgEl && imgEl.src ? imgEl.src : '',
                                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            }
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#2a2a2a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载每日推荐失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _performSearch() {
            const keyword = this._searchInput.value.trim();
            if (!keyword) return;
            
            try {
                this._showMessage('搜索中...');
                const response = await this._fetch(`${this.API_BASE}?name=${encodeURIComponent(keyword)}&page=1&limit=30`);
                const data = await response.json();
                
                if (data.code === 200 && data.data) {
                    const songs = Array.isArray(data.data) ? data.data : [];
                    this._searchResults.style.display = 'block';
                    this._defaultContent.style.display = 'none';
                    this._searchResults.innerHTML = `
                        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #e0e0e0;">搜索结果: "${keyword}"</h2>
                        <div class="search-list" style="background: #252525; border-radius: 8px; overflow: hidden;">
                            ${songs.length > 0 ? songs.map((song, index) => `
                                <div class="search-item" data-rid="${song.rid}" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 12px 20px;
                                    border-bottom: 1px solid #333;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                ">
                                    <img src="${song.pic}" style="
                                        width: 50px;
                                        height: 50px;
                                        border-radius: 4px;
                                        object-fit: cover;
                                        margin-right: 15px;
                                    " onerror="this.style.display='none';">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.name}</div>
                                        <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.artist} - ${song.album}</div>
                                    </div>
                                </div>
                            `).join('') : '<div style="padding: 40px; text-align: center; color: #999;">未找到相关歌曲</div>'}
                        </div>
                    `;
                    
                    // 绑定点击事件
                    this._searchResults.querySelectorAll('.search-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            const rid = item.dataset.rid;
                            // 从原始数据中获取歌曲信息（更可靠）
                            const songData = songs[index];
                            if (songData) {
                                const song = {
                                    rid: songData.rid || rid,
                                    name: songData.name || '未知歌曲',
                                    artist: songData.artist || '未知艺术家',
                                    pic: songData.pic || '',
                                    url: `${this.API_BASE}?id=${songData.rid || rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${songData.rid || rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            } else {
                                // 如果原始数据不可用，从DOM提取（备用方案）
                                const nameEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 14px"]');
                                const artistEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 12px"]');
                                const imgEl = item.querySelector('img');
                                
                                const song = {
                                    rid: rid,
                                    name: nameEl ? nameEl.textContent.trim() : '未知歌曲',
                                    artist: artistEl ? artistEl.textContent.trim().split(' - ')[0] : '未知艺术家',
                                    pic: imgEl && imgEl.src ? imgEl.src : '',
                                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            }
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#2a2a2a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 搜索失败:', e);
                this._showMessage('搜索失败，请稍后重试');
            }
        },
        
        async _loadPlaylistDetail(playlistId) {
            try {
                const response = await this._fetch(`${this.API_BASE}?id=${playlistId}&limit=30&type=list`);
                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data.musicList) {
                    const songs = data.data.musicList;
                    this._defaultContent.innerHTML = `
                        <div style="margin-bottom: 20px;">
                            <button class="back-button" style="
                                padding: 8px 16px;
                                background: #2a2a2a;
                                border: none;
                                border-radius: 4px;
                                color: #e0e0e0;
                                cursor: pointer;
                                margin-bottom: 20px;
                            ">← 返回</button>
                            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #e0e0e0;">${data.data.name || '歌单'}</h2>
                            <div style="font-size: 12px; color: #999;">${songs.length} 首歌曲</div>
                        </div>
                        <div class="playlist-detail-list" style="background: #252525; border-radius: 8px; overflow: hidden;">
                            ${songs.map((song, index) => `
                                <div class="playlist-detail-item" data-rid="${song.rid}" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 12px 20px;
                                    border-bottom: 1px solid #333;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                ">
                                    <div style="width: 30px; text-align: center; font-size: 14px; color: #999;">${index + 1}</div>
                                    <img src="${song.pic}" style="
                                        width: 50px;
                                        height: 50px;
                                        border-radius: 4px;
                                        object-fit: cover;
                                        margin: 0 15px;
                                    " onerror="this.style.display='none';">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.name}</div>
                                        <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.artist} - ${song.album}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    
                    // 返回按钮
                    this._defaultContent.querySelector('.back-button').addEventListener('click', () => {
                        this._loadPlaylists();
                    });
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.playlist-detail-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            const rid = item.dataset.rid;
                            // 从原始数据中获取歌曲信息（更可靠）
                            const songData = songs[index];
                            if (songData) {
                                const song = {
                                    rid: songData.rid || rid,
                                    name: songData.name || '未知歌曲',
                                    artist: songData.artist || '未知艺术家',
                                    pic: songData.pic || '',
                                    url: `${this.API_BASE}?id=${songData.rid || rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${songData.rid || rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            } else {
                                // 如果原始数据不可用，从DOM提取（备用方案）
                                const nameEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 14px"]');
                                const artistEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 12px"]');
                                const imgEl = item.querySelector('img');
                                
                                const song = {
                                    rid: rid,
                                    name: nameEl ? nameEl.textContent.trim() : '未知歌曲',
                                    artist: artistEl ? artistEl.textContent.trim().split(' - ')[0] : '未知艺术家',
                                    pic: imgEl && imgEl.src ? imgEl.src : '',
                                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            }
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#2a2a2a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载歌单详情失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _loadArtistSongs(artistId) {
            try {
                const response = await this._fetch(`${this.API_BASE}?id=${artistId}&page=1&limit=30&type=artistMusic`);
                const data = await response.json();
                
                if (data.code === 200 && data.data) {
                    const songs = Array.isArray(data.data) ? data.data : [];
                    this._defaultContent.innerHTML = `
                        <div style="margin-bottom: 20px;">
                            <button class="back-button" style="
                                padding: 8px 16px;
                                background: #2a2a2a;
                                border: none;
                                border-radius: 4px;
                                color: #e0e0e0;
                                cursor: pointer;
                                margin-bottom: 20px;
                            ">← 返回</button>
                            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #e0e0e0;">歌手歌曲</h2>
                            <div style="font-size: 12px; color: #999;">${songs.length} 首歌曲</div>
                        </div>
                        <div class="artist-songs-list" style="background: #252525; border-radius: 8px; overflow: hidden;">
                            ${songs.length > 0 ? songs.map((song, index) => `
                                <div class="artist-song-item" data-rid="${song.rid}" style="
                                    display: flex;
                                    align-items: center;
                                    padding: 12px 20px;
                                    border-bottom: 1px solid #333;
                                    cursor: pointer;
                                    transition: background 0.2s;
                                ">
                                    <div style="width: 30px; text-align: center; font-size: 14px; color: #999;">${index + 1}</div>
                                    <img src="${song.pic || song.albumpic}" style="
                                        width: 50px;
                                        height: 50px;
                                        border-radius: 4px;
                                        object-fit: cover;
                                        margin: 0 15px;
                                    " onerror="this.style.display='none';">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.name}</div>
                                        <div style="font-size: 12px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${song.album}</div>
                                    </div>
                                </div>
                            `).join('') : '<div style="padding: 40px; text-align: center; color: #999;">暂无歌曲</div>'}
                        </div>
                    `;
                    
                    // 返回按钮
                    this._defaultContent.querySelector('.back-button').addEventListener('click', () => {
                        this._loadArtists();
                    });
                    
                    // 绑定点击事件
                    this._defaultContent.querySelectorAll('.artist-song-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            const rid = item.dataset.rid;
                            // 从原始数据中获取歌曲信息（更可靠）
                            const songData = songs[index];
                            if (songData) {
                                const song = {
                                    rid: songData.rid || rid,
                                    name: songData.name || '未知歌曲',
                                    artist: songData.artist || '未知艺术家',
                                    pic: songData.pic || songData.albumpic || '',
                                    url: `${this.API_BASE}?id=${songData.rid || rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${songData.rid || rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            } else {
                                // 如果原始数据不可用，从DOM提取（备用方案）
                                const nameEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 14px"]');
                                const artistEl = item.querySelector('div[style*="flex: 1"] > div[style*="font-size: 12px"]');
                                const imgEl = item.querySelector('img');
                                
                                const song = {
                                    rid: rid,
                                    name: nameEl ? nameEl.textContent.trim() : '未知歌曲',
                                    artist: artistEl ? artistEl.textContent.trim() : '未知艺术家',
                                    pic: imgEl && imgEl.src ? imgEl.src : '',
                                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                                };
                                this._playSong(song);
                            }
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#2a2a2a';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载歌手歌曲失败:', e);
                this._showMessage('加载失败，请稍后重试');
            }
        },
        
        async _playSongById(rid) {
            try {
                // 先尝试从当前显示的内容中获取歌曲信息（如果可用）
                let song = {
                    rid: rid,
                    name: '加载中...',
                    artist: '未知艺术家',
                    pic: '',
                    url: `${this.API_BASE}?id=${rid}&type=song&level=exhigh&format=mp3`,
                    lrc: `${this.API_BASE}?id=${rid}&type=lyr&format=all`
                };
                
                // 尝试从搜索结果或当前内容中获取歌曲信息
                const searchItems = this._searchResults ? this._searchResults.querySelectorAll('[data-rid="' + rid + '"]') : [];
                const defaultItems = this._defaultContent ? this._defaultContent.querySelectorAll('[data-rid="' + rid + '"]') : [];
                const allItems = [...searchItems, ...defaultItems];
                
                if (allItems.length > 0) {
                    const item = allItems[0];
                    const nameEl = item.querySelector('div[style*="font-size: 14px"]');
                    const artistEl = item.querySelector('div[style*="font-size: 12px"]');
                    const imgEl = item.querySelector('img');
                    
                    if (nameEl) {
                        song.name = nameEl.textContent.trim();
                    }
                    if (artistEl) {
                        const artistText = artistEl.textContent.trim();
                        const parts = artistText.split(' - ');
                        if (parts.length > 0) {
                            song.artist = parts[0];
                        }
                    }
                    if (imgEl && imgEl.src) {
                        song.pic = imgEl.src;
                    }
                }
                
                // 播放歌曲
                await this._playSong(song);
            } catch (e) {
                console.error('[MusicPlayer] 播放歌曲失败:', e);
                this._showMessage('播放失败，请稍后重试');
            }
        },
        
        async _playSong(song) {
            try {
                if (!song.url) {
                    song.url = `${this.API_BASE}?id=${song.rid}&type=song&level=exhigh&format=mp3`;
                }
                
                this._currentSong = song;
                
                // 先更新UI（在加载音频之前）
                if (this._playerSongName) {
                    this._playerSongName.textContent = song.name || '未知歌曲';
                }
                if (this._playerArtistName) {
                    this._playerArtistName.textContent = song.artist || '未知艺术家';
                }
                
                // 更新封面（添加淡入淡出动画）
                if (this._playerCover) {
                    this._playerCover.style.opacity = '0.5';
                    this._playerCover.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    
                    setTimeout(() => {
                        if (song.pic) {
                            const img = document.createElement('img');
                            img.src = song.pic;
                            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                            img.onload = () => {
                                this._playerCover.innerHTML = '';
                                this._playerCover.appendChild(img);
                                this._playerCover.style.opacity = '1';
                                this._playerCover.style.transform = 'scale(1)';
                            };
                            img.onerror = () => {
                                this._playerCover.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🎵</div>';
                                this._playerCover.style.opacity = '1';
                                this._playerCover.style.transform = 'scale(1)';
                            };
                        } else {
                            this._playerCover.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🎵</div>';
                            this._playerCover.style.opacity = '1';
                            this._playerCover.style.transform = 'scale(1)';
                        }
                    }, 150);
                }
                
                // 重置进度
                if (this._progressFill) {
                    this._progressFill.style.width = '0%';
                }
                if (this._timeCurrent) {
                    this._timeCurrent.textContent = '00:00';
                }
                if (this._timeTotal) {
                    this._timeTotal.textContent = '00:00';
                }
                
                // 添加到播放列表
                if (!this._playlist.find(s => s.rid === song.rid)) {
                    this._playlist.push(song);
                }
                this._currentIndex = this._playlist.findIndex(s => s.rid === song.rid);
                
                // 先暂停并清空当前播放，避免 AbortError
                if (this._isLoading) {
                    // 如果正在加载，先等待完成或取消
                    this._audio.pause();
                    this._audio.src = '';
                    this._audio.load();
                } else {
                    this._audio.pause();
                }
                
                // 设置加载标志
                this._isLoading = true;
                
                // 等待一小段时间，确保前一个操作完成
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // 设置音频源
                this._audio.src = song.url;
                
                // 等待音频加载完成
                await new Promise((resolve, reject) => {
                    const onCanPlay = () => {
                        this._audio.removeEventListener('canplaythrough', onCanPlay);
                        this._audio.removeEventListener('error', onError);
                        this._isLoading = false;
                        resolve();
                    };
                    
                    const onError = (e) => {
                        this._audio.removeEventListener('canplaythrough', onCanPlay);
                        this._audio.removeEventListener('error', onError);
                        this._isLoading = false;
                        reject(e);
                    };
                    
                    // 如果已经可以播放，直接resolve
                    if (this._audio.readyState >= 3) { // HAVE_FUTURE_DATA
                        this._isLoading = false;
                        resolve();
                    } else {
                        this._audio.addEventListener('canplaythrough', onCanPlay, { once: true });
                        this._audio.addEventListener('error', onError, { once: true });
                        this._audio.load();
                        
                        // 设置超时（10秒）
                        setTimeout(() => {
                            if (this._isLoading) {
                                this._audio.removeEventListener('canplaythrough', onCanPlay);
                                this._audio.removeEventListener('error', onError);
                                this._isLoading = false;
                                reject(new Error('音频加载超时'));
                            }
                        }, 10000);
                    }
                });
                
                // 播放
                try {
                    await this._audio.play();
                    this._isPlaying = true;
                    this._updatePlayButton();
                    
                    // 添加播放动画类
                    if (this._playerCover) {
                        this._playerCover.classList.add('playing');
                    }
                    
                    // 更新通知中的播放状态
                    if (this._useNotification) {
                        this._updateNotificationDependent();
                    }
                    
                    // 更新通知中的播放状态
                    if (this._useNotification) {
                        this._updateNotificationDependent();
                    }
                } catch (playError) {
                    // 忽略 AbortError（通常是因为快速切换歌曲导致的）
                    if (playError.name !== 'AbortError') {
                        console.error('[MusicPlayer] 播放失败:', playError);
                        this._showMessage('播放失败，请检查音频源');
                    }
                    this._isPlaying = false;
                    this._updatePlayButton();
                    
                    // 移除播放动画类
                    if (this._playerCover) {
                        this._playerCover.classList.remove('playing');
                    }
                    
                    // 更新通知中的播放状态
                    if (this._useNotification) {
                        this._updateNotificationDependent();
                    }
                }
                
                // 加载歌词
                if (song.lrc) {
                    this._loadLyrics(song.lrc);
                }
                
                // 如果处于沉浸式模式，更新沉浸式页面
                if (this._isImmersiveMode) {
                    this._updateImmersiveView();
                }
                
                // 更新桌面组件
                this._updateDesktopWidget();
            } catch (e) {
                console.error('[MusicPlayer] 播放失败:', e);
                this._showMessage('播放失败，请稍后重试');
                this._isPlaying = false;
                this._updatePlayButton();
            }
        },
        
        async _loadLyrics(lrcUrl) {
            try {
                const response = await this._fetch(lrcUrl);
                const data = await response.json();
                
                if (data.code === 200 && data.data && data.data.lrclist) {
                    this._parseLyrics(data.data.lrclist);
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载歌词失败:', e);
            }
        },
        
        _parseLyrics(lrcText) {
            const lines = lrcText.split('\n');
            this._lyrics = [];
            
            lines.forEach(line => {
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
                if (match) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    const milliseconds = parseInt(match[3].padEnd(3, '0'));
                    const time = minutes * 60 + seconds + milliseconds / 1000;
                    const text = match[4].trim();
                    if (text) {
                        this._lyrics.push({ time, text });
                    }
                }
            });
            
            this._lyrics.sort((a, b) => a.time - b.time);
        },
        
        _togglePlay() {
            if (this._isPlaying) {
                this._audio.pause();
                this._isPlaying = false;
                // 移除播放动画类
                if (this._playerCover) {
                    this._playerCover.classList.remove('playing');
                }
                // 更新通知中的播放状态
                if (this._useNotification) {
                    this._updateNotificationDependent();
                }
            } else {
                if (this._currentSong && this._audio.src) {
                    this._audio.play().then(() => {
                        this._isPlaying = true;
                        this._updatePlayButton();
                        // 添加播放动画类
                        if (this._playerCover) {
                            this._playerCover.classList.add('playing');
                        }
                        // 更新通知中的播放状态
                        if (this._useNotification) {
                            this._updateNotificationDependent();
                        }
                    }).catch(e => {
                        console.error('[MusicPlayer] 播放失败:', e);
                        this._showMessage('播放失败，请稍后重试');
                    });
                } else if (this._playlist.length > 0) {
                    this._playSong(this._playlist[0]);
                } else {
                    this._showMessage('没有可播放的歌曲');
                }
            }
            this._updatePlayButton();
        },
        
        _playPrev() {
            if (this._playlist.length === 0) return;
            this._currentIndex = (this._currentIndex - 1 + this._playlist.length) % this._playlist.length;
            this._playSong(this._playlist[this._currentIndex]);
        },
        
        _playNext() {
            if (this._playlist.length === 0) return;
            
            switch (this._playMode) {
                case 'single':
                    // 单曲循环：重新播放当前歌曲
                    this._playSong(this._playlist[this._currentIndex]);
                    break;
                case 'random':
                    // 随机播放
                    let randomIndex;
                    do {
                        randomIndex = Math.floor(Math.random() * this._playlist.length);
                    } while (randomIndex === this._currentIndex && this._playlist.length > 1);
                    this._currentIndex = randomIndex;
                    this._playSong(this._playlist[this._currentIndex]);
                    break;
                case 'list':
                default:
                    // 列表循环：播放下一首
                    this._currentIndex = (this._currentIndex + 1) % this._playlist.length;
                    this._playSong(this._playlist[this._currentIndex]);
                    break;
            }
        },
        
        _togglePlayMode() {
            const modes = ['list', 'single', 'random'];
            const modeNames = {
                'list': '列表循环',
                'single': '单曲循环',
                'random': '随机播放'
            };
            const modeIcons = {
                'list': '🔁',
                'single': '🔂',
                'random': '🔀'
            };
            
            const currentIndex = modes.indexOf(this._playMode);
            this._playMode = modes[(currentIndex + 1) % modes.length];
            
            if (this._playModeButton) {
                this._playModeButton.textContent = modeIcons[this._playMode];
                this._playModeButton.title = modeNames[this._playMode];
            }
            
            this._showMessage(modeNames[this._playMode]);
        },
        
        _updatePlayButton() {
            if (this._playButton) {
                this._playButton.textContent = this._isPlaying ? '⏸' : '▶';
            }
            // 更新沉浸式播放按钮
            if (this._immersivePlayButton) {
                this._immersivePlayButton.textContent = this._isPlaying ? '⏸' : '▶';
            }
            // 更新沉浸式封面旋转动画（只旋转顶层）
            if (this._immersiveCover) {
                if (this._isPlaying) {
                    this._immersiveCover.classList.add('playing');
                } else {
                    this._immersiveCover.classList.remove('playing');
                }
            }
            // 更新桌面组件
            this._updateDesktopWidget();
        },
        
        _updateProgress() {
            if (!this._audio) return;
            
            const current = this._audio.currentTime;
            const duration = this._audio.duration || 0;
            
            // 更新底部播放栏
            if (this._timeCurrent) {
                this._timeCurrent.textContent = this._formatTime(current);
            }
            if (this._timeTotal) {
                this._timeTotal.textContent = this._formatTime(duration);
            }
            if (this._progressFill) {
                const percent = duration > 0 ? (current / duration) * 100 : 0;
                this._progressFill.style.width = `${percent}%`;
            }
            
            // 更新沉浸式播放页面
            if (this._isImmersiveMode) {
                if (this._immersiveTimeCurrent) {
                    this._immersiveTimeCurrent.textContent = this._formatTime(current);
                }
                if (this._immersiveTimeTotal) {
                    this._immersiveTimeTotal.textContent = this._formatTime(duration);
                }
                if (this._immersiveProgressFill) {
                    const percent = duration > 0 ? (current / duration) * 100 : 0;
                    this._immersiveProgressFill.style.width = `${percent}%`;
                }
            }
            
            // 更新通知进度条
            if (this._notificationId && typeof NotificationManager !== 'undefined') {
                try {
                    const container = NotificationManager.getNotificationContentContainer(this._notificationId);
                    if (container) {
                        const progressBar = container.querySelector('.music-notification-progress');
                        if (progressBar) {
                            const percent = duration > 0 ? (current / duration) * 100 : 0;
                            progressBar.style.width = `${percent}%`;
                        }
                    }
                } catch (e) {
                    // 忽略更新错误
                }
            }
        },
        
        _updateDuration() {
            if (this._timeTotal && this._audio) {
                this._timeTotal.textContent = this._formatTime(this._audio.duration || 0);
            }
        },
        
        _updateLyrics() {
            if (!this._lyrics || !this._audio) return;
            
            const currentTime = this._audio.currentTime;
            let newIndex = -1;
            
            for (let i = this._lyrics.length - 1; i >= 0; i--) {
                if (this._lyrics[i].time <= currentTime) {
                    newIndex = i;
                    break;
                }
            }
            
            if (newIndex !== this._currentLyricIndex) {
                this._currentLyricIndex = newIndex;
                // 更新沉浸式歌词显示
                if (this._isImmersiveMode) {
                    this._updateImmersiveLyrics();
                }
            }
        },
        
        _seekTo(percent) {
            if (!this._audio || !this._audio.duration) return;
            this._audio.currentTime = this._audio.duration * percent;
        },
        
        _setVolume(percent) {
            this._volume = Math.max(0, Math.min(1, percent));
            if (this._audio) {
                this._audio.volume = this._volume;
            }
            
            // 更新音量滑块
            if (this._volumeFill) {
                this._volumeFill.style.width = `${this._volume * 100}%`;
            }
            
            // 更新音量图标
            if (this._volumeIcon) {
                if (this._volume === 0) {
                    this._volumeIcon.textContent = '🔇';
                } else if (this._volume < 0.5) {
                    this._volumeIcon.textContent = '🔉';
                } else {
                    this._volumeIcon.textContent = '🔊';
                }
            }
        },
        
        _formatTime(seconds) {
            if (!isFinite(seconds)) return '00:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        },
        
        _showMessage(message) {
            // 简单的消息提示
            const msgEl = document.createElement('div');
            msgEl.textContent = message;
            msgEl.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: #e0e0e0;
                padding: 12px 24px;
                border-radius: 4px;
                z-index: 10000;
                font-size: 14px;
            `;
            document.body.appendChild(msgEl);
            setTimeout(() => {
                if (msgEl.parentElement) {
                    msgEl.parentElement.removeChild(msgEl);
                }
            }, 2000);
        },
        
        _cleanup() {
            if (this._audio) {
                this._audio.pause();
                this._audio.src = '';
                this._audio.load();
            }
            this._isLoading = false;
            this._isPlaying = false;
            
            // 根据设置清理桌面组件或通知依赖
            if (this._useNotification) {
                this._removeNotificationDependent();
            } else {
                this._removeDesktopComponent();
            }
        },
        
        _createDesktopComponent: function() {
            if (typeof DesktopManager === 'undefined') {
                return;
            }
            
            try {
                // 创建桌面组件（位置自动计算，避开图标）
                this._desktopComponentId = DesktopManager.createComponent(this.pid, {
                    type: 'music-widget',
                    // position 不指定，让系统自动计算避开图标的位置
                    size: { width: 320, height: 120 },
                    style: {
                        backgroundColor: 'rgba(30, 30, 30, 0.9)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    },
                    persistent: false
                });
                
                // 获取内容容器
                const container = DesktopManager.getComponentContentContainer(this._desktopComponentId);
                if (!container) {
                    return;
                }
                
                this._desktopComponent = container;
                
                // 创建组件UI
                container.innerHTML = '';
                container.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    padding: 12px;
                    box-sizing: border-box;
                    color: #e0e0e0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;
                
                // 顶部：歌曲信息
                const infoSection = document.createElement('div');
                infoSection.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                    min-height: 0;
                `;
                
                // 封面（小）
                const cover = document.createElement('div');
                cover.className = 'desktop-widget-cover';
                cover.style.cssText = `
                    width: 60px;
                    height: 60px;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #2a2a2a;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                `;
                cover.innerHTML = '🎵';
                this._desktopWidgetCover = cover;
                
                // 歌曲信息
                const songInfo = document.createElement('div');
                songInfo.style.cssText = `
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 4px;
                `;
                
                const songName = document.createElement('div');
                songName.className = 'desktop-widget-song-name';
                songName.style.cssText = `
                    font-size: 14px;
                    font-weight: 600;
                    color: #ffffff;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                songName.textContent = '未播放';
                this._desktopWidgetSongName = songName;
                
                const artistName = document.createElement('div');
                artistName.className = 'desktop-widget-artist-name';
                artistName.style.cssText = `
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                artistName.textContent = '--';
                this._desktopWidgetArtistName = artistName;
                
                songInfo.appendChild(songName);
                songInfo.appendChild(artistName);
                
                infoSection.appendChild(cover);
                infoSection.appendChild(songInfo);
                
                // 底部：控制按钮
                const controlSection = document.createElement('div');
                controlSection.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-top: 8px;
                `;
                
                // 上一首
                const prevBtn = document.createElement('button');
                prevBtn.innerHTML = '⏮';
                prevBtn.style.cssText = `
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                `;
                prevBtn.onmouseenter = () => prevBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                prevBtn.onmouseleave = () => prevBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                prevBtn.onclick = () => this._playPrevious();
                
                // 播放/暂停
                const playBtn = document.createElement('button');
                playBtn.innerHTML = '▶';
                playBtn.style.cssText = `
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: linear-gradient(135deg, #ec4141 0%, #d63636 100%);
                    color: #ffffff;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(236, 65, 65, 0.4);
                `;
                playBtn.onmouseenter = () => {
                    playBtn.style.transform = 'scale(1.1)';
                    playBtn.style.boxShadow = '0 4px 12px rgba(236, 65, 65, 0.6)';
                };
                playBtn.onmouseleave = () => {
                    playBtn.style.transform = 'scale(1)';
                    playBtn.style.boxShadow = '0 2px 8px rgba(236, 65, 65, 0.4)';
                };
                playBtn.onclick = () => this._togglePlay();
                this._desktopWidgetPlayBtn = playBtn;
                
                // 下一首
                const nextBtn = document.createElement('button');
                nextBtn.innerHTML = '⏭';
                nextBtn.style.cssText = `
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                `;
                nextBtn.onmouseenter = () => nextBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                nextBtn.onmouseleave = () => nextBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                nextBtn.onclick = () => this._playNext();
                
                controlSection.appendChild(prevBtn);
                controlSection.appendChild(playBtn);
                controlSection.appendChild(nextBtn);
                
                container.appendChild(infoSection);
                container.appendChild(controlSection);
                
                // 双击打开主窗口
                container.ondblclick = () => {
                    if (typeof GUIManager !== 'undefined' && this.window) {
                        GUIManager.restoreWindow(this.pid);
                        GUIManager.focusWindow(this.pid);
                    }
                };
                
                // 更新初始状态
                this._updateDesktopWidget();
                
            } catch (e) {
                console.error('[MusicPlayer] 创建桌面组件失败:', e);
            }
        },
        
        _updateDesktopWidget: function() {
            // 根据设置更新桌面组件或通知依赖
            if (this._useNotification) {
                this._updateNotificationDependent();
            } else {
                this._updateDesktopWidgetContent();
            }
        },
        
        _updateDesktopWidgetContent: function() {
            if (!this._desktopComponent) return;
            
            // 更新歌曲信息
            if (this._desktopWidgetSongName && this._currentSong) {
                this._desktopWidgetSongName.textContent = this._currentSong.name || '未播放';
            }
            if (this._desktopWidgetArtistName && this._currentSong) {
                this._desktopWidgetArtistName.textContent = this._currentSong.artist || '--';
            }
            
            // 更新封面
            if (this._desktopWidgetCover && this._currentSong) {
                if (this._currentSong.pic) {
                    const img = document.createElement('img');
                    img.src = this._currentSong.pic;
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                    img.onerror = () => {
                        this._desktopWidgetCover.innerHTML = '🎵';
                    };
                    this._desktopWidgetCover.innerHTML = '';
                    this._desktopWidgetCover.appendChild(img);
                } else {
                    this._desktopWidgetCover.innerHTML = '🎵';
                }
            }
            
            // 更新播放按钮
            if (this._desktopWidgetPlayBtn) {
                this._desktopWidgetPlayBtn.innerHTML = this._isPlaying ? '⏸' : '▶';
            }
        },
        
        _removeDesktopComponent: function() {
            if (this._desktopComponentId && typeof DesktopManager !== 'undefined') {
                try {
                    DesktopManager.removeComponent(this._desktopComponentId);
                    this._desktopComponentId = null;
                    this._desktopComponent = null;
                } catch (e) {
                    console.error('[MusicPlayer] 删除桌面组件失败:', e);
                }
            }
        },
        
        // 加载设置
        _loadSettings: async function() {
            try {
                if (typeof LStorage !== 'undefined') {
                    const settings = await LStorage.getProgramStorage(this.pid, 'musicplayer_settings');
                    if (settings && typeof settings.useNotification === 'boolean') {
                        this._useNotification = settings.useNotification;
                    }
                }
            } catch (e) {
                console.error('[MusicPlayer] 加载设置失败:', e);
            }
        },
        
        // 保存设置
        _saveSettings: async function() {
            try {
                if (typeof LStorage !== 'undefined') {
                    await LStorage.setProgramStorage(this.pid, 'musicplayer_settings', {
                        useNotification: this._useNotification
                    });
                }
            } catch (e) {
                console.error('[MusicPlayer] 保存设置失败:', e);
            }
        },
        
        // 显示设置对话框
        _showSettings: function() {
            // 创建设置对话框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: #1e1e1e;
                border-radius: 12px;
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            `;
            
            content.innerHTML = `
                <div style="font-size: 18px; font-weight: 600; color: #e0e0e0; margin-bottom: 20px;">设置</div>
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 14px; color: #b3b3b3; margin-bottom: 12px;">播放信息显示方式</div>
                    <label style="display: flex; align-items: center; gap: 10px; padding: 10px; cursor: pointer; border-radius: 8px; transition: background 0.2s;" 
                           onmouseenter="this.style.background='#2a2a2a'" 
                           onmouseleave="this.style.background='transparent'">
                        <input type="radio" name="displayMode" value="desktop" ${!this._useNotification ? 'checked' : ''} 
                               style="cursor: pointer;">
                        <span style="color: #e0e0e0;">桌面组件</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px; padding: 10px; cursor: pointer; border-radius: 8px; transition: background 0.2s; margin-top: 8px;" 
                           onmouseenter="this.style.background='#2a2a2a'" 
                           onmouseleave="this.style.background='transparent'">
                        <input type="radio" name="displayMode" value="notification" ${this._useNotification ? 'checked' : ''} 
                               style="cursor: pointer;">
                        <span style="color: #e0e0e0;">通知依赖</span>
                    </label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="settings-cancel" style="
                        padding: 8px 20px;
                        background: #2a2a2a;
                        color: #e0e0e0;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">取消</button>
                    <button id="settings-save" style="
                        padding: 8px 20px;
                        background: #ec4141;
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">保存</button>
                </div>
            `;
            
            dialog.appendChild(content);
            document.body.appendChild(dialog);
            
            // 取消按钮
            content.querySelector('#settings-cancel').addEventListener('click', () => {
                document.body.removeChild(dialog);
            });
            
            // 保存按钮
            content.querySelector('#settings-save').addEventListener('click', async () => {
                const selected = content.querySelector('input[name="displayMode"]:checked');
                if (selected) {
                    const newUseNotification = selected.value === 'notification';
                    
                    // 如果设置改变，需要切换显示方式
                    if (newUseNotification !== this._useNotification) {
                        // 移除旧的
                        if (this._useNotification) {
                            this._removeNotificationDependent();
                        } else {
                            this._removeDesktopComponent();
                        }
                        
                        // 更新设置
                        this._useNotification = newUseNotification;
                        await this._saveSettings();
                        
                        // 创建新的
                        if (this._useNotification) {
                            this._createNotificationDependent();
                        } else {
                            this._createDesktopComponent();
                        }
                    } else {
                        // 只保存设置
                        this._useNotification = newUseNotification;
                        await this._saveSettings();
                    }
                }
                
                document.body.removeChild(dialog);
            });
        },
        
        // 创建通知依赖
        _createNotificationDependent: function() {
            if (typeof NotificationManager === 'undefined') {
                console.warn('[MusicPlayer] NotificationManager 不可用');
                return;
            }
            
            try {
                const currentSong = this._currentSong;
                const songName = currentSong ? (currentSong.name || '未知歌曲') : '未播放';
                const artistName = currentSong ? (currentSong.artist || '未知艺术家') : '';
                
                // 创建通知内容容器（简化布局）
                const content = document.createElement('div');
                content.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 0;
                    width: 100%;
                    box-sizing: border-box;
                    min-height: 100px;
                `;
                
                // 封面
                const cover = document.createElement('img');
                cover.src = currentSong && (currentSong.cover || currentSong.pic) ? (currentSong.cover || currentSong.pic) : '';
                cover.style.cssText = `
                    width: 80px;
                    height: 80px;
                    border-radius: 10px;
                    object-fit: cover;
                    background: rgba(42, 42, 42, 0.8);
                    flex-shrink: 0;
                `;
                cover.onerror = () => {
                    cover.style.display = 'none';
                };
                content.appendChild(cover);
                
                // 信息和控制区域
                const rightSection = document.createElement('div');
                rightSection.style.cssText = `
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    justify-content: center;
                `;
                
                // 信息区域
                const info = document.createElement('div');
                info.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0;
                `;
                info.innerHTML = `
                    <div style="font-size: 15px; font-weight: 500; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${songName}
                    </div>
                    <div style="font-size: 13px; color: rgba(255, 255, 255, 0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${artistName}
                    </div>
                `;
                rightSection.appendChild(info);
                
                // 控制按钮和进度条
                const controlsRow = document.createElement('div');
                controlsRow.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;
                
                // 控制按钮
                const controls = document.createElement('div');
                controls.style.cssText = `
                    display: flex;
                    gap: 6px;
                    align-items: center;
                    flex-shrink: 0;
                `;
                
                // 上一首按钮
                const prevBtn = document.createElement('button');
                prevBtn.innerHTML = '⏮';
                prevBtn.style.cssText = `
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: #e0e0e0;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                `;
                prevBtn.onmouseenter = () => {
                    prevBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                };
                prevBtn.onmouseleave = () => {
                    prevBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                };
                prevBtn.onclick = () => this._playPrevious();
                controls.appendChild(prevBtn);
                
                // 播放/暂停按钮
                const playBtn = document.createElement('button');
                playBtn.innerHTML = this._isPlaying ? '⏸' : '▶';
                playBtn.style.cssText = `
                    width: 48px;
                    height: 48px;
                    border: none;
                    background: #ec4141;
                    color: #ffffff;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                `;
                playBtn.onmouseenter = () => {
                    playBtn.style.background = '#d63031';
                };
                playBtn.onmouseleave = () => {
                    playBtn.style.background = '#ec4141';
                };
                playBtn.onclick = () => this._togglePlay();
                // 保存播放按钮引用以便更新
                playBtn.className = 'music-notification-play-btn';
                controls.appendChild(playBtn);
                
                // 下一首按钮
                const nextBtn = document.createElement('button');
                nextBtn.innerHTML = '⏭';
                nextBtn.style.cssText = `
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: #e0e0e0;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                `;
                nextBtn.onmouseenter = () => {
                    nextBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                };
                nextBtn.onmouseleave = () => {
                    nextBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                };
                nextBtn.onclick = () => this._playNext();
                controls.appendChild(nextBtn);
                
                controlsRow.appendChild(controls);
                
                // 进度条
                const progressContainer = document.createElement('div');
                progressContainer.style.cssText = `
                    flex: 1;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                    position: relative;
                    min-width: 80px;
                `;
                const progressBar = document.createElement('div');
                progressBar.className = 'music-notification-progress';
                progressBar.style.cssText = `
                    height: 100%;
                    width: ${this._audio && this._audio.duration ? (this._audio.currentTime / this._audio.duration * 100) : 0}%;
                    background: #ec4141;
                    border-radius: 2px;
                    transition: width 0.3s ease;
                `;
                progressContainer.appendChild(progressBar);
                controlsRow.appendChild(progressContainer);
                
                rightSection.appendChild(controlsRow);
                content.appendChild(rightSection);
                
                // 保存进度条引用以便更新
                content._progressBar = progressBar;
                
                // 创建通知依赖
                this._notificationId = NotificationManager.createNotification(this.pid, {
                    type: 'dependent',
                    title: '正在播放',
                    content: content,
                    onClose: (notificationId, pid) => {
                        // 通知被关闭时的回调
                        console.log('[MusicPlayer] 通知被关闭');
                        this._notificationId = null;
                    }
                });
                
                console.log('[MusicPlayer] 创建通知依赖:', this._notificationId);
            } catch (e) {
                console.error('[MusicPlayer] 创建通知依赖失败:', e);
            }
        },
        
        // 移除通知依赖
        _removeNotificationDependent: function() {
            if (this._notificationId && typeof NotificationManager !== 'undefined') {
                try {
                    NotificationManager.removeNotification(this._notificationId, true);
                    this._notificationId = null;
                } catch (e) {
                    console.error('[MusicPlayer] 删除通知依赖失败:', e);
                }
            }
        },
        
        // 更新通知依赖
        _updateNotificationDependent: function() {
            if (!this._notificationId || typeof NotificationManager === 'undefined') {
                return;
            }
            
            try {
                const container = NotificationManager.getNotificationContentContainer(this._notificationId);
                if (!container) {
                    return;
                }
                
                const currentSong = this._currentSong;
                const songName = currentSong ? (currentSong.name || '未知歌曲') : '未播放';
                const artistName = currentSong ? (currentSong.artist || '未知艺术家') : '';
                
                // 更新封面
                const cover = container.querySelector('img');
                if (cover) {
                    if (currentSong && (currentSong.cover || currentSong.pic)) {
                        cover.src = currentSong.cover || currentSong.pic;
                        cover.style.display = 'block';
                    } else {
                        cover.src = '';
                        cover.style.display = 'none';
                    }
                }
                
                // 更新歌曲信息（查找 rightSection 中的 info div）
                const rightSection = Array.from(container.children).find(child => 
                    child.tagName === 'DIV' && child.querySelector('div')
                );
                if (rightSection) {
                    const infoDiv = rightSection.querySelector('div:first-child');
                    if (infoDiv) {
                        const songNameDiv = infoDiv.querySelector('div:first-child');
                        const artistNameDiv = infoDiv.querySelector('div:last-child');
                        if (songNameDiv) {
                            songNameDiv.textContent = songName;
                        }
                        if (artistNameDiv) {
                            artistNameDiv.textContent = artistName;
                        }
                    }
                    
                    // 更新播放按钮（使用类名查找更可靠）
                    const playBtn = container.querySelector('.music-notification-play-btn');
                    if (playBtn) {
                        playBtn.innerHTML = this._isPlaying ? '⏸' : '▶';
                    } else {
                        // 降级方案：使用原来的选择器
                        const controlsRow = rightSection.querySelector('div:last-child');
                        if (controlsRow) {
                            const controlsDiv = controlsRow.querySelector('div:first-child');
                            if (controlsDiv) {
                                const buttons = controlsDiv.querySelectorAll('button');
                                if (buttons.length >= 2) {
                                    const playBtnFallback = buttons[1]; // 播放按钮是第二个
                                    playBtnFallback.innerHTML = this._isPlaying ? '⏸' : '▶';
                                }
                            }
                        }
                    }
                }
                
                // 更新进度条
                const progressBar = container.querySelector('.music-notification-progress');
                if (progressBar && this._audio) {
                    const progress = this._audio.duration ? (this._audio.currentTime / this._audio.duration * 100) : 0;
                    progressBar.style.width = `${progress}%`;
                }
            } catch (e) {
                console.error('[MusicPlayer] 更新通知依赖失败:', e);
            }
        },
        
        _setupWindowSizeListener: function() {
            if (!this.window) return;
            
            // 初始大小
            this._updateWindowSize();
            
            // 监听窗口大小变化
            const resizeObserver = new ResizeObserver(() => {
                this._updateWindowSize();
            });
            
            resizeObserver.observe(this.window);
            
            // 也监听窗口的 resize 事件（作为备用）
            window.addEventListener('resize', () => {
                this._updateWindowSize();
            });
        },
        
        _updateWindowSize: function() {
            if (!this.window) return;
            
            const rect = this.window.getBoundingClientRect();
            this._windowSize = {
                width: rect.width,
                height: rect.height
            };
            
            // 为主窗口添加响应式类
            const container = this.window.querySelector('.musicplayer-container');
            if (container) {
                // 移除所有响应式类
                container.classList.remove('musicplayer-small', 'musicplayer-medium', 'musicplayer-mobile');
                
                // 根据窗口大小添加相应的类
                if (this._windowSize.width < 400) {
                    container.classList.add('musicplayer-mobile');
                } else if (this._windowSize.width < 600) {
                    container.classList.add('musicplayer-small');
                } else if (this._windowSize.width < 800) {
                    container.classList.add('musicplayer-medium');
                }
            }
            
            // 更新沉浸式播放UI的样式类
            if (this._immersiveView) {
                this._updateImmersiveViewLayout();
            }
        },
        
        _updateImmersiveViewLayout: function() {
            if (!this._immersiveView) return;
            
            // 根据窗口大小添加不同的样式类
            const isSmallWindow = this._windowSize.width < 800 || this._windowSize.height < 600;
            const isMobileLayout = this._windowSize.width < 600;
            
            if (isMobileLayout) {
                this._immersiveView.classList.add('immersive-mobile-layout');
                this._immersiveView.classList.remove('immersive-small-layout');
            } else if (isSmallWindow) {
                this._immersiveView.classList.add('immersive-small-layout');
                this._immersiveView.classList.remove('immersive-mobile-layout');
            } else {
                this._immersiveView.classList.remove('immersive-small-layout');
                this._immersiveView.classList.remove('immersive-mobile-layout');
            }
        },
        
        __info__: function() {
            return {
                name: '音乐播放器',
                version: '1.0.0',
                description: '高仿网易云音乐风格的在线音乐播放器',
                author: 'ZerOS',
                category: 'other'
            };
        },
        
        __exit__: function() {
            this._cleanup();
        }
    };
    
    // 导出到全局
    if (typeof window !== 'undefined') {
        window.MUSICPLAYER = MUSICPLAYER;
    } else if (typeof globalThis !== 'undefined') {
        globalThis.MUSICPLAYER = MUSICPLAYER;
    }
    
})(window);