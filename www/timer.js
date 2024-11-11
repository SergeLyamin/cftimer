class Timer {
    constructor() {
        this.createMainMenu = this.createMainMenu.bind(this);
        this.createClockScreen = this.createClockScreen.bind(this);
        this.createIntervalScreen = this.createIntervalScreen.bind(this);
        this.createForTimeScreen = this.createForTimeScreen.bind(this);
        this.createAmrapScreen = this.createAmrapScreen.bind(this);

        this.screens = {
            'main-menu': this.createMainMenu,
            'clock': this.createClockScreen,
            'interval': this.createIntervalScreen,
            'fortime': this.createForTimeScreen,
            'amrap': this.createAmrapScreen
        };

        this.currentScreen = 'main-menu';
        this.interval = null;
        this.time = 0;
        this.isRunning = false;
        this.settings = {
            interval: {
                rounds: 8,
                workMinutes: 0,
                workSeconds: 20,
                restMinutes: 0,
                restSeconds: 10,
                countdownSeconds: 10
            },
            fortime: {
                targetMinutes: 10,
                targetSeconds: 0,
                countdownSeconds: 10
            },
            amrap: {
                targetMinutes: 10,
                targetSeconds: 0,
                countdownSeconds: 10
            }
        };

        this.translations = {
            'CLOCK': 'ЧАСЫ',
            'INTERVAL': 'EMOM / TABATA',
            'FOR TIME': 'НА ВРЕМЯ',
            'START': 'СТАРТ',
            'PAUSE': 'ПАУЗА',
            'RESET': 'СБРОС',
            'RESTART': 'ПЕРЕЗАПУСК',
            'ROUNDS': 'РАУНДОВ',
            'WORK': 'РАБОТА',
            'REST': 'ОТДЫХ',
            'MINUTES': 'МИНУТ',
            'SECONDS': 'СЕКУНД',
            'COUNTDOWN': 'ОТСЧЕТ'
        };

        this.sounds = {
            beep: new Audio('sound/beep.mp3'),
            start: new Audio('sound/start.mp3'),
            rest: new Audio('sound/rest.mp3'),
            finish: new Audio('sound/finish.mp3')
        };

        this.init();

        this.initWebSocket();
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({ type: 'init' }));
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'qr':
                    this.showQRCode(data.qrCode);
                    break;
                    
                case 'controller-connected':
                    console.log('Контроллер подключен');
                    break;
                    
                case 'controller-disconnected':
                    console.log('Контроллер отключен');
                    break;
                    
                case 'command':
                    this.handleRemoteCommand(data.action);
                    break;
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket соединение закрыто');
            setTimeout(() => this.initWebSocket(), 5000);
        };
    }

    showQRCode(qrDataUrl) {
        const qrContainer = document.getElementById('qr-container');
        qrContainer.innerHTML = `
            <img src="${qrDataUrl}" alt="QR Code">
            <p>Сканируйте для удаленного управления</p>
        `;
        qrContainer.style.display = 'block';
    }

    handleRemoteCommand(action) {
        switch(action) {
            case 'start':
                switch(this.currentScreen) {
                    case 'interval':
                        this.startInterval();
                        break;
                    case 'fortime':
                        this.startForTime();
                        break;
                    case 'amrap':
                        this.startAmrap();
                        break;
                }
                break;
                
            case 'pause':
                this.togglePause();
                break;
                
            case 'reset':
                this.showScreen(this.currentScreen);
                break;
        }
    }

    startClock() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        const updateClock = () => {
            const now = new Date();
            const display = document.querySelector('.timer-display');
            if (display) {
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                display.textContent = `${hours}:${minutes}:${seconds}`;
            }
        };

        updateClock();
        this.interval = setInterval(updateClock, 1000);
    }

    init() {
        document.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const timerType = e.target.dataset.timer;
                if (timerType) {
                    this.showScreen(timerType);
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('back-button')) {
                this.showScreen('main-menu');
            }
            if (e.target.classList.contains('fullscreen-button')) {
                this.toggleFullscreen();
            }
        });
    }

    createTimeInputs(label, minutesName, secondsName, defaultMinutes = 0, defaultSeconds = 0) {
        return `
            <div class="timer--settingField">
                <label>
                    <span>${label}</span>
                    <div class="timer--input-container">
                        <input type="number" 
                               name="${minutesName}" 
                               value="${defaultMinutes}" 
                               min="0" 
                               max="59" 
                               class="timer--input">
                        <span>:</span>
                        <input type="number" 
                               name="${secondsName}" 
                               value="${defaultSeconds}" 
                               min="0" 
                               max="59" 
                               class="timer--input">
                    </div>
                </label>
            </div>
        `;
    }

    createHeader(title, details = '') {
        return `
            <div class="header-panel">
                <div class="header-left">
                    <button class="back-button">←</button>
                    <h2 class="timer--header">${title}${details ? ' – ' + details : ''}</h2>
                </div>
                <button class="fullscreen-button">⛶</button>
            </div>
        `;
    }

    showScreen(screenName) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
        
        const timerScreens = document.getElementById('timer-screens');
        timerScreens.innerHTML = '';
        
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });

        if (screenName === 'main-menu') {
            document.getElementById('main-menu').style.display = 'flex';
        } else if (this.screens[screenName]) {
            const screen = this.screens[screenName]();
            timerScreens.appendChild(screen);
            screen.style.display = 'flex';
            
            if (screenName === 'clock') {
                this.startClock();
            }
        }

        this.currentScreen = screenName;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'screen-change',
                screen: screenName
            }));
        }
    }

    createIntervalScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';

        screen.innerHTML = `
            ${this.createHeader('EMOM / TABATA')}
            <div class="timer--settings">
                <div class="timer--settingField">
                    <label>
                        <span>${this.translations.ROUNDS}</span>
                        <div class="timer--input-container">
                            <input type="number" 
                                   name="rounds" 
                                   value="${this.settings.interval.rounds}" 
                                   min="1" 
                                   class="timer--input">
                        </div>
                    </label>
                </div>
                ${this.createTimeInputs(
                    this.translations.WORK,
                    'workMinutes',
                    'workSeconds',
                    this.settings.interval.workMinutes,
                    this.settings.interval.workSeconds
                )}
                ${this.createTimeInputs(
                    this.translations.REST,
                    'restMinutes',
                    'restSeconds',
                    this.settings.interval.restMinutes,
                    this.settings.interval.restSeconds
                )}
                ${this.createTimeInputs(
                    this.translations.COUNTDOWN,
                    'countdownMinutes',
                    'countdownSeconds',
                    0,
                    this.settings.interval.countdownSeconds
                )}
                <button class="menu-item start-button">
                    ${this.translations.START}
                </button>
            </div>
            <div class="timer-container" style="display: none;">
                <div class="round-number"></div>
                <div class="timer-display"></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startInterval());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveIntervalSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.currentScreen === 'interval') {
                e.preventDefault();
                this.togglePause();
            }
        });

        return screen;
    }

    saveIntervalSettings(screen) {
        try {
            const settings = {
                rounds: parseInt(screen.querySelector('[name="rounds"]').value) || 8,
                workMinutes: parseInt(screen.querySelector('[name="workMinutes"]').value) || 0,
                workSeconds: parseInt(screen.querySelector('[name="workSeconds"]').value) || 20,
                restMinutes: parseInt(screen.querySelector('[name="restMinutes"]').value) || 0,
                restSeconds: parseInt(screen.querySelector('[name="restSeconds"]').value) || 10,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };

            this.settings.interval = settings;
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }

    startInterval() {
        try {
            const screen = document.querySelector('#timer-screens .screen');
            if (!screen) {
                console.error('Экран таймера не найден');
                return;
            }

            const settings = this.settings.interval;
            const timerSettings = screen.querySelector('.timer--settings');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveIntervalSettings(screen);
            
            timerSettings.style.display = 'none';
            timerContainer.style.display = 'flex';
            
            this.currentRound = 1;
            this.isWorkPhase = true;
            this.remainingTime = settings.countdownSeconds;
            this.phase = 'countdown';
            
            this.updateHeader(`РАУНД ${this.currentRound}/${settings.rounds}`, 'ПОДГОТОВКА');
            
            this.interval = setInterval(() => this.updateIntervalTimer(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    updateIntervalTimer() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        if (!timerDisplay) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            return;
        }
        
        if (this.phase === 'countdown' && this.remainingTime <= 3 && this.remainingTime > 1) {
            this.playSound('beep');
        }
        
        if (this.remainingTime === 1 && !this.isTransitioning) {
            this.isTransitioning = true;
            
            timerDisplay.textContent = '00:01';
            
            switch (this.phase) {
                case 'countdown':
                    this.playSound('start');
                    break;
                case 'work':
                    this.playSound('rest');
                    break;
                case 'rest':
                    this.playSound('start');
                    break;
            }
            
            setTimeout(() => {
                this.isTransitioning = false;
                this.switchToNextPhase();
            }, 1000);
            
            return;
        }
        
        if (!this.isTransitioning) {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            this.remainingTime--;
        }
    }

    switchToNextPhase() {
        const settings = this.settings.interval;
        
        switch (this.phase) {
            case 'countdown':
                this.phase = 'work';
                this.remainingTime = settings.workMinutes * 60 + settings.workSeconds;
                this.updateHeader(`РАУНД ${this.currentRound}/${settings.rounds}`, 'РАБОТА');
                break;
                
            case 'work':
                if (this.currentRound >= settings.rounds && this.isWorkPhase) {
                    this.finishInterval();
                    return;
                }
                this.phase = 'rest';
                this.remainingTime = settings.restMinutes * 60 + settings.restSeconds;
                this.updateHeader(`РАУНД ${this.currentRound}/${settings.rounds}`, 'ОТДЫХ');
                break;
                
            case 'rest':
                this.currentRound++;
                this.phase = 'work';
                this.remainingTime = settings.workMinutes * 60 + settings.workSeconds;
                this.updateHeader(`РАУНД ${this.currentRound}/${settings.rounds}`, 'РАБОТА');
                break;
        }
    }

    finishInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            timerContainer.innerHTML = `
                <div class="finish-message">${this.settings.interval.rounds} раундов выполнены</div>
                <button class="menu-item restart-button">${this.translations.RESTART}</button>
            `;
            
            const restartButton = timerContainer.querySelector('.restart-button');
            if (restartButton) {
                restartButton.addEventListener('click', () => this.showScreen('interval'));
            }
        }
    }

    updateHeader(title, details = '') {
        const header = document.querySelector('.timer--header');
        header.textContent = details ? `${title} – ${details}` : title;
    }

    togglePause() {
        this.isRunning = !this.isRunning;
        const timerDisplay = document.querySelector('.timer-display');
        
        if (this.isRunning && timerDisplay) {
            this.interval = setInterval(() => this.updateIntervalTimer(), 1000);
        } else {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'state-change',
                state: this.isRunning ? 'running' : 'paused'
            }));
        }
    }

    playSound(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Ошибка воспроизведения звука:', e));
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Ошибка переключения в полноэкранный режим:', err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    createMainMenu() {
        const menu = document.createElement('div');
        menu.className = 'screen';
        menu.innerHTML = `
            <button class="menu-item" data-timer="clock">ЧАСЫ</button>
            <button class="menu-item" data-timer="interval">EMOM / TABATA</button>
            <button class="menu-item" data-timer="fortime">НА ВРЕМЯ</button>
            <button class="menu-item" data-timer="amrap">AMRAP</button>
        `;
        return menu;
    }

    createClockScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';
        screen.innerHTML = `
            ${this.createHeader('ЧАСЫ')}
            <div class="timer-display"></div>
        `;
        return screen;
    }

    createForTimeScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';
        screen.innerHTML = `
            ${this.createHeader('НА ВРЕМЯ')}
            <div class="timer--settings">
                ${this.createTimeInputs(
                    'ВРЕМЯ',
                    'targetMinutes',
                    'targetSeconds',
                    this.settings.fortime.targetMinutes,
                    this.settings.fortime.targetSeconds
                )}
                <div class="timer--settingField">
                    <label>
                        <span>${this.translations.COUNTDOWN}</span>
                        <div class="timer--input-container">
                            <input type="number" 
                                   name="countdownSeconds" 
                                   value="${this.settings.fortime.countdownSeconds}" 
                                   min="0" 
                                   max="59" 
                                   class="timer--input">
                        </div>
                    </label>
                </div>
                <button class="menu-item start-button">${this.translations.START}</button>
            </div>
            <div class="timer-container" style="display: none;">
                <div class="timer-display"></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startForTime());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveForTimeSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.currentScreen === 'fortime') {
                e.preventDefault();
                this.togglePause();
            }
        });

        return screen;
    }

    saveForTimeSettings(screen) {
        try {
            const settings = {
                targetMinutes: parseInt(screen.querySelector('[name="targetMinutes"]').value) || 0,
                targetSeconds: parseInt(screen.querySelector('[name="targetSeconds"]').value) || 0,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };

            this.settings.fortime = settings;
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }

    createAmrapScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';
        screen.innerHTML = `
            ${this.createHeader('AMRAP')}
            <div class="timer--settings">
                ${this.createTimeInputs(
                    'ВРЕМЯ',
                    'targetMinutes',
                    'targetSeconds',
                    this.settings.amrap.targetMinutes,
                    this.settings.amrap.targetSeconds
                )}
                <div class="timer--settingField">
                    <label>
                        <span>${this.translations.COUNTDOWN}</span>
                        <div class="timer--input-container">
                            <input type="number" 
                                   name="countdownSeconds" 
                                   value="${this.settings.amrap.countdownSeconds}" 
                                   min="0" 
                                   max="59" 
                                   class="timer--input">
                        </div>
                    </label>
                </div>
                <button class="menu-item start-button">${this.translations.START}</button>
            </div>
            <div class="timer-container" style="display: none;">
                <div class="timer-display"></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startAmrap());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveAmrapSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.currentScreen === 'amrap') {
                e.preventDefault();
                this.togglePause();
            }
        });

        return screen;
    }

    saveAmrapSettings(screen) {
        try {
            const settings = {
                targetMinutes: parseInt(screen.querySelector('[name="targetMinutes"]').value) || 0,
                targetSeconds: parseInt(screen.querySelector('[name="targetSeconds"]').value) || 0,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };

            this.settings.amrap = settings;
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }

    startForTime() {
        try {
            const screen = document.querySelector('#timer-screens .screen');
            if (!screen) {
                console.error('Экран таймера не найден');
                return;
            }

            const settings = this.settings.fortime;
            const timerSettings = screen.querySelector('.timer--settings');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveForTimeSettings(screen);
            
            timerSettings.style.display = 'none';
            timerContainer.style.display = 'flex';
            
            this.remainingTime = settings.countdownSeconds;
            this.elapsedTime = 0;
            this.phase = 'countdown';
            this.targetTime = settings.targetMinutes * 60 + settings.targetSeconds;
            
            this.updateHeader('НА ВРЕМЯ', 'ПОДГОТОВКА');
            
            this.interval = setInterval(() => this.updateForTimeTimer(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    updateForTimeTimer() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        if (!timerDisplay) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            return;
        }
        
        if (this.phase === 'countdown') {
            if (this.remainingTime <= 3 && this.remainingTime > 1) {
                this.playSound('beep');
            }
            
            if (this.remainingTime === 1 && !this.isTransitioning) {
                this.isTransitioning = true;
                timerDisplay.textContent = '00:01';
                this.playSound('start');
                
                setTimeout(() => {
                    this.isTransitioning = false;
                    this.phase = 'work';
                    this.elapsedTime = 0;
                    this.updateHeader('НА ВРЕМЯ', `ЦЕЛЬ ${Math.floor(this.targetTime / 60)}:${(this.targetTime % 60).toString().padStart(2, '0')}`);
                }, 1000);
                return;
            }
            
            if (!this.isTransitioning) {
                timerDisplay.textContent = `00:${this.remainingTime.toString().padStart(2, '0')}`;
                this.remainingTime--;
            }
        } else {
            const minutes = Math.floor(this.elapsedTime / 60);
            const seconds = this.elapsedTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.elapsedTime >= this.targetTime) {
                this.finishForTime();
                return;
            }
            
            this.elapsedTime++;
        }
    }

    finishForTime() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            const minutes = Math.floor(this.targetTime / 60);
            const seconds = this.targetTime % 60;
            timerContainer.innerHTML = `
                <div class="finish-message">${minutes}:${seconds.toString().padStart(2, '0')} выполнено</div>
                <button class="menu-item restart-button">${this.translations.RESTART}</button>
            `;
            
            const restartButton = timerContainer.querySelector('.restart-button');
            if (restartButton) {
                restartButton.addEventListener('click', () => this.showScreen('fortime'));
            }
        }
    }

    startAmrap() {
        try {
            const screen = document.querySelector('#timer-screens .screen');
            if (!screen) {
                console.error('Экран таймера не найден');
                return;
            }

            const settings = this.settings.amrap;
            const timerSettings = screen.querySelector('.timer--settings');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveAmrapSettings(screen);
            
            timerSettings.style.display = 'none';
            timerContainer.style.display = 'flex';
            
            this.remainingTime = settings.countdownSeconds;
            this.elapsedTime = 0;
            this.phase = 'countdown';
            this.targetTime = settings.targetMinutes * 60 + settings.targetSeconds;
            
            this.updateHeader('AMRAP', 'ПОДГОТОВКА');
            
            this.interval = setInterval(() => this.updateAmrapTimer(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    updateAmrapTimer() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        if (!timerDisplay) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            return;
        }
        
        if (this.phase === 'countdown') {
            if (this.remainingTime <= 3 && this.remainingTime > 1) {
                this.playSound('beep');
            }
            
            if (this.remainingTime === 1 && !this.isTransitioning) {
                this.isTransitioning = true;
                timerDisplay.textContent = '00:01';
                this.playSound('start');
                
                setTimeout(() => {
                    this.isTransitioning = false;
                    this.phase = 'work';
                    this.remainingTime = this.targetTime;
                    this.updateHeader('AMRAP', `${Math.floor(this.targetTime / 60)}:${(this.targetTime % 60).toString().padStart(2, '0')}`);
                }, 1000);
                return;
            }
            
            if (!this.isTransitioning) {
                timerDisplay.textContent = `00:${this.remainingTime.toString().padStart(2, '0')}`;
                this.remainingTime--;
            }
        } else {
            if (this.remainingTime === 1 && !this.isTransitioning) {
                this.isTransitioning = true;
                timerDisplay.textContent = '00:01';
                
                setTimeout(() => {
                    this.finishAmrap();
                }, 1000);
                return;
            }
            
            if (!this.isTransitioning) {
                const minutes = Math.floor(this.remainingTime / 60);
                const seconds = this.remainingTime % 60;
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                this.remainingTime--;
            }
        }
    }

    finishAmrap() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            const minutes = Math.floor(this.targetTime / 60);
            timerContainer.innerHTML = `
                <div class="finish-message">${minutes} минут выполнены</div>
                <button class="menu-item restart-button">${this.translations.RESTART}</button>
            `;
            
            const restartButton = timerContainer.querySelector('.restart-button');
            if (restartButton) {
                restartButton.addEventListener('click', () => this.showScreen('amrap'));
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.timer = new Timer();
});
