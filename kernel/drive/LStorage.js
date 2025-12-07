// 本地存储管理器
// 负责本地数据的管理、注册等操作
// 所有系统依赖的本地数据和程序的本地数据都存储在 D:/LocalSData.json 文件中

KernelLogger.info("LStorage", "模块初始化");

class LStorage {
    // 存储文件路径
    static STORAGE_FILE_PATH = "D:";
    static STORAGE_FILE_NAME = "LocalSData.json";
    
    // 存储数据结构
    // {
    //     system: {
    //         // 系统依赖的本地数据
    //         [key: string]: any
    //     },
    //     programs: {
    //         // 程序的本地数据
    //         [pid: number]: {
    //             [key: string]: any
    //         }
    //     }
    // }
    static _storageData = null;
    static _initialized = false;
    
    /**
     * 初始化本地存储管理器
     * @returns {Promise<void>}
     */
    static async init() {
        if (LStorage._initialized) {
            KernelLogger.debug("LStorage", "已初始化，跳过");
            return;
        }
        
        KernelLogger.info("LStorage", "初始化本地存储管理器");
        
        try {
            // 加载存储数据（允许在加载时保存新文件）
            await LStorage._loadStorageData(true);
            LStorage._initialized = true;
            KernelLogger.info("LStorage", "本地存储管理器初始化完成");
        } catch (error) {
            KernelLogger.error("LStorage", `初始化失败: ${error.message}`, error);
            // 初始化失败时使用空数据结构
            LStorage._storageData = {
                system: {},
                programs: {}
            };
            LStorage._initialized = true;
        }
    }
    
    /**
     * 从文件加载存储数据
     * @param {boolean} allowSave 是否允许保存（初始化时允许）
     * @returns {Promise<void>}
     */
    static async _loadStorageData(allowSave = false) {
        try {
            // 首先检查 Disk 是否可用
            if (typeof Disk === 'undefined') {
                KernelLogger.warn("LStorage", "Disk 模块未定义，创建空数据结构");
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
                return;
            }
            
            // 等待 Disk 初始化完成
            if (!Disk.canUsed) {
                KernelLogger.debug("LStorage", "Disk 未初始化，等待初始化...");
                let diskWaitCount = 0;
                const maxDiskWaitCount = 100; // 最多等待10秒
                
                while (diskWaitCount < maxDiskWaitCount && !Disk.canUsed) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    diskWaitCount++;
                }
                
                if (!Disk.canUsed) {
                    KernelLogger.warn("LStorage", "Disk 初始化超时，创建空数据结构");
                    LStorage._storageData = {
                        system: {},
                        programs: {}
                    };
                    return;
                }
            }
            
            // 获取 D: 分区的 NodeTreeCollection
            const diskSeparateMap = Disk.diskSeparateMap;
            let dPartition = diskSeparateMap.get("D:");
            
            // 如果 D: 分区不存在，尝试从 POOL 获取
            if (!dPartition && typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    dPartition = POOL.__GET__("KERNEL_GLOBAL_POOL", "D:");
                    if (dPartition) {
                        // 如果从 POOL 获取成功，也更新 diskSeparateMap（保持一致性）
                        Disk.setMap("diskSeparateMap", "D:", dPartition);
                        KernelLogger.debug("LStorage", "从 POOL 获取 D: 分区成功");
                    }
                } catch (e) {
                    KernelLogger.debug("LStorage", `从 POOL 获取 D: 分区失败: ${e.message}`);
                }
            }
            
            // 如果 D: 分区不存在，等待它创建（最多等待10秒）
            if (!dPartition) {
                KernelLogger.debug("LStorage", "D: 分区不存在，等待创建...");
                let waitCount = 0;
                const maxWaitCount = 100; // 最多等待10秒（100 * 100ms）
                
                while (waitCount < maxWaitCount && !dPartition) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 尝试从 diskSeparateMap 获取
                    dPartition = diskSeparateMap.get("D:");
                    
                    // 如果仍然不存在，尝试从 POOL 获取
                    if (!dPartition && typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                        try {
                            dPartition = POOL.__GET__("KERNEL_GLOBAL_POOL", "D:");
                            if (dPartition) {
                                // 如果从 POOL 获取成功，也更新 diskSeparateMap（保持一致性）
                                Disk.setMap("diskSeparateMap", "D:", dPartition);
                                KernelLogger.debug("LStorage", "从 POOL 获取 D: 分区成功（等待期间）");
                            }
                        } catch (e) {
                            // 忽略错误，继续等待
                        }
                    }
                    
                    waitCount++;
                }
                
