// ZerOS 文件管理器
// 提供图形化的文件浏览、编辑和管理功能
// 注意：此程序必须禁止自动初始化，通过 ProcessManager 管理

(function(window) {
    'use strict';
    
    const FILEMANAGER = {
        pid: null,
        window: null,
        
        // 内存管理引用
        _heap: null,
        _shed: null,
        
        // 数据键名（存储在内存中）
        _currentPathKey: 'currentPath',
        _fileListKey: 'fileList',
        _selectedItemKey: 'selectedItem',
        _editingFileKey: 'editingFile',
        _editContentKey: 'editContent',
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 初始化内存管理
            this._initMemory(pid);
            
            // 默认显示根目录视图（显示所有磁盘分区）
            this._setCurrentPath(null);
            
            // 如果指定了初始路径，则使用指定路径
            if (initArgs && initArgs.args && initArgs.args.length > 0) {
                const specifiedPath = initArgs.args[0];
                // 只有在明确指定路径时才使用，否则保持根目录视图
                if (specifiedPath && specifiedPath !== '\\' && specifiedPath !== '') {
                    this._setCurrentPath(specifiedPath);
                }
            } else if (initArgs && initArgs.cwd) {
                const cwdPath = initArgs.cwd;
                if (cwdPath && cwdPath !== '\\' && cwdPath !== '') {
                    this._setCurrentPath(cwdPath);
                }
            }
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建主窗口
            this.window = document.createElement('div');
            this.window.className = 'filemanager-window zos-gui-window';
            this.window.dataset.pid = pid.toString();
            
            // 注意：窗口的基础样式由 GUIManager 管理，这里只设置必要的样式
            // 如果 GUIManager 不可用，则设置完整样式
            if (typeof GUIManager === 'undefined') {
                this.window.style.cssText = `
                    width: 900px;
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
                // GUIManager 可用时，只设置必要的样式
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
                    icon = ApplicationAssetManager.getIcon('filemanager');
                }
                
                GUIManager.registerWindow(pid, this.window, {
                    title: '文件管理器',
                    icon: icon,
                    onClose: () => {
                        if (typeof ProcessManager !== 'undefined') {
                            ProcessManager.killProgram(this.pid);
                        }
                    }
                });
            }
            
            // 创建顶部工具栏（Ubuntu风格）
            const topToolbar = this._createTopToolbar();
            this.topToolbar = topToolbar;  // 保存引用以便清理
            this.window.appendChild(topToolbar);
            
            // 创建主内容区域（Ubuntu风格：左侧边栏 + 主内容区）
            const content = document.createElement('div');
            content.className = 'filemanager-content';
            content.style.cssText = `
                flex: 1;
                display: flex;
                overflow: hidden;
                min-height: 0;
            `;
            
            // 创建左侧边栏（Ubuntu风格）
            const sidebar = this._createSidebar();
            this.sidebar = sidebar;  // 保存引用以便清理
            content.appendChild(sidebar);
            
            // 创建主内容区（文件列表区域）
            const mainContent = document.createElement('div');
            mainContent.className = 'filemanager-main-content';
            this.mainContent = mainContent;  // 保存引用以便清理
            mainContent.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                min-width: 0;
            `;
            
            // 创建地址栏（Ubuntu风格，在主内容区顶部）
            const addressBar = this._createAddressBar();
            mainContent.appendChild(addressBar);
            
            // 创建文件列表
            const fileList = this._createFileList();
            mainContent.appendChild(fileList);
            
            content.appendChild(mainContent);
            
            // 创建属性面板（初始隐藏，Ubuntu风格在右侧）
            const propertiesPanel = this._createPropertiesPanel();
            content.appendChild(propertiesPanel);
            
            // 创建编辑面板（初始隐藏）
            const editPanel = this._createEditPanel();
            content.appendChild(editPanel);
            
            this.window.appendChild(content);
            
            // 添加到容器
            guiContainer.appendChild(this.window);
            
            // 注册右键菜单
            this._registerContextMenu();
            
            // 加载当前目录（如果是null，则加载根目录视图）
            const currentPath = this._getCurrentPath();
            if (currentPath === null || currentPath === '') {
                await this._loadRootDirectory();
            } else {
                await this._loadDirectory(currentPath);
            }
            
            // 如果使用GUIManager，窗口已自动居中并获得焦点
            if (typeof GUIManager !== 'undefined') {
                GUIManager.focusWindow(pid);
            }
        },
        
        /**
         * 创建顶部工具栏（Ubuntu风格）
         */
        _createTopToolbar: function() {
            const toolbar = document.createElement('div');
            toolbar.className = 'filemanager-top-toolbar';
            toolbar.style.cssText = `
                height: 48px;
                min-height: 48px;
                max-height: 48px;
                padding: 8px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(30, 30, 30, 0.6);
                backdrop-filter: blur(10px);
                box-sizing: border-box;
                flex-shrink: 0;
                overflow: hidden;
            `;
            
            // 后退按钮
            const backBtn = this._createToolbarButton('←', '后退', () => {
                // TODO: 实现后退历史
            });
            toolbar.appendChild(backBtn);
            
            // 前进按钮
            const forwardBtn = this._createToolbarButton('→', '前进', () => {
                // TODO: 实现前进历史
            });
            forwardBtn.style.opacity = '0.5';
            forwardBtn.style.cursor = 'not-allowed';
            toolbar.appendChild(forwardBtn);
            
            // 返回上级按钮
            const upBtn = this._createToolbarButton('↑', '返回上级目录', () => {
                this._goUp();
            });
            toolbar.appendChild(upBtn);
            
            // 分隔符
            const separator1 = document.createElement('div');
            separator1.style.cssText = `
                width: 1px;
                height: 24px;
                background: rgba(255, 255, 255, 0.15);
                margin: 0 4px;
            `;
            toolbar.appendChild(separator1);
            
            // 刷新按钮
            const refreshBtn = this._createToolbarButton('↻', '刷新', () => {
                const currentPath = this._getCurrentPath();
                if (currentPath === null || currentPath === '') {
                    this._loadRootDirectory();
                } else {
                    this._loadDirectory(currentPath);
                }
            });
            toolbar.appendChild(refreshBtn);
            
            // 分隔符
            const separator2 = document.createElement('div');
            separator2.style.cssText = separator1.style.cssText;
            toolbar.appendChild(separator2);
            
            // 新建文件按钮
            const newFileBtn = this._createToolbarButton('+ 文件', '新建文件', () => {
                this._createNewFile();
            }, true);
            toolbar.appendChild(newFileBtn);
            
            // 新建目录按钮
            const newDirBtn = this._createToolbarButton('+ 目录', '新建目录', () => {
                this._createNewDirectory();
            }, true);
            toolbar.appendChild(newDirBtn);
            
            return toolbar;
        },
        
        /**
         * 创建工具栏按钮（辅助方法）
         */
        _createToolbarButton: function(text, title, onClick, isTextButton = false) {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.title = title;
            if (isTextButton) {
                btn.style.cssText = `
                    padding: 6px 12px;
                    height: 32px;
                    min-height: 32px;
                    max-height: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.05);
                    color: #e8ecf0;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                    box-sizing: border-box;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
            } else {
                btn.style.cssText = `
                    width: 32px;
                    height: 32px;
                    min-width: 32px;
                    min-height: 32px;
                    max-width: 32px;
                    max-height: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.05);
                    color: #e8ecf0;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    flex-shrink: 0;
                `;
            }
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.1)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.05)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            });
            btn.addEventListener('click', onClick);
            return btn;
        },
        
        /**
         * 创建左侧边栏（Ubuntu风格）
         */
        _createSidebar: function() {
            const sidebar = document.createElement('div');
            sidebar.className = 'filemanager-sidebar';
            sidebar.style.cssText = `
                width: 220px;
                min-width: 180px;
                max-width: 300px;
                background: rgba(25, 25, 25, 0.8);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                overflow-x: hidden;
            `;
            
            // 侧边栏标题
            const sidebarTitle = document.createElement('div');
            sidebarTitle.style.cssText = `
                padding: 12px 16px;
                font-size: 11px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            `;
            sidebarTitle.textContent = '位置';
            sidebar.appendChild(sidebarTitle);
            
            // 磁盘分区列表
            const diskList = document.createElement('div');
            diskList.className = 'filemanager-sidebar-disks';
            diskList.style.cssText = `
                padding: 4px 0;
            `;
            
            // 根目录项
            const rootItem = this._createSidebarItem('\\', '计算机', () => {
                this._loadRootDirectory();
            }, true);
            diskList.appendChild(rootItem);
            
            // 分隔线
            const separator = document.createElement('div');
            separator.style.cssText = `
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
                margin: 8px 16px;
            `;
            diskList.appendChild(separator);
            
            // 动态加载磁盘分区
            this._updateSidebarDisks(diskList);
            
            sidebar.appendChild(diskList);
            this.sidebar = sidebar;
            this.sidebarDiskList = diskList;
            return sidebar;
        },
        
        /**
         * 创建侧边栏项
         */
        _createSidebarItem: function(name, label, onClick, isActive = false) {
            const item = document.createElement('div');
            item.className = 'filemanager-sidebar-item';
            item.style.cssText = `
                padding: 8px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                color: ${isActive ? '#6c8eff' : '#e8ecf0'};
                background: ${isActive ? 'rgba(108, 142, 255, 0.15)' : 'transparent'};
                transition: all 0.2s;
                font-size: 14px;
            `;
            
            // 图标
            const icon = document.createElement('div');
            icon.style.cssText = `
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            `;
            const iconImg = document.createElement('img');
            iconImg.src = 'application/filemanager/assets/folder.svg';
            iconImg.style.cssText = 'width: 18px; height: 18px; opacity: 0.8;';
            iconImg.onerror = () => {
                iconImg.style.display = 'none';
            };
            icon.appendChild(iconImg);
            item.appendChild(icon);
            
            // 标签
            const labelEl = document.createElement('span');
            labelEl.textContent = label;
            item.appendChild(labelEl);
            
            item.addEventListener('mouseenter', () => {
                if (!isActive) {
                    item.style.background = 'rgba(255, 255, 255, 0.05)';
                }
            });
            item.addEventListener('mouseleave', () => {
                if (!isActive) {
                    item.style.background = 'transparent';
                }
            });
            item.addEventListener('click', onClick);
            
            return item;
        },
        
        /**
         * 更新侧边栏磁盘列表
         */
        _updateSidebarDisks: function(diskList) {
            // 清除现有磁盘项（保留根目录项和分隔线）
            const itemsToRemove = [];
            for (let i = 2; i < diskList.children.length; i++) {
                itemsToRemove.push(diskList.children[i]);
            }
            itemsToRemove.forEach(item => item.remove());
            
            // 获取所有磁盘分区
            const disks = [];
            if (typeof Disk !== 'undefined' && typeof Disk._getDiskSeparateMap === 'function') {
                try {
                    const diskMap = Disk._getDiskSeparateMap();
                    if (diskMap && diskMap.size > 0) {
                        for (const [diskName, coll] of diskMap) {
                            if (coll && typeof coll === 'object') {
                                disks.push(diskName);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('获取磁盘分区失败:', e);
                }
            }
            
            // 如果 Disk API 不可用，尝试从 POOL 获取
            if (disks.length === 0 && typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                const knownDisks = ['C:', 'D:'];
                for (const diskName of knownDisks) {
                    try {
                        const coll = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                        if (coll && typeof coll === 'object') {
                            disks.push(diskName);
                        }
                    } catch (e) {
                        // 忽略
                    }
                }
            }
            
            // 排序并添加磁盘项
            disks.sort();
            for (const diskName of disks) {
                const currentPath = this._getCurrentPath();
                const isActive = currentPath === diskName;
                const diskItem = this._createSidebarItem(diskName, diskName, () => {
                    this._loadDirectory(diskName);
                }, isActive);
                diskList.appendChild(diskItem);
            }
        },
        
        /**
         * 创建工具栏（保留原方法名以兼容）
         */
        _createToolbar: function() {
            const toolbar = document.createElement('div');
            toolbar.className = 'filemanager-toolbar';
            toolbar.style.cssText = `
                height: 40px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(108, 142, 255, 0.05);
            `;
            
            // 返回上级按钮
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            upBtn.title = '返回上级目录';
            upBtn.style.cssText = `
                width: 32px;
                height: 32px;
                border: 1px solid rgba(108, 142, 255, 0.3);
                background: rgba(108, 142, 255, 0.1);
                color: #e8ecf0;
                border-radius: 6px;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
            `;
            upBtn.addEventListener('mouseenter', () => {
                upBtn.style.background = 'rgba(108, 142, 255, 0.2)';
                upBtn.style.borderColor = '#6c8eff';
            });
            upBtn.addEventListener('mouseleave', () => {
                upBtn.style.background = 'rgba(108, 142, 255, 0.1)';
                upBtn.style.borderColor = 'rgba(108, 142, 255, 0.3)';
            });
            upBtn.addEventListener('click', () => {
                this._goUp();
            });
            toolbar.appendChild(upBtn);
            
            // 刷新按钮
            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = '↻';
            refreshBtn.title = '刷新';
            refreshBtn.style.cssText = upBtn.style.cssText;
            refreshBtn.addEventListener('mouseenter', () => {
                refreshBtn.style.background = 'rgba(108, 142, 255, 0.2)';
                refreshBtn.style.borderColor = '#6c8eff';
            });
            refreshBtn.addEventListener('mouseleave', () => {
                refreshBtn.style.background = 'rgba(108, 142, 255, 0.1)';
                refreshBtn.style.borderColor = 'rgba(108, 142, 255, 0.3)';
            });
            refreshBtn.addEventListener('click', () => {
                const currentPath = this._getCurrentPath();
                if (currentPath === null || currentPath === '') {
                    this._loadRootDirectory();
                } else {
                    this._loadDirectory(currentPath);
                }
            });
            toolbar.appendChild(refreshBtn);
            
            // 分隔符
            const separator = document.createElement('div');
            separator.style.cssText = `
                width: 1px;
                height: 24px;
                background: rgba(108, 142, 255, 0.2);
                margin: 0 8px;
            `;
            toolbar.appendChild(separator);
            
            // 新建文件按钮
            const newFileBtn = document.createElement('button');
            newFileBtn.textContent = '+ 文件';
            newFileBtn.title = '新建文件';
            newFileBtn.style.cssText = `
                padding: 6px 12px;
                height: 32px;
                border: 1px solid rgba(108, 142, 255, 0.3);
                background: rgba(108, 142, 255, 0.1);
                color: #e8ecf0;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            `;
            newFileBtn.addEventListener('mouseenter', () => {
                newFileBtn.style.background = 'rgba(108, 142, 255, 0.2)';
                newFileBtn.style.borderColor = '#6c8eff';
            });
            newFileBtn.addEventListener('mouseleave', () => {
                newFileBtn.style.background = 'rgba(108, 142, 255, 0.1)';
                newFileBtn.style.borderColor = 'rgba(108, 142, 255, 0.3)';
            });
            newFileBtn.addEventListener('click', () => {
                this._createNewFile();
            });
            toolbar.appendChild(newFileBtn);
            
            // 新建目录按钮
            const newDirBtn = document.createElement('button');
            newDirBtn.textContent = '+ 目录';
            newDirBtn.title = '新建目录';
            newDirBtn.style.cssText = newFileBtn.style.cssText;
            newDirBtn.addEventListener('mouseenter', () => {
                newDirBtn.style.background = 'rgba(108, 142, 255, 0.2)';
                newDirBtn.style.borderColor = '#6c8eff';
            });
            newDirBtn.addEventListener('mouseleave', () => {
                newDirBtn.style.background = 'rgba(108, 142, 255, 0.1)';
                newDirBtn.style.borderColor = 'rgba(108, 142, 255, 0.3)';
            });
            newDirBtn.addEventListener('click', () => {
                this._createNewDirectory();
            });
            toolbar.appendChild(newDirBtn);
            
            return toolbar;
        },
        
        /**
         * 创建地址栏
         */
        _createAddressBar: function() {
            const addressBar = document.createElement('div');
            addressBar.className = 'filemanager-addressbar';
            addressBar.style.cssText = `
                height: 36px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                border-bottom: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(108, 142, 255, 0.03);
            `;
            
            // 地址栏图标
            const addressIcon = document.createElement('div');
            addressIcon.style.cssText = `
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
            `;
            const iconImg = document.createElement('img');
            iconImg.src = 'application/filemanager/assets/folder.svg';
            iconImg.style.cssText = 'width: 16px; height: 16px;';
            iconImg.onerror = () => {
                iconImg.style.display = 'none';
            };
            addressIcon.appendChild(iconImg);
            addressBar.appendChild(addressIcon);
            
            const addressInput = document.createElement('input');
            addressInput.type = 'text';
            addressInput.className = 'filemanager-address-input';
            addressInput.value = this.currentPath || '\\';  // 根目录显示为 \
            addressInput.style.cssText = `
                flex: 1;
                height: 32px;
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                color: #e8ecf0;
                font-size: 13px;
                outline: none;
                transition: all 0.2s;
            `;
            addressInput.addEventListener('focus', () => {
                addressInput.style.borderColor = 'rgba(108, 142, 255, 0.5)';
                addressInput.style.background = 'rgba(255, 255, 255, 0.08)';
            });
            addressInput.addEventListener('blur', () => {
                addressInput.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                addressInput.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            addressInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const path = addressInput.value.trim();
                    if (path === '\\' || path === '') {
                        this._loadRootDirectory();
                    } else if (path) {
                        this._navigateToPath(path);
                    }
                }
            });
            this.addressInput = addressInput;
            addressBar.appendChild(addressInput);
            
            return addressBar;
        },
        
        /**
         * 创建文件列表
         */
        _createFileList: function() {
            const fileList = document.createElement('div');
            fileList.className = 'filemanager-filelist';
            fileList.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                background: rgba(15, 20, 35, 0.5);
            `;
            
            // 添加滚动条样式
            fileList.style.scrollbarWidth = 'thin';
            fileList.style.scrollbarColor = 'rgba(108, 142, 255, 0.3) rgba(15, 20, 35, 0.5)';
            
            this.fileListElement = fileList;
            return fileList;
        },
        
        /**
         * 创建编辑面板
         */
        _createEditPanel: function() {
            const editPanel = document.createElement('div');
            editPanel.className = 'filemanager-editpanel';
            editPanel.style.cssText = `
                width: 0;
                display: none;
                flex-direction: column;
                border-left: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(15, 20, 35, 0.7);
                transition: width 0.3s;
            `;
            
            // 编辑面板标题栏
            const editHeader = document.createElement('div');
            editHeader.style.cssText = `
                height: 40px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(108, 142, 255, 0.05);
            `;
            
            const editTitle = document.createElement('div');
            editTitle.className = 'filemanager-edit-title';
            editTitle.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                color: #e8ecf0;
            `;
            editTitle.textContent = '编辑文件';
            editHeader.appendChild(editTitle);
            
            const editActions = document.createElement('div');
            editActions.style.cssText = `
                display: flex;
                gap: 8px;
            `;
            
            // 保存按钮
            const saveBtn = document.createElement('button');
            saveBtn.textContent = '保存';
            saveBtn.style.cssText = `
                padding: 4px 12px;
                height: 28px;
                border: 1px solid rgba(74, 222, 128, 0.5);
                background: rgba(74, 222, 128, 0.1);
                color: #4ade80;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            `;
            saveBtn.addEventListener('mouseenter', () => {
                saveBtn.style.background = 'rgba(74, 222, 128, 0.2)';
                saveBtn.style.borderColor = '#4ade80';
            });
            saveBtn.addEventListener('mouseleave', () => {
                saveBtn.style.background = 'rgba(74, 222, 128, 0.1)';
                saveBtn.style.borderColor = 'rgba(74, 222, 128, 0.5)';
            });
            saveBtn.addEventListener('click', () => {
                this._saveEditingFile();
            });
            editActions.appendChild(saveBtn);
            
            // 关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid rgba(255, 68, 68, 0.5);
                background: rgba(255, 68, 68, 0.1);
                color: #ff4444;
                border-radius: 6px;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(255, 68, 68, 0.2)';
                closeBtn.style.borderColor = '#ff4444';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255, 68, 68, 0.1)';
                closeBtn.style.borderColor = 'rgba(255, 68, 68, 0.5)';
            });
            closeBtn.addEventListener('click', () => {
                this._closeEditPanel();
            });
            editActions.appendChild(closeBtn);
            
            editHeader.appendChild(editActions);
            editPanel.appendChild(editHeader);
            
            // 编辑区域
            const editArea = document.createElement('textarea');
            editArea.className = 'filemanager-edit-area';
            editArea.style.cssText = `
                flex: 1;
                padding: 12px;
                background: rgba(15, 20, 35, 0.8);
                border: none;
                color: #e8ecf0;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 14px;
                line-height: 1.6;
                resize: none;
                outline: none;
            `;
            this.editArea = editArea;
            editPanel.appendChild(editArea);
            
            this.editPanel = editPanel;
            return editPanel;
        },
        
        /**
         * 创建属性面板
         */
        _createPropertiesPanel: function() {
            const propertiesPanel = document.createElement('div');
            propertiesPanel.className = 'filemanager-propertiespanel';
            propertiesPanel.style.cssText = `
                width: 0;
                display: none;
                flex-direction: column;
                border-left: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(15, 20, 35, 0.7);
                transition: width 0.3s;
                overflow: hidden;
            `;
            
            // 属性面板标题栏
            const propHeader = document.createElement('div');
            propHeader.style.cssText = `
                height: 40px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(108, 142, 255, 0.2);
                background: rgba(108, 142, 255, 0.05);
            `;
            
            const propTitle = document.createElement('div');
            propTitle.className = 'filemanager-properties-title';
            propTitle.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                color: #e8ecf0;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            // 使用SVG图标
            const titleIcon = document.createElement('img');
            titleIcon.src = 'application/filemanager/assets/info.svg';
            titleIcon.style.cssText = 'width: 16px; height: 16px; opacity: 0.8;';
            titleIcon.onerror = () => {
                titleIcon.style.display = 'none';
            };
            propTitle.appendChild(titleIcon);
            
            const titleText = document.createElement('span');
            titleText.textContent = '属性';
            propTitle.appendChild(titleText);
            propHeader.appendChild(propTitle);
            
            // 关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid rgba(255, 68, 68, 0.5);
                background: rgba(255, 68, 68, 0.1);
                color: #ff4444;
                border-radius: 6px;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(255, 68, 68, 0.2)';
                closeBtn.style.borderColor = '#ff4444';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255, 68, 68, 0.1)';
                closeBtn.style.borderColor = 'rgba(255, 68, 68, 0.5)';
            });
            closeBtn.addEventListener('click', () => {
                this._closePropertiesPanel();
            });
            propHeader.appendChild(closeBtn);
            propertiesPanel.appendChild(propHeader);
            
            // 属性内容区域
            const propContent = document.createElement('div');
            propContent.className = 'filemanager-properties-content';
            propContent.style.cssText = `
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                color: #e8ecf0;
                font-size: 13px;
            `;
            this.propertiesContent = propContent;
            propertiesPanel.appendChild(propContent);
            
            this.propertiesPanel = propertiesPanel;
            return propertiesPanel;
        },
        
        /**
         * 显示属性面板
         */
        _showProperties: async function(item) {
            if (!this.propertiesPanel || !this.propertiesContent) {
                return;
            }
            
            // 显示属性面板
            this.propertiesPanel.style.display = 'flex';
            this.propertiesPanel.style.width = '300px';
            
            // 清空内容
            this.propertiesContent.innerHTML = '';
            
            try {
                // 获取文件系统集合
                let COLL = null;
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    const diskName = item.path.split(':')[0] + ':';
                    COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                }
                
                if (!COLL) {
                    this.propertiesContent.innerHTML = '<div style="color: #ff4444;">无法访问文件系统</div>';
                    return;
                }
                
                // 构建属性HTML
                let html = '';
                
                // 基本信息
                html += '<div style="margin-bottom: 20px;">';
                html += '<div style="font-weight: 600; margin-bottom: 12px; color: #6c8eff; font-size: 14px;">基本信息</div>';
                html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">名称:</span> <span style="margin-left: 8px;">${this._escapeHtml(item.name)}</span></div>`;
                html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">类型:</span> <span style="margin-left: 8px;">${item.type === 'directory' ? '目录' : '文件'}</span></div>`;
                html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">路径:</span> <div style="margin-left: 8px; margin-top: 4px; word-break: break-all; color: #d7e0dd;">${this._escapeHtml(item.path)}</div></div>`;
                html += '</div>';
                
                if (item.type === 'file') {
                    // 文件信息
                    html += '<div style="margin-bottom: 20px;">';
                    html += '<div style="font-weight: 600; margin-bottom: 12px; color: #6c8eff; font-size: 14px;">文件信息</div>';
                    html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">大小:</span> <span style="margin-left: 8px;">${this._formatSize(item.size || 0)}</span></div>`;
                    
                    // 文件类型
                    const fileType = item.fileType || 'TEXT';
                    html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">文件类型:</span> <span style="margin-left: 8px;">${fileType}</span></div>`;
                    
                    // 使用已保存的文件对象信息（如果可用）
                    let fileObj = item.fileObj;
                    if (!fileObj) {
                        // 降级方案：从文件系统获取
                        const parentPath = item.path.split('/').slice(0, -1).join('/') || (item.path.split(':')[0] + ':');
                        const node = COLL.getNode(parentPath);
                        if (node && node.attributes && node.attributes[item.name]) {
                            fileObj = node.attributes[item.name];
                        }
                    }
                    
                    if (fileObj) {
                        // 创建时间
                        const createTime = item.fileCreatTime || fileObj.fileCreatTime;
                        if (createTime) {
                            const createDate = new Date(createTime);
                            html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">创建时间:</span> <span style="margin-left: 8px;">${this._formatDate(createDate)}</span></div>`;
                        }
                        
                        // 修改时间
                        const modifyTime = item.fileModifyTime || fileObj.fileModifyTime;
                        if (modifyTime) {
                            const modifyDate = new Date(modifyTime);
                            html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">修改时间:</span> <span style="margin-left: 8px;">${this._formatDate(modifyDate)}</span></div>`;
                        }
                        
                        // 文件属性
                        const fileAttributes = item.fileAttributes !== undefined ? item.fileAttributes : fileObj.fileAttributes;
                        if (fileAttributes !== undefined) {
                            html += '<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">属性:</span> <div style="margin-left: 8px; margin-top: 4px;">';
                            const attrs = [];
                            if (fileAttributes & 1) attrs.push('只读');
                            if (fileAttributes & 2) attrs.push('不可读');
                            if (fileAttributes & 4) attrs.push('不可删除');
                            if (fileAttributes & 8) attrs.push('不可移动');
                            if (fileAttributes & 16) attrs.push('不可重命名');
                            html += attrs.length > 0 ? attrs.join(', ') : '正常';
                            html += '</div></div>';
                        }
                    }
                    html += '</div>';
                } else {
                    // 目录信息
                    html += '<div style="margin-bottom: 20px;">';
                    html += '<div style="font-weight: 600; margin-bottom: 12px; color: #6c8eff; font-size: 14px;">目录信息</div>';
                    
                    // 统计目录中的文件和子目录数量
                    // 注意：list_dir 和 list_file 返回的是对象数组
                    const dirsResult = COLL.list_dir(item.path) || [];
                    const filesResult = COLL.list_file(item.path) || [];
                    html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">子目录:</span> <span style="margin-left: 8px;">${dirsResult.length}</span></div>`;
                    html += `<div style="margin-bottom: 8px;"><span style="color: #aab2c0;">文件:</span> <span style="margin-left: 8px;">${filesResult.length}</span></div>`;
                    html += '</div>';
                }
                
                this.propertiesContent.innerHTML = html;
                
            } catch (error) {
                console.error('加载属性失败:', error);
                this.propertiesContent.innerHTML = `<div style="color: #ff4444;">加载属性失败: ${error.message}</div>`;
            }
        },
        
        /**
         * 关闭属性面板
         */
        _closePropertiesPanel: function() {
            if (this.propertiesPanel) {
                this.propertiesPanel.style.width = '0';
                setTimeout(() => {
                    this.propertiesPanel.style.display = 'none';
                }, 300);
            }
        },
        
        /**
         * HTML转义
         */
        _escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        /**
         * 格式化日期
         */
        _formatDate: function(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        },
        
        /**
         * 加载根目录（显示所有磁盘分区）
         */
        _loadRootDirectory: async function() {
            try {
                this._setCurrentPath(null);
                if (this.addressInput) {
                    this.addressInput.value = '\\';
                }
                
                // 获取所有磁盘分区
                let fileList = [];
                
                // 方法1：尝试从 Disk API 获取
                if (typeof Disk !== 'undefined' && typeof Disk._getDiskSeparateMap === 'function') {
                    try {
                        const diskMap = Disk._getDiskSeparateMap();
                        if (diskMap && diskMap.size > 0) {
                            for (const [diskName, coll] of diskMap) {
                                if (coll && typeof coll === 'object') {
                                    fileList.push({
                                        name: diskName,
                                        type: 'directory',
                                        path: diskName,
                                        isRoot: true  // 标记为根目录项
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('从 Disk._getDiskSeparateMap 获取分区失败:', e);
                    }
                }
                
                // 方法2：如果方法1没有结果，尝试从POOL直接获取
                // 注意：即使方法1有结果，也检查方法2，确保所有磁盘都被列出
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    // 尝试获取已知的分区
                    const knownDisks = ['C:', 'D:'];
                    for (const diskName of knownDisks) {
                        // 检查是否已经在列表中
                        const alreadyInList = fileList.some(item => item.name === diskName);
                        if (alreadyInList) {
                            continue; // 已存在，跳过
                        }
                        
                        try {
                            const coll = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                            if (coll && typeof coll === 'object') {
                                // 验证集合是否已初始化
                                if (coll.initialized !== false) {
                                    fileList.push({
                                        name: diskName,
                                        type: 'directory',
                                        path: diskName,
                                        isRoot: true
                                    });
                                    console.log(`[FileManager] 成功添加磁盘分区: ${diskName}`);
                                } else {
                                    console.warn(`[FileManager] 磁盘分区 ${diskName} 未初始化`);
                                }
                            }
                        } catch (e) {
                            // 记录错误但不阻止其他磁盘的加载
                            console.warn(`[FileManager] 无法获取分区 ${diskName}:`, e);
                        }
                    }
                }
                
                // 如果仍然没有结果，至少显示一个提示
                if (fileList.length === 0) {
                    console.warn('未找到任何磁盘分区');
                }
                
                // 按名称排序（确保 name 是字符串）
                fileList.sort((a, b) => {
                    const nameA = String(a && a.name !== undefined ? a.name : '');
                    const nameB = String(b && b.name !== undefined ? b.name : '');
                    return nameA.localeCompare(nameB);
                });
                
                // 保存文件列表
                this._setFileList(fileList);
                
                // 渲染文件列表
                this._renderFileList();
                
                // 更新侧边栏选中状态
                this._updateSidebarSelection();
                
            } catch (error) {
                console.error('加载根目录失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`加载根目录失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`加载根目录失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 加载目录
         */
        _loadDirectory: async function(path) {
            try {
                // 如果路径为空或根目录，加载根目录视图
                if (!path || path === '\\' || path === '') {
                    await this._loadRootDirectory();
                    return;
                }
                
                this._setCurrentPath(path);
                if (this.addressInput) {
                    this.addressInput.value = path;
                }
                
                // 获取文件系统集合
                let COLL = null;
                const diskName = path.split(':')[0] + ':';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    try {
                        COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                    } catch (e) {
                        console.error(`获取磁盘 ${diskName} 失败:`, e);
                    }
                }
                
                if (!COLL) {
                    console.error(`无法获取文件系统集合: ${diskName}, path: ${path}`);
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问路径: ${path}\n磁盘 ${diskName} 可能不存在或未初始化`, '错误', 'error');
                    } else {
                        alert(`无法访问路径: ${path}\n磁盘 ${diskName} 可能不存在或未初始化`);
                    }
                    return;
                }
                
                // 检查 COLL 是否已初始化
                if (COLL.initialized === false) {
                    console.warn(`文件系统集合 ${diskName} 未初始化`);
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`磁盘 ${diskName} 未初始化`, '错误', 'error');
                    } else {
                        alert(`磁盘 ${diskName} 未初始化`);
                    }
                    return;
                }
                
                // 获取目录和文件列表
                // 注意：list_dir 和 list_file 返回的是对象数组，不是字符串数组
                // 对于磁盘根目录（如 D:），路径应该就是磁盘名称本身
                let dirsResult, filesResult;
                
                // 首先检查节点是否存在
                // 对于磁盘根目录，路径应该就是磁盘名称（如 "D:"）
                let actualPath = path;
                let targetNode = COLL.getNode(path);
                
                // 如果节点不存在且是磁盘根目录，尝试使用 separateName 作为路径
                if (!targetNode && path === diskName) {
                    // 检查 separateName 是否与路径匹配
                    if (COLL.separateName && COLL.separateName === diskName) {
                        // 尝试使用 separateName 作为路径
                        targetNode = COLL.getNode(COLL.separateName);
                        if (targetNode) {
                            console.log(`[FileManager] 使用 separateName 找到根节点: ${COLL.separateName}`);
                            actualPath = COLL.separateName; // 更新实际使用的路径
                        }
                    }
                    
                    // 如果仍然找不到，输出调试信息
                    if (!targetNode && COLL.nodes) {
                        const nodeKeys = Array.from(COLL.nodes.keys());
                        console.warn(`[FileManager] 根节点不存在: path=${path}, diskName=${diskName}, separateName=${COLL.separateName || 'N/A'}, nodes keys:`, nodeKeys);
                        
                        // 尝试查找是否有类似的路径（大小写不敏感）
                        const matchingKey = nodeKeys.find(key => key.toLowerCase() === path.toLowerCase());
                        if (matchingKey) {
                            console.log(`[FileManager] 找到大小写不匹配的路径: ${matchingKey}, 使用它`);
                            targetNode = COLL.getNode(matchingKey);
                            actualPath = matchingKey; // 更新实际使用的路径
                        }
                    }
                }
                
                if (!targetNode) {
                    console.error(`[FileManager] 节点不存在: path=${path}, diskName=${diskName}, separateName=${COLL.separateName || 'N/A'}`);
                    dirsResult = [];
                    filesResult = [];
                } else {
                    try {
                        // 使用实际路径（可能是 separateName）来获取列表
                        dirsResult = COLL.list_dir(actualPath) || [];
                        filesResult = COLL.list_file(actualPath) || [];
                    } catch (e) {
                        console.error(`[FileManager] 加载目录失败 (path: ${path}, actualPath: ${actualPath}, diskName: ${diskName}):`, e);
                        dirsResult = [];
                        filesResult = [];
                    }
                }
                
                // 调试信息
                if (typeof KernelLogger !== 'undefined') {
                    KernelLogger.debug("FileManager", `加载目录: path=${path}, actualPath=${actualPath}, diskName=${diskName}, separateName=${COLL.separateName || 'N/A'}, nodeExists=${!!targetNode}, dirs=${dirsResult.length}, files=${filesResult.length}`);
                } else {
                    console.log(`[FileManager] 加载目录: path=${path}, actualPath=${actualPath}, diskName=${diskName}, separateName=${COLL.separateName || 'N/A'}, nodeExists=${!!targetNode}, dirs=${dirsResult.length}, files=${filesResult.length}`);
                }
                
                // 构建文件列表
                let fileList = [];
                
                // 添加目录
                for (const dirItem of dirsResult) {
                    // dirItem 可能是对象 { name, path, type, node } 或字符串
                    let dirName, dirPath, dirNode;
                    
                    if (typeof dirItem === 'object' && dirItem !== null) {
                        // 对象格式
                        dirName = dirItem.name;
                        dirPath = dirItem.path || ((path === diskName) ? `${path}/${dirItem.name}` : `${path}/${dirItem.name}`);
                        dirNode = dirItem.node || COLL.getNode(dirPath);
                    } else if (typeof dirItem === 'string') {
                        // 字符串格式（降级处理）
                        dirName = dirItem;
                        dirPath = (path === diskName) ? `${path}/${dirItem}` : `${path}/${dirItem}`;
                        dirNode = COLL.getNode(dirPath);
                    } else {
                        continue;
                    }
                    
                    if (!dirName) {
                        continue;
                    }
                    
                    fileList.push({
                        name: String(dirName),  // 确保是字符串
                        type: 'directory',
                        path: dirPath,
                        dirNode: dirNode  // 保存目录节点引用，用于属性面板
                    });
                }
                
                // 添加文件
                for (const fileItem of filesResult) {
                    // fileItem 可能是对象 { name, path, size, file } 或字符串
                    let fileName, filePath, fileObj;
                    
                    if (typeof fileItem === 'object' && fileItem !== null) {
                        // 对象格式
                        fileName = fileItem.name;
                        filePath = fileItem.path || ((path === diskName) ? `${path}/${fileItem.name}` : `${path}/${fileItem.name}`);
                        fileObj = fileItem.file;
                    } else if (typeof fileItem === 'string') {
                        // 字符串格式（降级处理）
                        fileName = fileItem;
                        filePath = (path === diskName) ? `${path}/${fileItem}` : `${path}/${fileItem}`;
                        // 尝试从节点获取文件对象
                        const node = COLL.getNode(path);
                        if (node && node.attributes && node.attributes[fileItem]) {
                            fileObj = node.attributes[fileItem];
                        }
                    } else {
                        continue;
                    }
                    
                    if (!fileName) {
                        continue;
                    }
                    
                    let fileInfo = {
                        name: String(fileName),  // 确保是字符串
                        type: 'file',
                        path: filePath
                    };
                    
                    // 获取文件对象信息
                    if (fileObj) {
                        fileInfo.size = fileObj.fileSize || 0;
                        fileInfo.fileType = fileObj.fileType || 'TEXT';
                        fileInfo.fileObj = fileObj;  // 保存文件对象引用，用于属性面板
                        fileInfo.fileCreatTime = fileObj.fileCreatTime;
                        fileInfo.fileModifyTime = fileObj.fileModifyTime;
                        fileInfo.fileAttributes = fileObj.fileAttributes;
                    } else {
                        // 如果 fileItem 中没有 file 对象，尝试从节点获取
                        const node = COLL.getNode(path);
                        if (node && node.attributes && node.attributes[fileName]) {
                            fileObj = node.attributes[fileName];
                            fileInfo.size = fileObj.fileSize || 0;
                            fileInfo.fileType = fileObj.fileType || 'TEXT';
                            fileInfo.fileObj = fileObj;
                            fileInfo.fileCreatTime = fileObj.fileCreatTime;
                            fileInfo.fileModifyTime = fileObj.fileModifyTime;
                            fileInfo.fileAttributes = fileObj.fileAttributes;
                        }
                    }
                    
                    fileList.push(fileInfo);
                }
                
                // 排序：目录在前，然后按名称排序（确保 name 是字符串）
                fileList.sort((a, b) => {
                    if (!a || !b) return 0;
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    const nameA = String(a.name !== undefined ? a.name : '');
                    const nameB = String(b.name !== undefined ? b.name : '');
                    return nameA.localeCompare(nameB);
                });
                
                // 保存文件列表到内存
                this._setFileList(fileList);
                
                // 渲染文件列表
                this._renderFileList();
                
            } catch (error) {
                console.error('加载目录失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`加载目录失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`加载目录失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 渲染文件列表
         */
        _renderFileList: function() {
            if (!this.fileListElement) return;
            
            this.fileListElement.innerHTML = '';
            
            // 确保 fileList 是数组且每个 item 都有 name 属性
            const fileList = this._getFileList();
            if (!Array.isArray(fileList)) {
                console.warn('fileList 不是数组:', fileList);
                this._setFileList([]);
                return;
            }
            
            for (const item of fileList) {
                // 验证 item 对象
                if (!item || typeof item !== 'object') {
                    console.warn('无效的 item:', item);
                    continue;
                }
                
                // 确保 name 属性存在且是字符串
                if (!item.name || typeof item.name !== 'string') {
                    console.warn('item 缺少有效的 name 属性:', item);
                    continue;
                }
                const itemElement = document.createElement('div');
                itemElement.className = 'filemanager-item';
                itemElement.dataset.path = item.path;
                itemElement.dataset.type = item.type;
                itemElement.style.cssText = `
                    padding: 8px 12px;
                    margin: 2px 0;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.2s;
                    user-select: none;
                `;
                
                // 图标（使用SVG）
                const icon = document.createElement('div');
                icon.className = 'filemanager-item-icon';
                icon.style.cssText = `
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    color: ${item.type === 'directory' ? '#6c8eff' : '#aab2c0'};
                `;
                
                // 根据文件类型选择图标
                let iconPath = 'application/filemanager/assets/file.svg';
                if (item.type === 'directory') {
                    iconPath = 'application/filemanager/assets/folder.svg';
                } else if (item.type === 'file') {
                    const fileType = item.fileType || 'TEXT';
                    if (fileType === 'CODE' || fileType === 'TEXT') {
                        iconPath = 'application/filemanager/assets/file-text.svg';
                    } else if (fileType === 'IMAGE') {
                        iconPath = 'application/filemanager/assets/file-image.svg';
                    } else {
                        iconPath = 'application/filemanager/assets/file.svg';
                    }
                }
                
                // 创建img元素加载SVG图标
                const iconImg = document.createElement('img');
                iconImg.src = iconPath;
                iconImg.style.cssText = `
                    width: 20px;
                    height: 20px;
                    object-fit: contain;
                `;
                iconImg.onerror = () => {
                    // 如果SVG加载失败，使用内联SVG作为降级方案
                    icon.innerHTML = item.type === 'directory' 
                        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
                        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
                };
                icon.appendChild(iconImg);
                itemElement.appendChild(icon);
                
                // 名称（确保是字符串）
                const name = document.createElement('div');
                name.style.cssText = `
                    flex: 1;
                    font-size: 14px;
                    color: #e8ecf0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                `;
                // 确保 name 是字符串，避免显示 [object Object]
                const itemName = item && item.name !== undefined ? String(item.name) : '';
                name.textContent = itemName;
                name.dataset.itemName = itemName;  // 保存到 dataset 供右键菜单使用
                itemElement.appendChild(name);
                
                // 大小（仅文件）
                if (item.type === 'file' && item.size !== undefined) {
                    const size = document.createElement('div');
                    size.style.cssText = `
                        font-size: 12px;
                        color: #aab2c0;
                        min-width: 80px;
                        text-align: right;
                    `;
                    size.textContent = this._formatSize(item.size);
                    itemElement.appendChild(size);
                }
                
                // 点击事件
                itemElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._selectItem(itemElement, item);
                    
                    // 双击打开
                    if (e.detail === 2) {
                        this._openItem(item);
                    }
                });
                
                // 右键事件 - 不阻止默认行为，让 ContextMenuManager 处理
                // 但需要确保 item 信息被保存到 element 上
                itemElement.dataset.itemName = item && item.name !== undefined ? String(item.name) : '';
                itemElement._fileManagerItem = item;  // 保存 item 对象引用
                
                // 悬停效果
                itemElement.addEventListener('mouseenter', () => {
                    itemElement.style.background = 'rgba(108, 142, 255, 0.15)';
                });
                itemElement.addEventListener('mouseleave', () => {
                    if (this.selectedItem !== itemElement) {
                        itemElement.style.background = 'transparent';
                    }
                });
                
                this.fileListElement.appendChild(itemElement);
            }
        },
        
        /**
         * 选择项目
         */
        _selectItem: function(element, item) {
            // 取消之前的选择
            if (this.selectedItem) {
                this.selectedItem.style.background = 'transparent';
            }
            
            // 选择新项目
            this._setSelectedItem(item);
            element.style.background = 'rgba(108, 142, 255, 0.25)';
            this.selectedItemData = element; // DOM元素引用保留在变量中
            
            // 自动显示属性面板
            this._showProperties(item);
        },
        
        /**
         * 打开项目
         */
        _openItem: async function(item) {
            if (item.type === 'directory') {
                // 如果是根目录项（磁盘分区），直接加载该分区
                if (item.isRoot) {
                    await this._loadDirectory(item.path);
                } else {
                    await this._loadDirectory(item.path);
                }
            } else if (item.type === 'file') {
                // 检查文件类型
                const fileType = item.fileType || 'TEXT';
                if (fileType === 'TEXT' || fileType === 'CODE' || fileType === 'MARKDOWN') {
                    await this._openFileForEdit(item);
                } else {
                    // 其他类型文件，提示用vim打开
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showConfirm === 'function') {
                        const confirmed = await GUIManager.showConfirm(
                            `文件 "${item.name}" 不是文本文件。是否用 Vim 打开？`,
                            '打开文件',
                            'info'
                        );
                        if (confirmed) {
                            await this._openFileWithVim(item);
                        }
                    } else {
                        if (confirm(`文件 "${item.name}" 不是文本文件。是否用 Vim 打开？`)) {
                            await this._openFileWithVim(item);
                        }
                    }
                }
            }
        },
        
        /**
         * 打开文件进行编辑
         */
        _openFileForEdit: async function(item) {
            try {
                // 获取文件系统集合
                let COLL = null;
                const diskName = item.path.split(':')[0] + ':';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    try {
                        COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                    } catch (e) {
                        console.error(`获取磁盘 ${diskName} 失败:`, e);
                    }
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问磁盘: ${diskName}`, '错误', 'error');
                    } else {
                        alert(`无法访问磁盘: ${diskName}`);
                    }
                    return;
                }
                
                // 解析路径：分离父目录路径和文件名
                const pathParts = item.path.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const parentPath = pathParts.slice(0, -1).join('/') || diskName;
                
                // 读取文件内容：使用 read_file
                const content = COLL.read_file(parentPath, fileName) || '';
                
                // 显示编辑面板
                this._setEditingFile(item);
                this._setEditContent(content);
                
                if (this.editPanel) {
                    this.editPanel.style.display = 'flex';
                    this.editPanel.style.width = '400px';
                }
                
                if (this.editArea) {
                    this.editArea.value = content;
                }
                
                if (this.editTitle) {
                    const titleElement = this.editPanel.querySelector('.filemanager-edit-title');
                    if (titleElement) {
                        titleElement.textContent = `编辑: ${item.name}`;
                    }
                }
                
            } catch (error) {
                console.error('打开文件失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`打开文件失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`打开文件失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 保存编辑的文件
         */
        _saveEditingFile: async function() {
            if (!this.editingFile || !this.editArea) {
                return;
            }
            
            try {
                const content = this.editArea.value;
                const filePath = this.editingFile.path;
                const fileName = this.editingFile.name;
                
                // 获取文件系统集合
                let COLL = null;
                const currentPath = this._getCurrentPath();
                if (!currentPath || typeof currentPath !== 'string') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('当前路径无效', '错误', 'error');
                    } else {
                        alert('当前路径无效');
                    }
                    return;
                }
                
                const diskNameMatch = currentPath.match(/^([A-Za-z]:)/);
                const diskName = diskNameMatch ? diskNameMatch[1] : 'C:';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问磁盘: ${diskName}`, '错误', 'error');
                    } else {
                        alert(`无法访问磁盘: ${diskName}`);
                    }
                    return;
                }
                
                // 解析父路径和文件名
                const pathParts = filePath.split('/');
                const parentPath = pathParts.slice(0, -1).join('/') || diskName;
                const actualFileName = pathParts[pathParts.length - 1] || fileName;
                
                // 使用 NodeTreeCollection 的 write_file 方法写入文件
                COLL.write_file(parentPath, actualFileName, content);
                
                // 获取文件对象并刷新文件大小信息
                const node = COLL.getNode(parentPath);
                if (node && node.attributes && node.attributes[actualFileName]) {
                    const fileObj = node.attributes[actualFileName];
                    // 调用 refreshInfo 更新文件大小
                    if (fileObj && typeof fileObj.refreshInfo === 'function') {
                        fileObj.refreshInfo();
                    }
                }
                
                // 更新文件信息
                this.editingFile.content = content;
                
                // 刷新文件列表以更新文件大小显示
                const currentPathForRefresh = this._getCurrentPath();
                if (currentPathForRefresh) {
                    await this._loadDirectory(currentPathForRefresh);
                }
                
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert('文件已保存', '成功', 'success');
                } else {
                    alert('文件已保存');
                }
                
            } catch (error) {
                console.error('保存文件失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`保存文件失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`保存文件失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 关闭编辑面板
         */
        _closeEditPanel: function() {
            if (this.editPanel) {
                this.editPanel.style.width = '0';
                setTimeout(() => {
                    this.editPanel.style.display = 'none';
                }, 300);
            }
            this._setEditingFile(null);
            this._setEditContent(null);
        },
        
        /**
         * 用 Vim 打开文件
         */
        _openFileWithVim: async function(item) {
            try {
                if (typeof ProcessManager === 'undefined') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('ProcessManager 不可用', '错误', 'error');
                    } else {
                        alert('ProcessManager 不可用');
                    }
                    return;
                }
                
                // 确保item.path存在且有效
                if (!item || !item.path) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('文件路径无效', '错误', 'error');
                    } else {
                        alert('文件路径无效');
                    }
                    return;
                }
                
                // 获取终端实例（vim需要终端来运行）
                // 尝试获取当前活动的终端，如果没有则启动一个新的终端
                let terminalInstance = null;
                let terminalPid = null;
                
                // 查找活动的终端实例
                // TERMINAL._instances 存储的是 { tabManager, pid } 对象
                // 需要从 tabManager 获取活动的终端实例
                if (typeof TERMINAL !== 'undefined' && TERMINAL._instances) {
                    const instances = Array.from(TERMINAL._instances.values());
                    for (const instance of instances) {
                        if (instance && instance.tabManager) {
                            const activeTerm = instance.tabManager.getActiveTerminal();
                            if (activeTerm) {
                                terminalInstance = activeTerm;
                                break;
                            }
                        }
                    }
                }
                
                // 如果没有活动的终端，先启动一个终端
                if (!terminalInstance) {
                    terminalPid = await ProcessManager.startProgram('terminal');
                    // 等待终端初始化
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // 获取终端实例（从 tabManager 获取活动终端）
                    if (typeof TERMINAL !== 'undefined' && TERMINAL._instances) {
                        const instance = TERMINAL._instances.get(terminalPid);
                        if (instance && instance.tabManager) {
                            terminalInstance = instance.tabManager.getActiveTerminal();
                        }
                    }
                }
                
                if (!terminalInstance) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('无法获取终端实例，Vim 需要终端来运行', '错误', 'error');
                    } else {
                        alert('无法获取终端实例，Vim 需要终端来运行');
                    }
                    return;
                }
                
                // 获取当前路径（用于cwd）
                const currentPath = this._getCurrentPath();
                const cwd = currentPath || 'C:';
                
                // 启动 vim 程序，传递终端实例
                await ProcessManager.startProgram('vim', {
                    args: [item.path],
                    cwd: cwd,
                    terminal: terminalInstance
                });
                
            } catch (error) {
                console.error('启动 Vim 失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`启动 Vim 失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`启动 Vim 失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 返回上级目录
         */
        _goUp: async function() {
            // 如果当前在根目录视图，则无法返回
            const currentPath = this._getCurrentPath();
            if (currentPath === null || currentPath === '') {
                return;
            }
            
            // 如果当前在磁盘根目录（如 C:），则返回根目录视图
            if (typeof currentPath !== 'string') {
                await this._loadRootDirectory();
                return;
            }
            const diskNameMatch = currentPath.match(/^([A-Za-z]:)/);
            const diskName = diskNameMatch ? diskNameMatch[1] : 'C:';
            if (currentPath === diskName) {
                await this._loadRootDirectory();
                return;
            }
            
            // 否则返回上一级目录
            const parts = currentPath.split('/');
            if (parts.length <= 1) {
                await this._loadRootDirectory();
            } else {
                parts.pop();
                const parentPath = parts.join('/');
                await this._loadDirectory(parentPath);
            }
        },
        
        /**
         * 导航到指定路径
         */
        _navigateToPath: async function(path) {
            await this._loadDirectory(path);
        },
        
        /**
         * 创建新文件
         */
        _createNewFile: async function() {
            if (typeof GUIManager !== 'undefined' && typeof GUIManager.showPrompt === 'function') {
                const fileName = await GUIManager.showPrompt('请输入文件名:', '新建文件', 'newfile.txt');
                if (fileName) {
                    await this._doCreateFile(fileName);
                }
            } else {
                const fileName = prompt('请输入文件名:', 'newfile.txt');
                if (fileName) {
                    await this._doCreateFile(fileName);
                }
            }
        },
        
        /**
         * 执行创建文件
         */
        _doCreateFile: async function(fileName) {
            try {
                // 如果当前在根目录视图，无法创建文件
                const currentPath = this._getCurrentPath();
                if (currentPath === null || currentPath === '') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('请在磁盘分区内创建文件', '提示', 'info');
                    } else {
                        alert('请在磁盘分区内创建文件');
                    }
                    return;
                }
                
                // 确保currentPath是字符串
                if (typeof currentPath !== 'string') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('当前路径无效', '错误', 'error');
                    } else {
                        alert('当前路径无效');
                    }
                    return;
                }
                
                // 获取文件系统集合
                let COLL = null;
                // 安全地提取磁盘名称
                const diskNameMatch = currentPath.match(/^([A-Za-z]:)/);
                const diskName = diskNameMatch ? diskNameMatch[1] : 'C:';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问磁盘: ${diskName}`, '错误', 'error');
                    } else {
                        alert(`无法访问磁盘: ${diskName}`);
                    }
                    return;
                }
                
                // 构建文件路径（父目录路径）
                const parentPath = currentPath;
                
                // 使用 NodeTreeCollection 的 create_file 方法创建文件
                COLL.create_file(parentPath, fileName);
                
                // 刷新目录列表
                await this._loadDirectory(this.currentPath);
                
            } catch (error) {
                console.error('创建文件失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`创建文件失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`创建文件失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 创建新目录
         */
        _createNewDirectory: async function() {
            if (typeof GUIManager !== 'undefined' && typeof GUIManager.showPrompt === 'function') {
                const dirName = await GUIManager.showPrompt('请输入目录名:', '新建目录', 'newdir');
                if (dirName) {
                    await this._doCreateDirectory(dirName);
                }
            } else {
                const dirName = prompt('请输入目录名:', 'newdir');
                if (dirName) {
                    await this._doCreateDirectory(dirName);
                }
            }
        },
        
        /**
         * 执行创建目录
         */
        _doCreateDirectory: async function(dirName) {
            try {
                // 如果当前在根目录视图，无法创建目录
                const currentPath = this._getCurrentPath();
                if (currentPath === null || currentPath === '') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('请在磁盘分区内创建目录', '提示', 'info');
                    } else {
                        alert('请在磁盘分区内创建目录');
                    }
                    return;
                }
                
                // 获取文件系统集合
                let COLL = null;
                // 安全地提取磁盘名称
                if (typeof currentPath !== 'string') {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('当前路径无效', '错误', 'error');
                    } else {
                        alert('当前路径无效');
                    }
                    return;
                }
                const diskNameMatch = currentPath.match(/^([A-Za-z]:)/);
                const diskName = diskNameMatch ? diskNameMatch[1] : 'C:';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问磁盘: ${diskName}`, '错误', 'error');
                    } else {
                        alert(`无法访问磁盘: ${diskName}`);
                    }
                    return;
                }
                
                // 构建目录路径
                const dirPath = `${currentPath}/${dirName}`;
                
                // 使用 NodeTreeCollection 的 create_dir 方法创建目录
                COLL.create_dir(currentPath, dirName);
                
                // 刷新目录列表
                await this._loadDirectory(this.currentPath);
                
            } catch (error) {
                console.error('创建目录失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`创建目录失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`创建目录失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 注册右键菜单
         */
        _registerContextMenu: function() {
            if (typeof ContextMenuManager === 'undefined') {
                return;
            }
            
            // 注册文件管理器窗口的右键菜单
            ContextMenuManager.registerMenu('filemanager-item', (target) => {
                const itemElement = target.closest('.filemanager-item');
                if (!itemElement) {
                    return null;
                }
                
                // 从 dataset 或保存的对象引用获取信息
                const itemType = itemElement.dataset.type;
                const itemPath = itemElement.dataset.path;
                // 优先使用 dataset 中的 itemName，如果没有则从保存的对象引用获取
                let itemName = itemElement.dataset.itemName;
                if (!itemName && itemElement._fileManagerItem) {
                    itemName = String(itemElement._fileManagerItem.name || '');
                }
                // 如果仍然没有，尝试从子元素中获取
                if (!itemName) {
                    const nameElement = itemElement.querySelector('div[data-item-name]');
                    if (nameElement) {
                        itemName = nameElement.dataset.itemName || nameElement.textContent.trim();
                    } else {
                        itemName = itemElement.textContent.trim();
                    }
                }
                
                const items = [];
                
                if (itemType === 'directory') {
                    items.push({
                        label: '打开',
                        icon: '📂',
                        action: () => {
                            this._openItem({ type: 'directory', path: itemPath, name: itemName });
                        }
                    });
                    items.push({
                        label: '在新窗口打开',
                        icon: '🪟',
                        action: async () => {
                            if (typeof ProcessManager !== 'undefined') {
                                await ProcessManager.startProgram('filemanager', {
                                    args: [itemPath]
                                });
                            }
                        }
                    });
                } else {
                    items.push({
                        label: '打开',
                        icon: '📄',
                        action: () => {
                            this._openItem({ type: 'file', path: itemPath, name: itemName });
                        }
                    });
                    items.push({
                        label: '用 Vim 打开',
                        icon: '✏️',
                        action: () => {
                            this._openFileWithVim({ type: 'file', path: itemPath, name: itemName });
                        }
                    });
                }
                
                items.push({ type: 'separator' });
                
                items.push({
                    label: '重命名',
                    icon: '✏️',
                    action: async () => {
                        if (typeof GUIManager !== 'undefined' && typeof GUIManager.showPrompt === 'function') {
                            const newName = await GUIManager.showPrompt('请输入新名称:', '重命名', itemName);
                            if (newName && newName !== itemName) {
                                await this._renameItem(itemPath, newName);
                            }
                        } else {
                            const newName = prompt('请输入新名称:', itemName);
                            if (newName && newName !== itemName) {
                                await this._renameItem(itemPath, newName);
                            }
                        }
                    }
                });
                
                items.push({
                    label: '删除',
                    icon: '🗑️',
                    danger: true,
                    action: async () => {
                        if (typeof GUIManager !== 'undefined' && typeof GUIManager.showConfirm === 'function') {
                            const confirmed = await GUIManager.showConfirm(
                                `确定要删除 "${itemName}" 吗？`,
                                '确认删除',
                                'danger'
                            );
                            if (confirmed) {
                                await this._deleteItem(itemPath, itemType);
                            }
                        } else {
                            if (confirm(`确定要删除 "${itemName}" 吗？`)) {
                                await this._deleteItem(itemPath, itemType);
                            }
                        }
                    }
                });
                
                return {
                    items: items
                };
            });
        },
        
        /**
         * 重命名项目
         */
        _renameItem: async function(oldPath, newName) {
            try {
                // 获取文件系统集合
                let COLL = null;
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    const diskName = oldPath.split(':')[0] + ':';
                    COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert('无法访问文件系统', '错误', 'error');
                    } else {
                        alert('无法访问文件系统');
                    }
                    return;
                }
                
                const parts = oldPath.split('/');
                const oldName = parts[parts.length - 1];
                const parentPath = parts.slice(0, -1).join('/') || (oldPath.split(':')[0] + ':');
                
                // 使用 NodeTreeCollection 的 rename 方法
                // 检查是文件还是目录
                const isDirectory = COLL.hasNode(oldPath);
                
                if (isDirectory) {
                    // 重命名目录
                    if (typeof COLL.rename_dir === 'function') {
                        COLL.rename_dir(oldPath, newName);
                    } else {
                        throw new Error('重命名目录功能不可用');
                    }
                } else {
                    // 重命名文件
                    if (typeof COLL.rename_file === 'function') {
                        COLL.rename_file(parentPath, oldName, newName);
                    } else {
                        throw new Error('重命名文件功能不可用');
                    }
                }
                
                await this._loadDirectory(this.currentPath);
                
            } catch (error) {
                console.error('重命名失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`重命名失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`重命名失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 删除项目
         */
        _deleteItem: async function(itemPath, itemType) {
            try {
                // 获取文件系统集合
                let COLL = null;
                const diskName = itemPath.split(':')[0] + ':';
                
                if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                    try {
                        COLL = POOL.__GET__("KERNEL_GLOBAL_POOL", diskName);
                    } catch (e) {
                        console.error(`获取磁盘 ${diskName} 失败:`, e);
                    }
                }
                
                if (!COLL) {
                    if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                        await GUIManager.showAlert(`无法访问磁盘: ${diskName}`, '错误', 'error');
                    } else {
                        alert(`无法访问磁盘: ${diskName}`);
                    }
                    return;
                }
                
                // 解析路径：分离父目录路径和项目名称
                const pathParts = itemPath.split('/');
                const itemName = pathParts[pathParts.length - 1];
                const parentPath = pathParts.slice(0, -1).join('/') || diskName;
                
                if (itemType === 'directory') {
                    // 删除目录：使用 delete_dir
                    COLL.delete_dir(itemPath);
                } else {
                    // 删除文件：使用 delete_file
                    COLL.delete_file(parentPath, itemName);
                }
                
                // 刷新当前目录
                const currentPath = this._getCurrentPath();
                if (currentPath === null || currentPath === '') {
                    await this._loadRootDirectory();
                } else {
                    await this._loadDirectory(currentPath);
                }
                
            } catch (error) {
                console.error('删除失败:', error);
                if (typeof GUIManager !== 'undefined' && typeof GUIManager.showAlert === 'function') {
                    await GUIManager.showAlert(`删除失败: ${error.message}`, '错误', 'error');
                } else {
                    alert(`删除失败: ${error.message}`);
                }
            }
        },
        
        /**
         * 更新侧边栏选中状态
         */
        _updateSidebarSelection: function() {
            if (!this.sidebarDiskList) return;
            
            // 更新所有侧边栏项的选中状态
            const items = this.sidebarDiskList.querySelectorAll('.filemanager-sidebar-item');
            items.forEach(item => {
                const isRoot = item.textContent.trim() === '计算机';
                const isCurrentDisk = !isRoot && item.textContent.trim() === this.currentPath;
                const currentPath = this._getCurrentPath();
                const isRootView = isRoot && (currentPath === null || currentPath === '');
                
                if (isRootView || isCurrentDisk) {
                    item.style.color = '#6c8eff';
                    item.style.background = 'rgba(108, 142, 255, 0.15)';
                } else {
                    item.style.color = '#e8ecf0';
                    item.style.background = 'transparent';
                }
            });
        },
        
        /**
         * 格式化文件大小
         */
        _formatSize: function(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        
        /**
         * 退出方法
         */
        __exit__: async function() {
            try {
                // 注销右键菜单
                if (typeof ContextMenuManager !== 'undefined' && ContextMenuManager.unregisterMenu) {
                    try {
                        ContextMenuManager.unregisterMenu('filemanager-item');
                    } catch (e) {
                        console.warn('注销右键菜单失败:', e);
                    }
                }
                
                // 先移除 DOM 元素（确保 UI 立即清除）
                if (this.window) {
                    try {
                        // 如果窗口还在 DOM 中，直接移除
                        if (this.window.parentElement) {
                            this.window.parentElement.removeChild(this.window);
                        } else if (this.window.parentNode) {
                            this.window.parentNode.removeChild(this.window);
                        }
                    } catch (e) {
                        console.warn('移除窗口 DOM 失败:', e);
                    }
                }
                
                // 如果使用GUIManager，注销窗口（从 GUIManager 的内部映射中移除）
                // 注意：这应该在 DOM 移除之后进行，因为 unregisterWindow 不会移除 DOM
                if (typeof GUIManager !== 'undefined' && GUIManager.unregisterWindow) {
                    try {
                        GUIManager.unregisterWindow(this.pid);
                    } catch (e) {
                        console.warn('注销 GUIManager 窗口失败:', e);
                    }
                }
                
                // 清理所有子元素的引用
                if (this.topToolbar) {
                    try {
                        if (this.topToolbar.parentElement) {
                            this.topToolbar.parentElement.removeChild(this.topToolbar);
                        }
                    } catch (e) {}
                    this.topToolbar = null;
                }
                
                if (this.sidebar) {
                    try {
                        if (this.sidebar.parentElement) {
                            this.sidebar.parentElement.removeChild(this.sidebar);
                        }
                    } catch (e) {}
                    this.sidebar = null;
                }
                
                if (this.mainContent) {
                    try {
                        if (this.mainContent.parentElement) {
                            this.mainContent.parentElement.removeChild(this.mainContent);
                        }
                    } catch (e) {}
                    this.mainContent = null;
                }
                
                // 清理引用
                this.window = null;
                this.fileListElement = null;
                this.addressInput = null;
                this.propertiesPanel = null;
                this.editPanel = null;
                this._setSelectedItem(null);
                this.selectedItemData = null;
                this._setEditingFile(null);
                this._setFileList([]);
                this._setCurrentPath(null);
                
                // 强制垃圾回收提示（如果浏览器支持）
                if (window.gc) {
                    try {
                        window.gc();
                    } catch (e) {}
                }
                
            } catch (error) {
                console.error('文件管理器退出时发生错误:', error);
                // 即使出错，也尝试强制移除窗口
                if (this.window && this.window.parentElement) {
                    try {
                        this.window.parentElement.removeChild(this.window);
                    } catch (e) {
                        console.error('强制移除窗口失败:', e);
                    }
                }
            }
        },
        
        /**
         * 初始化内存管理
         */
        _initMemory: function(pid) {
            if (!pid) {
                console.warn('FileManager: PID not available');
                return;
            }
            
            // 确保内存已分配
            if (typeof MemoryUtils !== 'undefined') {
                const mem = MemoryUtils.ensureMemory(pid, 100000, 2000);
                if (mem) {
                    this._heap = mem.heap;
                    this._shed = mem.shed;
                }
            } else if (typeof MemoryManager !== 'undefined') {
                // 降级方案：直接使用MemoryManager
                try {
                    const result = MemoryManager.allocateMemory(pid, 100000, 2000, 1, 1);
                    this._heap = result.heap;
                    this._shed = result.shed;
                } catch (e) {
                    console.error('FileManager: Error allocating memory', e);
                }
            }
        },
        
        /**
         * 数据访问方法（getter/setter）
         */
        _getCurrentPath: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadString(this.pid, this._currentPathKey);
            }
            return null;
        },
        
        _setCurrentPath: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeString(this.pid, this._currentPathKey, value !== null ? value : '');
            }
        },
        
        _getFileList: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadArray(this.pid, this._fileListKey) || [];
            }
            return [];
        },
        
        _setFileList: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeArray(this.pid, this._fileListKey, value || []);
            }
        },
        
        _getSelectedItem: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadObject(this.pid, this._selectedItemKey);
            }
            return null;
        },
        
        _setSelectedItem: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeObject(this.pid, this._selectedItemKey, value);
            }
        },
        
        _getEditingFile: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadObject(this.pid, this._editingFileKey);
            }
            return null;
        },
        
        _setEditingFile: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeObject(this.pid, this._editingFileKey, value);
            }
        },
        
        _getEditContent: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadString(this.pid, this._editContentKey);
            }
            return null;
        },
        
        _setEditContent: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeString(this.pid, this._editContentKey, value || '');
            }
        },
        
        /**
         * 信息方法
         */
        __info__: function() {
            return {
                name: 'filemanager',
                type: 'GUI',
                version: '1.0.0',
                description: 'ZerOS 文件管理器 - 图形化文件浏览、编辑和管理',
                author: 'ZerOS Team',
                copyright: '© 2024',
                metadata: {
                    allowMultipleInstances: true
                }
            };
        }
    };
    
    // 导出到全局作用域
    if (typeof window !== 'undefined') {
        window.FILEMANAGER = FILEMANAGER;
    } else if (typeof globalThis !== 'undefined') {
        globalThis.FILEMANAGER = FILEMANAGER;
    }
    
})(typeof window !== 'undefined' ? window : globalThis);

