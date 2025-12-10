// ZerOS 贪吃蛇游戏
// 简单的GUI贪吃蛇游戏

(function(window) {
    'use strict';
    
    const SNAKE = {
        pid: null,
        window: null,
        canvas: null,
        ctx: null,
        gameLoop: null,
        
        // 内存管理引用（动态数据存储在内存中）
        _heap: null,
        _shed: null,
        
        // 游戏状态（存储在内存中，这里只是缓存引用）
        _gameStateKey: 'gameState',
        _scoreKey: 'score',
        _highScoreKey: 'highScore',
        _snakeKey: 'snake',
        _directionKey: 'direction',
        _nextDirectionKey: 'nextDirection',
        _foodKey: 'food',
        
        // 游戏配置（常量，可以保留在变量中）
        gridSize: 20, // 网格大小
        tileCount: 20, // 每边的格子数
        baseGameSpeed: 150, // 基础游戏速度（毫秒）
        gameSpeed: 150, // 当前游戏速度（毫秒）
        speedIncreaseInterval: 5, // 每吃多少个食物增加速度
        speedIncreaseAmount: 10, // 每次增加速度的毫秒数（减少延迟）
        minGameSpeed: 50, // 最小游戏速度（最快）
        
        // 游戏统计
        _gamesPlayedKey: 'gamesPlayed',
        _totalPlayTimeKey: 'totalPlayTime',
        _gameStartTime: null,
        
        __init__: async function(pid, initArgs) {
            this.pid = pid;
            
            // 初始化内存管理
            this._initMemory(pid);
            
            // 获取 GUI 容器
            const guiContainer = initArgs.guiContainer || document.getElementById('gui-container');
            
            // 创建主窗口
            this.window = document.createElement('div');
            this.window.className = 'snake-window zos-gui-window';
            this.window.dataset.pid = pid.toString();
            
            // 窗口样式
            if (typeof GUIManager === 'undefined') {
                this.window.style.cssText = `
                    width: 600px;
                    height: 700px;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(180deg, rgba(26, 31, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 12px;
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(20px);
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
                    icon = ApplicationAssetManager.getIcon('snake');
                }
                
                GUIManager.registerWindow(pid, this.window, {
                    title: '贪吃蛇',
                    icon: icon,
                    onClose: () => {
                        if (typeof ProcessManager !== 'undefined') {
                            ProcessManager.killProgram(this.pid);
                        }
                    }
                });
            }
            
            // 创建游戏界面
            this._createGameUI();
            
            // 添加到容器
            guiContainer.appendChild(this.window);
            
            // 初始化游戏（异步）
            await this._initGame();
            
            // 绑定键盘事件
            this._bindKeyboardEvents();
            
            // 如果使用GUIManager，窗口已自动居中并获得焦点
            if (typeof GUIManager !== 'undefined') {
                GUIManager.focusWindow(pid);
            }
        },
        
        /**
         * 创建游戏UI
         */
        _createGameUI: function() {
            // 标题栏（如果GUIManager不可用）
            if (typeof GUIManager === 'undefined') {
                const titleBar = document.createElement('div');
                titleBar.style.cssText = `
                    height: 40px;
                    padding: 0 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
                    background: rgba(30, 30, 46, 0.8);
                `;
                
                const title = document.createElement('div');
                title.textContent = '贪吃蛇';
                title.style.cssText = `
                    font-size: 14px;
                    font-weight: 600;
                    color: #e8ecf0;
                `;
                titleBar.appendChild(title);
                
                this.window.appendChild(titleBar);
            }
            
            // 信息栏
            const infoBar = document.createElement('div');
            infoBar.className = 'snake-info-bar';
            infoBar.style.cssText = `
                height: 60px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(139, 92, 246, 0.2);
                background: rgba(30, 30, 46, 0.6);
            `;
            
            // 分数显示
            const scoreContainer = document.createElement('div');
            scoreContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;
            
            const scoreLabel = document.createElement('div');
            scoreLabel.textContent = '分数';
            scoreLabel.style.cssText = `
                font-size: 11px;
                color: rgba(232, 236, 240, 0.6);
            `;
            
            this.scoreDisplay = document.createElement('div');
            this.scoreDisplay.textContent = '0';
            this.scoreDisplay.style.cssText = `
                font-size: 20px;
                font-weight: 700;
                color: #8b5cf6;
            `;
            
            scoreContainer.appendChild(scoreLabel);
            scoreContainer.appendChild(this.scoreDisplay);
            infoBar.appendChild(scoreContainer);
            
            // 最高分显示
            const highScoreContainer = document.createElement('div');
            highScoreContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: flex-end;
            `;
            
            const highScoreLabel = document.createElement('div');
            highScoreLabel.textContent = '最高分';
            highScoreLabel.style.cssText = `
                font-size: 11px;
                color: rgba(232, 236, 240, 0.6);
            `;
            
            this.highScoreDisplay = document.createElement('div');
            this.highScoreDisplay.textContent = '0';
            this.highScoreDisplay.style.cssText = `
                font-size: 20px;
                font-weight: 700;
                color: #14ffec;
            `;
            
            highScoreContainer.appendChild(highScoreLabel);
            highScoreContainer.appendChild(this.highScoreDisplay);
            infoBar.appendChild(highScoreContainer);
            
            // 游戏统计显示（可选，显示在控制栏上方）
            this.statsDisplay = document.createElement('div');
            this.statsDisplay.style.cssText = `
                font-size: 10px;
                color: rgba(232, 236, 240, 0.5);
                text-align: center;
                padding: 4px 0;
            `;
            this._updateStatsDisplay();
            
            this.window.appendChild(infoBar);
            
            // 游戏画布容器
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'snake-canvas-container';
            canvasContainer.style.cssText = `
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(10, 14, 26, 0.8);
                padding: 20px;
                position: relative;
                overflow: hidden;
            `;
            
            // 创建画布
            this.canvas = document.createElement('canvas');
            this.canvas.className = 'snake-canvas';
            const canvasSize = 400; // 画布大小
            this.canvas.width = canvasSize;
            this.canvas.height = canvasSize;
            this.canvas.style.cssText = `
                border: 2px solid rgba(139, 92, 246, 0.3);
                border-radius: 8px;
                background: rgba(15, 20, 35, 0.9);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            `;
            
            this.ctx = this.canvas.getContext('2d');
            canvasContainer.appendChild(this.canvas);
            
            // 游戏状态提示
            this.statusOverlay = document.createElement('div');
            this.statusOverlay.className = 'snake-status-overlay';
            this.statusOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(10, 14, 26, 0.9);
                backdrop-filter: blur(10px);
                z-index: 10;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            this.statusText = document.createElement('div');
            this.statusText.style.cssText = `
                font-size: 32px;
                font-weight: 700;
                color: #8b5cf6;
                margin-bottom: 16px;
                text-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
            `;
            
            this.statusSubtext = document.createElement('div');
            this.statusSubtext.style.cssText = `
                font-size: 14px;
                color: rgba(232, 236, 240, 0.7);
            `;
            
            this.statusOverlay.appendChild(this.statusText);
            this.statusOverlay.appendChild(this.statusSubtext);
            canvasContainer.appendChild(this.statusOverlay);
            
            this.window.appendChild(canvasContainer);
            
            // 控制按钮栏
            const controlBar = document.createElement('div');
            controlBar.className = 'snake-control-bar';
            controlBar.style.cssText = `
                height: 80px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                border-top: 1px solid rgba(139, 92, 246, 0.2);
                background: rgba(30, 30, 46, 0.6);
            `;
            
            // 开始/暂停按钮
            this.startPauseBtn = this._createButton('开始游戏', () => {
                const gameState = this._getGameStateValue();
                if (gameState === 'ready' || gameState === 'gameover') {
                    this._startGame();
                } else if (gameState === 'playing') {
                    this._pauseGame();
                } else if (gameState === 'paused') {
                    this._resumeGame();
                }
            });
            controlBar.appendChild(this.startPauseBtn);
            
            // 重置按钮
            const resetBtn = this._createButton('重置', () => {
                this._resetGame();
            });
            controlBar.appendChild(resetBtn);
            
            // 在控制栏前插入统计信息
            this.window.appendChild(this.statsDisplay);
            this.window.appendChild(controlBar);
        },
        
        /**
         * 创建按钮
         */
        _createButton: function(text, onClick) {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `
                padding: 10px 24px;
                border: 1px solid rgba(139, 92, 246, 0.3);
                background: rgba(139, 92, 246, 0.1);
                color: #8b5cf6;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(139, 92, 246, 0.2)';
                btn.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(139, 92, 246, 0.1)';
                btn.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
            
            btn.addEventListener('click', onClick);
            
            return btn;
        },
        
        /**
         * 初始化游戏
         */
        _initGame: async function() {
            // 加载最高分
            const savedHighScore = await this._getHighScore();
            if (savedHighScore > 0) {
                await this._setHighScore(savedHighScore);
            } else if (this.highScoreDisplay) {
                this.highScoreDisplay.textContent = '0';
            }
            
            // 初始化蛇（从中心开始，长度为3）
            const centerX = Math.floor(this.tileCount / 2);
            const centerY = Math.floor(this.tileCount / 2);
            this._setSnake([
                { x: centerX, y: centerY },
                { x: centerX - 1, y: centerY },
                { x: centerX - 2, y: centerY }
            ]);
            
            // 初始化方向
            this._setDirection({ x: 1, y: 0 });
            this._setNextDirection({ x: 1, y: 0 });
            
            // 生成食物
            this._generateFood();
            
            // 重置分数
            this._setScore(0);
            if (this.scoreDisplay) {
                this.scoreDisplay.textContent = '0';
            }
            
            // 重置游戏速度
            this.gameSpeed = this.baseGameSpeed;
            
            // 设置游戏状态
            this._setGameStateValue('ready');
            this._updateStatusOverlay('准备开始', '按"开始游戏"或空格键开始');
            
            // 绘制初始状态
            this._draw();
        },
        
        /**
         * 生成食物
         */
        _generateFood: function() {
            let newFood;
            do {
                newFood = {
                    x: Math.floor(Math.random() * this.tileCount),
                    y: Math.floor(Math.random() * this.tileCount)
                };
            } while (this._isSnakePosition(newFood.x, newFood.y));
            
            this._setFood(newFood);
        },
        
        /**
         * 检查位置是否在蛇身上
         */
        _isSnakePosition: function(x, y) {
            const snake = this._getSnake();
            return snake.some(segment => segment.x === x && segment.y === y);
        },
        
        /**
         * 开始游戏
         */
        _startGame: function() {
            this._setGameStateValue('playing');
            this._updateStatusOverlay('', '');
            this.startPauseBtn.textContent = '暂停';
            
            // 记录游戏开始时间
            this._gameStartTime = Date.now();
            
            // 增加游戏次数
            const gamesPlayed = this._getGamesPlayed() + 1;
            this._setGamesPlayed(gamesPlayed);
            this._updateStatsDisplay();
            
            // 启动游戏循环
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
            }
            
            this._startGameLoop();
        },
        
        /**
         * 启动游戏循环（使用当前速度）
         */
        _startGameLoop: function() {
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
            }
            this.gameLoop = setInterval(() => {
                this._gameStep();
            }, this.gameSpeed);
        },
        
        /**
         * 暂停游戏
         */
        _pauseGame: function() {
            this._setGameStateValue('paused');
            this._updateStatusOverlay('游戏暂停', '按"继续"或空格键继续');
            this.startPauseBtn.textContent = '继续';
            
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
                this.gameLoop = null;
            }
        },
        
        /**
         * 继续游戏
         */
        _resumeGame: function() {
            this._setGameStateValue('playing');
            this._updateStatusOverlay('', '');
            this.startPauseBtn.textContent = '暂停';
            
            this._startGameLoop();
        },
        
        /**
         * 重置游戏
         */
        _resetGame: function() {
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
                this.gameLoop = null;
            }
            
            // 重置游戏开始时间
            this._gameStartTime = null;
            
            // 重置游戏状态
            this._setGameStateValue('ready');
            
            // 重新初始化游戏（异步，不阻塞）
            this._initGame().then(() => {
                // 重新绘制画布，确保蛇的位置正确显示
                this._draw();
            }).catch(e => {
                console.warn('[Snake] 重新初始化游戏失败:', e);
                // 即使失败也绘制
                this._draw();
            });
            
            this.startPauseBtn.textContent = '开始游戏';
        },
        
        /**
         * 游戏步骤
         */
        _gameStep: function() {
            // 更新方向
            const nextDirection = this._getNextDirection();
            this._setDirection({ ...nextDirection });
            
            // 计算新头部位置
            const snake = this._getSnake();
            const direction = this._getDirection();
            const head = snake[0];
            const newHead = {
                x: head.x + direction.x,
                y: head.y + direction.y
            };
            
            // 检查碰撞
            if (this._checkCollision(newHead)) {
                this._gameOver();
                return;
            }
            
            // 添加新头部
            snake.unshift(newHead);
            
            // 检查是否吃到食物
            const food = this._getFood();
            if (newHead.x === food.x && newHead.y === food.y) {
                // 吃到食物，不删除尾部，增加分数
                const newScore = this._getScore() + 10;
                this._setScore(newScore);
                
                // 更新最高分（异步，不阻塞游戏循环）
                this._getHighScore().then(highScore => {
                    if (newScore > highScore) {
                        this._setHighScore(newScore).catch(e => {
                            console.warn('[Snake] 保存最高分失败:', e);
                        });
                    }
                }).catch(e => {
                    console.warn('[Snake] 读取最高分失败:', e);
                });
                
                // 根据分数调整游戏速度（难度递增）
                const foodCount = Math.floor(newScore / 10);
                if (foodCount > 0 && foodCount % this.speedIncreaseInterval === 0) {
                    const newSpeed = Math.max(
                        this.minGameSpeed,
                        this.gameSpeed - this.speedIncreaseAmount
                    );
                    if (newSpeed !== this.gameSpeed) {
                        this.gameSpeed = newSpeed;
                        // 重新启动游戏循环以应用新速度
                        this._startGameLoop();
                    }
                }
                
                // 生成新食物
                this._generateFood();
            } else {
                // 没吃到食物，删除尾部
                snake.pop();
            }
            
            // 保存更新后的蛇
            this._setSnake(snake);
            
            // 绘制
            this._draw();
        },
        
        /**
         * 检查碰撞
         */
        _checkCollision: function(head) {
            // 检查墙壁碰撞
            if (head.x < 0 || head.x >= this.tileCount || 
                head.y < 0 || head.y >= this.tileCount) {
                return true;
            }
            
            // 检查自身碰撞
            const snake = this._getSnake();
            for (let i = 1; i < snake.length; i++) {
                if (head.x === snake[i].x && head.y === snake[i].y) {
                    return true;
                }
            }
            
            return false;
        },
        
        /**
         * 游戏结束
         */
        _gameOver: function() {
            this._setGameStateValue('gameover');
            const score = this._getScore();
            
            // 计算游戏时间
            if (this._gameStartTime) {
                const playTime = Math.floor((Date.now() - this._gameStartTime) / 1000);
                const totalPlayTime = this._getTotalPlayTime() + playTime;
                this._setTotalPlayTime(totalPlayTime);
                this._gameStartTime = null;
            }
            
            // 显示游戏结束信息（异步加载最高分）
            this._getHighScore().then(highScore => {
                let message = `最终分数: ${score}`;
                if (score === highScore && score > 0) {
                    message += ' 🎉 新纪录！';
                }
                this._updateStatusOverlay('游戏结束', message);
            }).catch(e => {
                console.warn('[Snake] 读取最高分失败:', e);
                this._updateStatusOverlay('游戏结束', `最终分数: ${score}`);
            });
            this.startPauseBtn.textContent = '重新开始';
            
            if (this.gameLoop) {
                clearInterval(this.gameLoop);
                this.gameLoop = null;
            }
            
            // 游戏结束时也重新绘制，确保显示正确的状态
            this._draw();
        },
        
        /**
         * 更新状态覆盖层
         */
        _updateStatusOverlay: function(text, subtext) {
            if (text) {
                this.statusText.textContent = text;
                this.statusSubtext.textContent = subtext;
                this.statusOverlay.style.opacity = '1';
                this.statusOverlay.style.pointerEvents = 'auto';
            } else {
                this.statusOverlay.style.opacity = '0';
                this.statusOverlay.style.pointerEvents = 'none';
            }
        },
        
        /**
         * 绘制游戏
         */
        _draw: function() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            const tileSize = canvas.width / this.tileCount;
            
            // 清空画布
            ctx.fillStyle = 'rgba(15, 20, 35, 0.9)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 绘制网格
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= this.tileCount; i++) {
                const pos = i * tileSize;
                ctx.beginPath();
                ctx.moveTo(pos, 0);
                ctx.lineTo(pos, canvas.height);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(0, pos);
                ctx.lineTo(canvas.width, pos);
                ctx.stroke();
            }
            
            // 绘制食物
            const food = this._getFood();
            ctx.fillStyle = '#ff5f57';
            ctx.shadowColor = 'rgba(255, 95, 87, 0.6)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(
                food.x * tileSize + tileSize / 2,
                food.y * tileSize + tileSize / 2,
                tileSize / 2 - 2,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // 绘制蛇
            const snake = this._getSnake();
            snake.forEach((segment, index) => {
                const x = segment.x * tileSize;
                const y = segment.y * tileSize;
                
                if (index === 0) {
                    // 蛇头 - 更明显的视觉效果
                    const gradient = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                    gradient.addColorStop(0, '#8b5cf6');
                    gradient.addColorStop(1, '#6d28d9');
                    ctx.fillStyle = gradient;
                    ctx.shadowColor = 'rgba(139, 92, 246, 0.8)';
                    ctx.shadowBlur = 12;
                    
                    // 绘制眼睛
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                    ctx.shadowBlur = 0;
                    
                    // 眼睛
                    const eyeSize = 3;
                    const eyeOffset = 4;
                    const direction = this._getDirection();
                    
                    ctx.fillStyle = '#ffffff';
                    if (direction.x === 1) { // 向右
                        ctx.fillRect(x + tileSize - eyeOffset - eyeSize, y + eyeOffset, eyeSize, eyeSize);
                        ctx.fillRect(x + tileSize - eyeOffset - eyeSize, y + tileSize - eyeOffset - eyeSize, eyeSize, eyeSize);
                    } else if (direction.x === -1) { // 向左
                        ctx.fillRect(x + eyeOffset, y + eyeOffset, eyeSize, eyeSize);
                        ctx.fillRect(x + eyeOffset, y + tileSize - eyeOffset - eyeSize, eyeSize, eyeSize);
                    } else if (direction.y === -1) { // 向上
                        ctx.fillRect(x + eyeOffset, y + eyeOffset, eyeSize, eyeSize);
                        ctx.fillRect(x + tileSize - eyeOffset - eyeSize, y + eyeOffset, eyeSize, eyeSize);
                    } else if (direction.y === 1) { // 向下
                        ctx.fillRect(x + eyeOffset, y + tileSize - eyeOffset - eyeSize, eyeSize, eyeSize);
                        ctx.fillRect(x + tileSize - eyeOffset - eyeSize, y + tileSize - eyeOffset - eyeSize, eyeSize, eyeSize);
                    }
                } else {
                    // 蛇身 - 渐变效果
                    const alpha = 1 - (index / snake.length) * 0.3; // 尾部逐渐变淡
                    ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
                    ctx.shadowColor = `rgba(167, 139, 250, ${alpha * 0.4})`;
                    ctx.shadowBlur = 4;
                    
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                    ctx.shadowBlur = 0;
                }
            });
        },
        
        /**
         * 绑定键盘事件
         */
        _bindKeyboardEvents: function() {
            document.addEventListener('keydown', (e) => {
                // 只在窗口获得焦点时处理
                if (!this.window || !this.window.classList.contains('zos-window-focused')) {
                    return;
                }
                
                // 防止默认行为
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
                    e.preventDefault();
                }
                
                // 方向键控制
                const gameState = this._getGameStateValue();
                if (gameState === 'playing') {
                    const direction = this._getDirection();
                    if (e.key === 'ArrowUp' && direction.y === 0) {
                        this._setNextDirection({ x: 0, y: -1 });
                    } else if (e.key === 'ArrowDown' && direction.y === 0) {
                        this._setNextDirection({ x: 0, y: 1 });
                    } else if (e.key === 'ArrowLeft' && direction.x === 0) {
                        this._setNextDirection({ x: -1, y: 0 });
                    } else if (e.key === 'ArrowRight' && direction.x === 0) {
                        this._setNextDirection({ x: 1, y: 0 });
                    }
                }
                
                // 空格键开始/暂停
                if (e.key === ' ' || e.key === 'Space') {
                    if (gameState === 'ready' || gameState === 'gameover') {
                        this._startGame();
                    } else if (gameState === 'playing') {
                        this._pauseGame();
                    } else if (gameState === 'paused') {
                        this._resumeGame();
                    }
                }
            });
        },
        
        /**
         * 初始化内存管理
         */
        _initMemory: function(pid) {
            if (!pid) {
                console.warn('Snake: PID not available');
                return;
            }
            
            // 确保内存已分配
            if (typeof MemoryUtils !== 'undefined') {
                const mem = MemoryUtils.ensureMemory(pid, 50000, 1000);
                if (mem) {
                    this._heap = mem.heap;
                    this._shed = mem.shed;
                }
            } else if (typeof MemoryManager !== 'undefined') {
                // 降级方案：直接使用MemoryManager
                try {
                    const result = MemoryManager.allocateMemory(pid, 50000, 1000, 1, 1);
                    this._heap = result.heap;
                    this._shed = result.shed;
                } catch (e) {
                    console.error('Snake: Error allocating memory', e);
                }
            }
        },
        
        /**
         * 数据访问方法（getter/setter）
         */
        _getGameStateValue: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                return MemoryUtils.loadString(this.pid, this._gameStateKey) || 'ready';
            }
            return 'ready';
        },
        
        _setGameStateValue: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeString(this.pid, this._gameStateKey, value || 'ready');
            }
        },
        
        _getScore: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const score = MemoryUtils.loadData(this.pid, this._scoreKey);
                return typeof score === 'number' ? score : 0;
            }
            return 0;
        },
        
        _setScore: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeData(this.pid, this._scoreKey, value || 0);
                // 更新显示
                if (this.scoreDisplay) {
                    this.scoreDisplay.textContent = value || 0;
                }
            }
        },
        
        _getHighScore: async function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const highScore = MemoryUtils.loadData(this.pid, this._highScoreKey);
                return typeof highScore === 'number' ? highScore : 0;
            }
            // 使用 LStorage 读取（通过 PHP 服务）- 使用程序名称而不是pid
            if (typeof LStorage !== 'undefined') {
                try {
                    const saved = await LStorage.getSystemStorage('snake.highScore');
                    return typeof saved === 'number' ? saved : 0;
                } catch (e) {
                    KernelLogger.warn("Snake", `读取最高分失败: ${e.message}`);
                    return 0;
                }
            }
            return 0;
        },
        
        _setHighScore: async function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeData(this.pid, this._highScoreKey, value || 0);
                // 更新显示
                if (this.highScoreDisplay) {
                    this.highScoreDisplay.textContent = value || 0;
                }
            }
            // 使用 LStorage 保存（通过 PHP 服务）- 使用程序名称而不是pid
            if (typeof LStorage !== 'undefined') {
                try {
                    await LStorage.setSystemStorage('snake.highScore', value || 0);
                } catch (e) {
                    KernelLogger.warn("Snake", `保存最高分失败: ${e.message}`);
                }
            }
        },
        
        _getSnake: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const snake = MemoryUtils.loadArray(this.pid, this._snakeKey);
                return Array.isArray(snake) ? snake : [];
            }
            return [];
        },
        
        _setSnake: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeArray(this.pid, this._snakeKey, Array.isArray(value) ? value : []);
            }
        },
        
        _getDirection: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const direction = MemoryUtils.loadObject(this.pid, this._directionKey);
                return direction && typeof direction === 'object' && 'x' in direction && 'y' in direction
                    ? direction
                    : { x: 1, y: 0 };
            }
            return { x: 1, y: 0 };
        },
        
        _setDirection: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeObject(this.pid, this._directionKey, value || { x: 1, y: 0 });
            }
        },
        
        _getNextDirection: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const nextDirection = MemoryUtils.loadObject(this.pid, this._nextDirectionKey);
                return nextDirection && typeof nextDirection === 'object' && 'x' in nextDirection && 'y' in nextDirection
                    ? nextDirection
                    : { x: 1, y: 0 };
            }
            return { x: 1, y: 0 };
        },
        
        _setNextDirection: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeObject(this.pid, this._nextDirectionKey, value || { x: 1, y: 0 });
            }
        },
        
        _getFood: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const food = MemoryUtils.loadObject(this.pid, this._foodKey);
                return food && typeof food === 'object' && 'x' in food && 'y' in food
                    ? food
                    : { x: 10, y: 10 };
            }
            return { x: 10, y: 10 };
        },
        
        _setFood: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeObject(this.pid, this._foodKey, value || { x: 10, y: 10 });
            }
        },
        
        _getGamesPlayed: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const gamesPlayed = MemoryUtils.loadData(this.pid, this._gamesPlayedKey);
                return typeof gamesPlayed === 'number' ? gamesPlayed : 0;
            }
            return 0;
        },
        
        _setGamesPlayed: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeData(this.pid, this._gamesPlayedKey, value || 0);
            }
        },
        
        _getTotalPlayTime: function() {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                const totalPlayTime = MemoryUtils.loadData(this.pid, this._totalPlayTimeKey);
                return typeof totalPlayTime === 'number' ? totalPlayTime : 0;
            }
            return 0;
        },
        
        _setTotalPlayTime: function(value) {
            if (typeof MemoryUtils !== 'undefined' && this.pid) {
                MemoryUtils.storeData(this.pid, this._totalPlayTimeKey, value || 0);
                this._updateStatsDisplay();
            }
        },
        
        /**
         * 更新统计信息显示
         */
        _updateStatsDisplay: function() {
            if (!this.statsDisplay) return;
            
            const gamesPlayed = this._getGamesPlayed();
            const totalPlayTime = this._getTotalPlayTime();
            const minutes = Math.floor(totalPlayTime / 60);
            const seconds = totalPlayTime % 60;
            
            let statsText = '';
            if (gamesPlayed > 0) {
                statsText += `游戏次数: ${gamesPlayed}`;
            }
            if (totalPlayTime > 0) {
                if (statsText) statsText += ' | ';
                statsText += `总游戏时间: ${minutes}分${seconds}秒`;
            }
            
            this.statsDisplay.textContent = statsText || '';
        },
        
        __exit__: async function() {
            try {
                // 停止游戏循环
                if (this.gameLoop) {
                    clearInterval(this.gameLoop);
                    this.gameLoop = null;
                }
                
                // 移除键盘事件监听器（通过移除窗口焦点检查来间接实现）
                
                // 移除 DOM 元素
                if (this.window && this.window.parentElement) {
                    this.window.parentElement.removeChild(this.window);
                }
                
                // 如果使用GUIManager，注销窗口
                if (typeof GUIManager !== 'undefined' && GUIManager.unregisterWindow) {
                    try {
                        GUIManager.unregisterWindow(this.pid);
                    } catch (e) {
                        console.warn('注销 GUIManager 窗口失败:', e);
                    }
                }
                
                // 清理引用
                this.window = null;
                this.canvas = null;
                this.ctx = null;
                this.gameLoop = null;
                
            } catch (error) {
                console.error('贪吃蛇游戏退出时发生错误:', error);
            }
        },
        
        __info__: function() {
            return {
                name: 'snake',
                type: 'GUI',
                version: '1.1.0',
                description: '贪吃蛇游戏 - 支持难度递增、游戏统计等功能',
                permissions: typeof PermissionManager !== 'undefined' ? [
                    PermissionManager.PERMISSION.GUI_WINDOW_CREATE
                ] : []
            };
        }
    };
    
    // 导出到全局
    if (typeof window !== 'undefined') {
        window.SNAKE = SNAKE;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.SNAKE = SNAKE;
    }
    
})(window);