                if (!dPartition) {
                    KernelLogger.warn("LStorage", "D: 分区不存在，创建空数据结构");
                    LStorage._storageData = {
                        system: {},
                        programs: {}
                    };
                    return;
                }
            }
            
            // 等待 D: 分区初始化完成（NodeTreeCollection 的初始化是异步的）
            if (dPartition.initialized === false) {
                KernelLogger.debug("LStorage", "D: 分区存在但未初始化，等待初始化完成...");
                let initWaitCount = 0;
                const maxInitWaitCount = 100; // 最多等待10秒（100 * 100ms）
                
                while (initWaitCount < maxInitWaitCount && dPartition.initialized === false) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    initWaitCount++;
                }
                
                if (dPartition.initialized === false) {
                    KernelLogger.warn("LStorage", "D: 分区初始化超时，创建空数据结构");
                    LStorage._storageData = {
                        system: {},
                        programs: {}
                    };
                    return;
                }
            }
            
            // 检查文件是否存在
            const filePath = LStorage.STORAGE_FILE_PATH;
            const fileName = LStorage.STORAGE_FILE_NAME;
            
            // 检查文件是否存在
            const node = dPartition.getNode(filePath);
            if (!node) {
                KernelLogger.info("LStorage", "存储文件不存在，创建新文件");
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
                if (allowSave) {
                    // 临时标记为已初始化，允许保存
                    const wasInitialized = LStorage._initialized;
                    LStorage._initialized = true;
                    await LStorage._saveStorageData();
                    LStorage._initialized = wasInitialized;
                }
                return;
            }
            
            // 检查文件是否存在
            if (!node.attributes || !node.attributes[fileName]) {
                KernelLogger.info("LStorage", "存储文件不存在，创建新文件");
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
                if (allowSave) {
                    // 临时标记为已初始化，允许保存
                    const wasInitialized = LStorage._initialized;
                    LStorage._initialized = true;
                    await LStorage._saveStorageData();
                    LStorage._initialized = wasInitialized;
                }
                return;
            }
            
            // 读取文件内容
            const fileContent = dPartition.read_file(filePath, fileName);
            if (!fileContent) {
                KernelLogger.warn("LStorage", "存储文件为空，使用空数据结构");
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
                return;
            }
            
            // 解析 JSON
            let contentString = '';
            if (Array.isArray(fileContent)) {
                contentString = fileContent.join('\n');
            } else if (typeof fileContent === 'string') {
                contentString = fileContent;
            } else {
                KernelLogger.warn("LStorage", "存储文件格式不正确，使用空数据结构");
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
                return;
            }
            
            try {
                LStorage._storageData = JSON.parse(contentString);
                
                // 验证数据结构
                if (!LStorage._storageData || typeof LStorage._storageData !== 'object') {
                    throw new Error('数据结构无效');
                }
                
                if (!LStorage._storageData.system) {
                    LStorage._storageData.system = {};
                }
                if (!LStorage._storageData.programs) {
                    LStorage._storageData.programs = {};
                }
                
                // 记录加载的数据摘要（用于调试）
                const systemKeys = Object.keys(LStorage._storageData.system || {});
                const programCount = Object.keys(LStorage._storageData.programs || {}).length;
                KernelLogger.info("LStorage", `存储数据加载成功 (系统键: ${systemKeys.length}, 程序: ${programCount})`);
                if (systemKeys.length > 0) {
                    KernelLogger.debug("LStorage", `系统存储键: ${systemKeys.join(', ')}`);
                }
            } catch (parseError) {
                KernelLogger.error("LStorage", `解析存储文件失败: ${parseError.message}`, parseError);
                LStorage._storageData = {
                    system: {},
                    programs: {}
                };
            }
        } catch (error) {
            KernelLogger.error("LStorage", `加载存储数据失败: ${error.message}`, error);
            LStorage._storageData = {
                system: {},
                programs: {}
            };
        }
    }
    
    /**
     * 保存存储数据到文件
     * @returns {Promise<void>}
     */
    static async _saveStorageData() {
        if (!LStorage._initialized) {
            KernelLogger.warn("LStorage", "未初始化，无法保存");
            throw new Error("LStorage 未初始化");
        }
        
        try {
            // 获取 D: 分区的 NodeTreeCollection
            // 首先尝试从 diskSeparateMap 获取
            let diskSeparateMap = Disk.diskSeparateMap;
            let dPartition = diskSeparateMap.get("D:");
            
            // 如果从 diskSeparateMap 获取失败，尝试从 POOL 获取
            if (!dPartition && typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    dPartition = POOL.__GET__("KERNEL_GLOBAL_POOL", "D:");
                    if (dPartition) {
                        // 如果从 POOL 获取成功，也更新 diskSeparateMap（保持一致性）
                        diskSeparateMap.set("D:", dPartition);
                        // 更新缓存
                        Disk._diskSeparateMapCache = diskSeparateMap;
                        KernelLogger.debug("LStorage", "从 POOL 获取 D: 分区成功（保存时）");
                    }
                } catch (e) {
                    KernelLogger.debug("LStorage", `从 POOL 获取 D: 分区失败: ${e.message}`);
                }
            }
            
            if (!dPartition) {
                // D: 分区不存在是预期的、可恢复的情况（在系统启动初期）
                // 使用 debug 级别而不是 error，因为调用者会处理这种情况并安排延迟保存
                KernelLogger.debug("LStorage", "D: 分区不存在，无法保存（这是预期的，将在分区可用后自动重试）");
                throw new Error("D: 分区不存在");
            }
            
            // 检查 D: 分区是否已初始化（如果分区对象有 initialized 属性）
            if (dPartition.initialized === false) {
                KernelLogger.debug("LStorage", "D: 分区存在但未初始化，等待初始化完成");
                throw new Error("D: 分区未初始化");
            }
            
            const filePath = LStorage.STORAGE_FILE_PATH;
            const fileName = LStorage.STORAGE_FILE_NAME;
            
            // 确保目录存在（D: 分区根目录应该已经存在）
            // 如果 filePath 不是根目录，需要检查并创建
            if (filePath && filePath !== "D:" && !dPartition.hasNode(filePath)) {
                KernelLogger.info("LStorage", `创建目录: ${filePath}`);
                // 解析路径并创建目录
                const pathParts = filePath.split('/').filter(p => p && p !== 'D:');
                let currentPath = "D:";
                for (const part of pathParts) {
                    const nextPath = currentPath === "D:" ? `D:/${part}` : `${currentPath}/${part}`;
                    if (!dPartition.hasNode(nextPath)) {
                        dPartition.create_dir(currentPath, part);
                    }
                    currentPath = nextPath;
                }
            }
            
            // 确保文件存在
            const node = dPartition.getNode(filePath);
            if (!node || !node.attributes || !node.attributes[fileName]) {
                KernelLogger.info("LStorage", `创建文件: ${filePath}/${fileName}`);
                // 创建文件
                const FileTypeRef = getFileType();
                if (FileTypeRef) {
                    const fileObj = new FileFormwork(
                        FileTypeRef.GENRE.JSON,
                        fileName,
                        "{}",
                        `${filePath}/${fileName}`
                    );
                    dPartition.create_file(filePath, fileObj);
                } else {
                    KernelLogger.error("LStorage", "FileType 不可用，无法创建文件");
                    throw new Error("FileType 不可用");
                }
            }
            
            // 将数据转换为 JSON 字符串
            const jsonString = JSON.stringify(LStorage._storageData, null, 2);
            
            // 获取 FileType 以使用正确的写入模式
            const FileTypeRef = getFileType();
            if (!FileTypeRef || !FileTypeRef.WRITE_MODES) {
                KernelLogger.error("LStorage", "FileType.WRITE_MODES 不可用，无法写入文件");
                throw new Error("FileType.WRITE_MODES 不可用");
            }
            
            // 写入文件（使用覆盖模式）
            dPartition.write_file(filePath, fileName, jsonString, FileTypeRef.WRITE_MODES.OVERWRITE);
            
            // 确保文件对象已刷新信息并保存到 localStorage
            const fileNode = dPartition.getNode(filePath);
            if (fileNode && fileNode.attributes && fileNode.attributes[fileName]) {
                const fileObj = fileNode.attributes[fileName];
                if (fileObj && typeof fileObj.refreshInfo === 'function') {
                    fileObj.refreshInfo();
                }
            }
            
            // 确保文件系统已保存到 localStorage（write_file 应该已经调用了，但为了确保，再次调用）
            if (typeof dPartition._saveToLocalStorage === 'function') {
                dPartition._saveToLocalStorage();
            }
            
            // 记录保存的数据摘要（用于调试）
            const systemKeys = Object.keys(LStorage._storageData.system || {});
            const savedDataSize = JSON.stringify(LStorage._storageData).length;
            KernelLogger.info("LStorage", `存储数据保存成功 (大小: ${savedDataSize} 字节, 系统键: ${systemKeys.length})`);
            if (systemKeys.includes('system.desktopBackground')) {
                KernelLogger.debug("LStorage", `桌面背景已保存到文件: ${LStorage._storageData.system['system.desktopBackground']}`);
            }
        } catch (error) {
            // 如果错误是 D: 分区不存在或未初始化，这是预期的、可恢复的情况
            // 调用者会处理这种情况并安排延迟保存，所以使用 debug 级别
            if (error.message && (error.message.includes('分区不存在') || error.message.includes('分区未初始化'))) {
                KernelLogger.debug("LStorage", `保存存储数据失败（预期情况）: ${error.message}`);
            } else {
                // 其他错误是真正的错误，使用 error 级别
                KernelLogger.error("LStorage", `保存存储数据失败: ${error.message}`, error);
            }
            throw error; // 重新抛出错误，让调用者知道保存失败
        }
    }
    
    /**
     * 注册程序的本地存储申请
     * @param {number} pid 进程ID
     * @param {string} key 存储键
     * @param {any} defaultValue 默认值（可选）
     * @returns {Promise<boolean>} 是否成功
     */
    static async registerProgramStorage(pid, key, defaultValue = null) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        KernelLogger.info("LStorage", `注册程序存储: PID=${pid}, Key=${key}`);
        
        try {
            // 确保程序数据对象存在
            if (!LStorage._storageData.programs[pid]) {
                LStorage._storageData.programs[pid] = {};
            }
            
            // 如果键不存在，设置默认值
            if (!(key in LStorage._storageData.programs[pid])) {
                LStorage._storageData.programs[pid][key] = defaultValue;
            }
            
            // 保存到文件
            await LStorage._saveStorageData();
            
            KernelLogger.info("LStorage", `程序存储注册成功: PID=${pid}, Key=${key}`);
            return true;
        } catch (error) {
            KernelLogger.error("LStorage", `注册程序存储失败: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * 读取程序的本地存储数据
     * @param {number} pid 进程ID
     * @param {string} key 存储键
     * @returns {Promise<any>} 存储的值，如果不存在返回 null
     */
    static async getProgramStorage(pid, key) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        try {
            if (!LStorage._storageData.programs[pid]) {
                return null;
            }
            
            return LStorage._storageData.programs[pid][key] ?? null;
        } catch (error) {
            KernelLogger.error("LStorage", `读取程序存储失败: ${error.message}`, error);
            return null;
        }
    }
    
    /**
     * 写入程序的本地存储数据
     * @param {number} pid 进程ID
     * @param {string} key 存储键
     * @param {any} value 存储的值
     * @returns {Promise<boolean>} 是否成功
     */
    static async setProgramStorage(pid, key, value) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        KernelLogger.info("LStorage", `写入程序存储: PID=${pid}, Key=${key}`);
        
        try {
            // 确保程序数据对象存在
            if (!LStorage._storageData.programs[pid]) {
                LStorage._storageData.programs[pid] = {};
            }
            
            // 设置值
            LStorage._storageData.programs[pid][key] = value;
            
            // 保存到文件
            await LStorage._saveStorageData();
            
            KernelLogger.debug("LStorage", `程序存储写入成功: PID=${pid}, Key=${key}`);
            return true;
        } catch (error) {
            KernelLogger.error("LStorage", `写入程序存储失败: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * 删除程序的本地存储数据
     * @param {number} pid 进程ID
     * @param {string} key 存储键（可选，如果不提供则删除整个程序的数据）
     * @returns {Promise<boolean>} 是否成功
     */
    static async deleteProgramStorage(pid, key = null) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        KernelLogger.info("LStorage", `删除程序存储: PID=${pid}, Key=${key || 'all'}`);
        
        try {
            if (!LStorage._storageData.programs[pid]) {
                return true; // 不存在，视为成功
            }
            
            if (key === null) {
                // 删除整个程序的数据
                delete LStorage._storageData.programs[pid];
            } else {
                // 删除指定的键
                delete LStorage._storageData.programs[pid][key];
            }
            
            // 保存到文件
            await LStorage._saveStorageData();
            
            KernelLogger.info("LStorage", `程序存储删除成功: PID=${pid}, Key=${key || 'all'}`);
            return true;
        } catch (error) {
            KernelLogger.error("LStorage", `删除程序存储失败: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * 读取系统本地存储数据
     * @param {string} key 存储键
     * @returns {Promise<any>} 存储的值，如果不存在返回 null
     */
    static async getSystemStorage(key) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        try {
            return LStorage._storageData.system[key] ?? null;
        } catch (error) {
            KernelLogger.error("LStorage", `读取系统存储失败: ${error.message}`, error);
            return null;
        }
    }
    
    /**
     * 写入系统本地存储数据
     * @param {string} key 存储键
     * @param {any} value 存储的值
     * @returns {Promise<boolean>} 是否成功
     */
    static async setSystemStorage(key, value) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        KernelLogger.info("LStorage", `写入系统存储: Key=${key}`);
        
        try {
            // 先更新内存中的数据
            LStorage._storageData.system[key] = value;
            
            // 尝试保存到文件系统
            try {
                await LStorage._saveStorageData();
                KernelLogger.debug("LStorage", `系统存储写入成功: Key=${key}`);
                return true;
            } catch (saveError) {
                // 如果保存失败，但数据已经在内存中，记录警告但不返回错误
                // 这样调用者可以继续使用，数据会在下次成功保存时持久化
                if (saveError.message && (saveError.message.includes('分区不存在') || saveError.message.includes('分区未初始化'))) {
                    KernelLogger.debug("LStorage", `D: 分区尚未初始化，数据已保存在内存中，将在分区可用后自动保存: Key=${key}`);
                    // 安排延迟保存
                    LStorage._scheduleDelayedSave();
                    return true; // 返回成功，因为数据已经在内存中
                } else if (saveError.message && saveError.message.includes('空间不足')) {
                    // 空间不足错误：记录错误并返回失败
                    KernelLogger.error("LStorage", `保存系统存储失败: 磁盘空间不足 - ${saveError.message}`, saveError);
                    return false;
                } else {
                    // 其他错误，记录并返回失败
                    KernelLogger.warn("LStorage", `保存系统存储失败: ${saveError.message}`, saveError);
                    return false;
                }
            }
        } catch (error) {
            KernelLogger.error("LStorage", `写入系统存储失败: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * 延迟保存定时器
     */
    static _delayedSaveTimer = null;
    
    /**
     * 延迟保存检查间隔（毫秒）
     */
    static _delayedSaveInterval = 1000; // 1秒检查一次，更快响应
    
    /**
     * 最大延迟保存重试次数（避免无限重试）
     */
    static _maxDelayedSaveRetries = 300; // 最多重试300次（约5分钟）
    
    /**
     * 当前延迟保存重试次数
     */
    static _delayedSaveRetryCount = 0;
    
    /**
     * 安排延迟保存
     */
    static _scheduleDelayedSave() {
        // 清除之前的定时器
        if (LStorage._delayedSaveTimer) {
            clearTimeout(LStorage._delayedSaveTimer);
        }
        
        // 检查是否超过最大重试次数
        if (LStorage._delayedSaveRetryCount >= LStorage._maxDelayedSaveRetries) {
            KernelLogger.warn("LStorage", `延迟保存已达到最大重试次数（${LStorage._maxDelayedSaveRetries}），停止重试`);
            LStorage._delayedSaveRetryCount = 0;
            return;
        }
        
        // 设置新的延迟保存（1秒后重试，更快响应）
        LStorage._delayedSaveTimer = setTimeout(async () => {
            LStorage._delayedSaveTimer = null;
            LStorage._delayedSaveRetryCount++;
            
            try {
                await LStorage._saveStorageData();
                KernelLogger.info("LStorage", "延迟保存成功");
                LStorage._delayedSaveRetryCount = 0; // 重置重试计数
            } catch (e) {
                // 如果仍然失败，再次安排延迟保存
                if (e.message && (e.message.includes('分区不存在') || e.message.includes('分区未初始化'))) {
                    KernelLogger.debug("LStorage", `D: 分区仍未初始化，将继续等待（重试 ${LStorage._delayedSaveRetryCount}/${LStorage._maxDelayedSaveRetries}）`);
                    LStorage._scheduleDelayedSave();
                } else {
                    KernelLogger.warn("LStorage", `延迟保存失败: ${e.message}`);
                    LStorage._delayedSaveRetryCount = 0; // 重置重试计数（非分区错误）
                }
            }
        }, LStorage._delayedSaveInterval);
    }
    
    /**
     * 删除系统本地存储数据
     * @param {string} key 存储键
     * @returns {Promise<boolean>} 是否成功
     */
    static async deleteSystemStorage(key) {
        if (!LStorage._initialized) {
            await LStorage.init();
        }
        
        KernelLogger.info("LStorage", `删除系统存储: Key=${key}`);
        
        try {
            delete LStorage._storageData.system[key];
            await LStorage._saveStorageData();
            KernelLogger.info("LStorage", `系统存储删除成功: Key=${key}`);
            return true;
        } catch (error) {
            KernelLogger.error("LStorage", `删除系统存储失败: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * 获取所有程序的存储数据（用于调试）
     * @returns {Object} 所有程序的存储数据
     */
    static getAllProgramStorage() {
        if (!LStorage._initialized) {
            return {};
        }
        
        return LStorage._storageData.programs || {};
    }
    
    /**
     * 获取所有系统存储数据（用于调试）
     * @returns {Object} 所有系统存储数据
     */
    static getAllSystemStorage() {
        if (!LStorage._initialized) {
            return {};
        }
        
        return LStorage._storageData.system || {};
    }
}

// 辅助函数：从 POOL 或全局对象获取 FileType
function getFileType() {
    let FileTypeRef = null;
    if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
        try {
            FileTypeRef = POOL.__GET__("TYPE_POOL", "FileType");
        } catch (e) {}
    }
    if (!FileTypeRef && typeof FileType !== 'undefined') {
        FileTypeRef = FileType;
    }
    return FileTypeRef;
}

// 注册到 POOL
if (typeof POOL !== 'undefined' && typeof POOL.__ADD__ === 'function') {
    try {
        if (!POOL.__HAS__("KERNEL_GLOBAL_POOL")) {
            POOL.__INIT__("KERNEL_GLOBAL_POOL");
        }
        POOL.__ADD__("KERNEL_GLOBAL_POOL", "LStorage", LStorage);
    } catch (e) {
        KernelLogger.error("LStorage", `注册到POOL失败: ${e.message}`);
    }
}

// 发布信号
if (typeof DependencyConfig !== 'undefined') {
    DependencyConfig.publishSignal("../kernel/drive/LStorage.js");
}

