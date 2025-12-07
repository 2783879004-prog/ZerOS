// 文件系统初始化函数
async function init() {
    // fileSystem开始初始化
    KernelLogger.info("FSInit", "模块初始化");

    // 初始化磁盘虚拟硬件
    // 使用异步等待确保 Disk 模块已加载
    try {
        const Dependency = (typeof POOL !== 'undefined' && POOL && typeof POOL.__GET__ === 'function') 
            ? POOL.__GET__("KERNEL_GLOBAL_POOL", "Dependency") 
            : null;
        
        if (Dependency && typeof Dependency.waitLoaded === 'function') {
            // 等待Disk模块加载
            try {
                await Dependency.waitLoaded("../kernel/fileSystem/disk.js", {
                    interval: 50,
                    timeout: 2000,  // 增加超时时间
                });
                
                if (typeof Disk !== 'undefined' && Disk && typeof Disk.init === 'function') {
                    Disk.init();
                    KernelLogger.info("FSInit", "磁盘初始化已启动");
                } else {
                    KernelLogger.warn("FSInit", "Disk 模块未定义或缺少 init 方法");
                }
            } catch (e) {
                KernelLogger.error("FSInit", `等待Disk模块加载失败: ${e.message}`);
                // 尝试直接初始化（可能已经加载）
                if (typeof Disk !== 'undefined' && Disk && typeof Disk.init === 'function') {
                    Disk.init();
                    KernelLogger.info("FSInit", "磁盘初始化已启动（降级方案）");
                }
            }
        } else {
            // 如果 Dependency 不可用，直接尝试初始化（可能已经加载）
            if (typeof Disk !== 'undefined' && Disk && typeof Disk.init === 'function') {
                Disk.init();
                KernelLogger.info("FSInit", "磁盘初始化已启动（直接调用）");
            } else {
                KernelLogger.warn("FSInit", "Dependency 或 Disk 未加载，延迟初始化");
                // 延迟重试（最多重试5次）
                let retryCount = 0;
                const maxRetries = 5;
                const retryInterval = 200;
                
                const retryInit = () => {
                    if (retryCount >= maxRetries) {
                        if (typeof KernelLogger !== 'undefined') {
                            KernelLogger.error("FSInit", "磁盘初始化重试次数超限，停止重试");
                        } else {
                            console.error("[内核][FSInit] 磁盘初始化重试次数超限");
                        }
                        return;
                    }
                    
                    retryCount++;
                    setTimeout(() => {
                        if (typeof Disk !== 'undefined' && Disk && typeof Disk.init === 'function') {
                            try {
                                Disk.init();
                                if (typeof KernelLogger !== 'undefined') {
                                    KernelLogger.info("FSInit", `磁盘初始化已启动（延迟重试 ${retryCount}）`);
                                }
                            } catch (e) {
                                // 如果初始化失败，不再重试
                                if (typeof KernelLogger !== 'undefined') {
                                    KernelLogger.error("FSInit", `磁盘初始化失败: ${e.message}`);
                                }
                            }
                        } else if (retryCount < maxRetries) {
                            // 只有在还有重试次数时才继续
                            retryInit();
                        }
                    }, retryInterval);
                };
                
                retryInit();
            }
        }
    } catch (e) {
        KernelLogger.error("FSInit", `初始化失败: ${e.message}`, e);
        // 即使失败也发布信号，避免阻塞其他模块
    }

    // 等待磁盘初始化完成，然后映射应用程序到D:盘
    const mapApplicationsToDisk = async () => {
        // 等待磁盘可用
        let checkCount = 0;
        const maxChecks = 40;
        while (checkCount < maxChecks) {
            try {
                if (typeof Disk !== 'undefined' && Disk && Disk.canUsed === true) {
                    break;
                }
            } catch (e) {
                // 忽略错误，继续等待
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            checkCount++;
        }
        
        if (checkCount >= maxChecks) {
            KernelLogger.warn("FSInit", "磁盘初始化超时，跳过应用程序映射");
            return;
        }
        
        // 等待 ApplicationAssetManager 加载
        let assetManager = null;
        if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
            try {
                assetManager = POOL.__GET__("KERNEL_GLOBAL_POOL", "ApplicationAssetManager");
            } catch (e) {
                // 忽略错误
            }
        }
        
        if (!assetManager && typeof ApplicationAssetManager !== 'undefined') {
            assetManager = ApplicationAssetManager;
        }
        
        if (!assetManager) {
            KernelLogger.warn("FSInit", "ApplicationAssetManager 不可用，跳过应用程序映射");
            return;
        }
        
        // 等待 ApplicationAssetManager 初始化
        if (typeof assetManager.init === 'function') {
            try {
                await assetManager.init();
            } catch (e) {
                KernelLogger.warn("FSInit", `ApplicationAssetManager 初始化失败: ${e.message}`);
            }
        }
        
        // 获取所有程序
        let programs = [];
        try {
            programs = assetManager.listAllPrograms();
        } catch (e) {
            KernelLogger.warn("FSInit", `获取程序列表失败: ${e.message}`);
            return;
        }
        
        // 获取D:盘的NodeTreeCollection（注意：key是"D:"，不是"D"）
        // 需要等待D:盘格式化完成
        let dDisk = null;
        let checkDiskCount = 0;
        const maxDiskChecks = 50;  // 最多等待5秒（50 * 100ms）
        
        while (checkDiskCount < maxDiskChecks && !dDisk) {
            if (typeof POOL !== 'undefined' && typeof POOL.__GET__ === 'function') {
                try {
                    dDisk = POOL.__GET__("KERNEL_GLOBAL_POOL", "D:");
                    // 验证是否是有效的NodeTreeCollection对象
                    if (dDisk && typeof dDisk === 'object' && typeof dDisk.create_link === 'function') {
                        break;  // 找到有效的D:盘
                    } else {
                        dDisk = null;  // 重置，继续等待
                    }
                } catch (e) {
                    // 忽略错误，继续等待
                }
            }
            
            if (!dDisk) {
                await new Promise(resolve => setTimeout(resolve, 100));
                checkDiskCount++;
            }
        }
        
        if (!dDisk) {
            KernelLogger.warn("FSInit", "D:盘不可用或未格式化完成，跳过应用程序映射");
            return;
        }
        
        // 确保D:盘已初始化
        if (!dDisk.initialized) {
            KernelLogger.debug("FSInit", "等待D:盘初始化完成");
            let initCheckCount = 0;
            const maxInitChecks = 30;  // 最多等待3秒
            while (initCheckCount < maxInitChecks && !dDisk.initialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
                initCheckCount++;
            }
            if (!dDisk.initialized) {
                KernelLogger.warn("FSInit", "D:盘初始化超时，跳过应用程序映射");
                return;
            }
        }
        
        // 为每个程序创建映射
        for (const program of programs) {
            try {
                const programName = program.name;
                const programPath = `D:/${programName}`;
                
                // 检查程序目录是否已存在
                if (dDisk.nodes.has(programPath)) {
                    KernelLogger.debug("FSInit", `程序目录已存在: ${programPath}`);
                    continue;
                }
                
                // 创建程序目录（作为链接目录，指向实际程序文件夹）
                // 实际路径：application/{programName}/
                const actualPath = `application/${programName}`;
                dDisk.create_link_dir("D:", programName, actualPath);
                KernelLogger.info("FSInit", `已创建程序目录链接: ${programPath} -> ${actualPath}`);
                
                // 等待目录节点完全创建并注册
                // 确保节点已存在于 nodes Map 中
                let dirNodeReady = false;
                let dirCheckCount = 0;
                const maxDirChecks = 10;
                while (dirCheckCount < maxDirChecks && !dirNodeReady) {
                    if (dDisk.nodes.has(programPath)) {
                        dirNodeReady = true;
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                    dirCheckCount++;
                }
                
                if (!dirNodeReady) {
                    KernelLogger.warn("FSInit", `程序目录节点未就绪: ${programPath}，跳过文件链接创建`);
                    continue;
                }
                
                // 创建程序文件链接
                if (program.script) {
                    // 提取文件名
                    const scriptFileName = program.script.split('/').pop();
                    const scriptPath = `D:/${programName}/${scriptFileName}`;
                    const actualScriptPath = program.script;
                    dDisk.create_link(programPath, scriptFileName, actualScriptPath);
                    KernelLogger.info("FSInit", `已创建程序脚本链接: ${scriptPath} -> ${actualScriptPath}`);
                }
                
                // 创建样式文件链接
                if (program.styles && Array.isArray(program.styles)) {
                    for (const stylePath of program.styles) {
                        const styleFileName = stylePath.split('/').pop();
                        const styleLinkPath = `D:/${programName}/${styleFileName}`;
                        dDisk.create_link(programPath, styleFileName, stylePath);
                        KernelLogger.info("FSInit", `已创建样式文件链接: ${styleLinkPath} -> ${stylePath}`);
                    }
                }
                
                // 创建图标文件链接
                if (program.icon) {
                    const iconFileName = program.icon.split('/').pop();
                    const iconLinkPath = `D:/${programName}/${iconFileName}`;
                    dDisk.create_link(programPath, iconFileName, program.icon);
                    KernelLogger.info("FSInit", `已创建图标文件链接: ${iconLinkPath} -> ${program.icon}`);
                }
                
            } catch (e) {
                KernelLogger.error("FSInit", `映射程序 ${program.name} 失败: ${e.message}`, e);
            }
        }
        
        KernelLogger.info("FSInit", "应用程序映射完成");
    };
    
    // 延迟执行应用程序映射（确保所有依赖都已加载）
    setTimeout(() => {
        mapApplicationsToDisk().catch(e => {
            KernelLogger.error("FSInit", `应用程序映射失败: ${e.message}`, e);
        });
    }, 1000);

    // fileSystem初始化完成
    if (typeof DependencyConfig !== 'undefined' && DependencyConfig && typeof DependencyConfig.publishSignal === 'function') {
        DependencyConfig.publishSignal("../kernel/fileSystem/init.js");
    }
}

// 自动初始化（如果DOM已就绪）
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch(e => {
                KernelLogger.error("FSInit", `自动初始化失败: ${e.message}`, e);
            });
        });
    } else {
        // DOM已就绪，立即初始化
        init().catch(e => {
            KernelLogger.error("FSInit", `自动初始化失败: ${e.message}`, e);
        });
    }
} else {
    // 非浏览器环境，直接初始化
    init().catch(e => {
        if (typeof KernelLogger !== 'undefined') {
            KernelLogger.error("FSInit", `初始化失败: ${e.message}`, e);
        } else {
            console.error("[内核][FSInit] 初始化失败", e);
        }
    });
}
