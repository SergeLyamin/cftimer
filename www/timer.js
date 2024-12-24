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
            'INTERVAL': 'ИНТЕРВАЛЫ',
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
            'COUNTDOWN': 'ПОДГОТОВКА'
        };

        this.sounds = {
            beep: new Audio('sound/beep.mp3'),
            start: new Audio('sound/start.mp3'),
            rest: new Audio('sound/rest.mp3'),
            finish: new Audio('sound/finish.mp3')
        };

        this.init();

        this.initWebSocket();

        this.headerElement = null;

        this.updateBottomClock();
        setInterval(() => this.updateBottomClock(), 1000);
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        const connect = () => {
            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected, sending init');
                this.ws.send(JSON.stringify({ 
                    type: 'init',
                    isController: false 
                }));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket connection closed, reconnecting...');
                setTimeout(connect, 1000);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('WebSocket message received:', data);
                
                switch(data.type) {
                    case 'qr':
                        console.log('QR code received, showing QR code');
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
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        };
        
        connect();
    }

    showQRCode(qrDataUrl) {
        console.log('Showing QR code, data URL length:', qrDataUrl.length);
        
        let qrContainer = document.getElementById('qr-container');
        if (!qrContainer) {
            console.log('Creating new QR container');
            qrContainer = document.createElement('div');
            qrContainer.id = 'qr-container';
            qrContainer.className = 'qr-code';
            document.body.appendChild(qrContainer);
        }
        
        qrContainer.innerHTML = `
            <img src="${qrDataUrl}" alt="QR Code">
            //<!-- <p class="text-center">Сканируйте для удаленного управления</p>-->
        `;
        qrContainer.style.display = 'block';
        console.log('QR container updated and displayed');
    }

    handleRemoteCommand(action) {
        switch(action) {
            case 'start':
                if (this.isRunning || this.isTransitioning) {
                    return;
                }
                
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
                
                this.isRunning = false;
                this.isTransitioning = false;
                
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
                if (this.isTransitioning) {
                    return;
                }
                this.togglePause();
                break;
                
            case 'reset':
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
                this.isRunning = false;
                this.isTransitioning = false;
                
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
        console.log('Timer initialized');
        
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) {
            mainMenu.querySelectorAll('.menu-item').forEach(button => {
                console.log('Adding click handler to button:', button.dataset.timer);
                button.addEventListener('click', (e) => {
                    console.log('Button clicked:', e.target.dataset.timer);
                    const timerType = e.target.dataset.timer;
                    if (timerType) {
                        this.showScreen(timerType);
                    }
                });
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f' && this.currentScreen !== 'main-menu') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        document.addEventListener('click', (e) => {
            const backButton = e.target.closest('.back-button');
            const fullscreenButton = e.target.closest('.fullscreen-button');
            
            if (backButton) {
                e.preventDefault();
                e.stopPropagation();
                this.showScreen('main-menu');
            }
            if (fullscreenButton) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreen();
            }
        }, true);
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
            <div class="header-panel fixed top-0 left-0 right-0 flex justify-between items-center p-5 bg-black">
                <div class="flex items-center gap-4">
                    <button class="back-button">
                        <div class="back-arrow"></div>
                    </button>
                    <h2 class="timer--header text-4xl font-normal m-0">${title}${details ? ' – ' + details : ''}</h2>
                </div>
                <button class="fullscreen-button">
                    
                </button>
            </div>
        `;
    }

    showScreen(screenName) {
        console.log('Switching to screen:', screenName);
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
        
        const mainMenu = document.getElementById('main-menu');
        const timerScreens = document.getElementById('timer-screens');
        
        if (screenName === 'main-menu') {
            if (timerScreens) {
                timerScreens.innerHTML = '';
            }
            if (mainMenu) {
                mainMenu.style.display = 'flex';
            }
        } else {
            if (mainMenu) {
                mainMenu.style.display = 'none';
            }
            if (timerScreens && this.screens[screenName]) {
                timerScreens.innerHTML = '';
                const screen = this.screens[screenName]();
                timerScreens.appendChild(screen);
                
                if (screenName === 'clock') {
                    this.startClock();
                }
            }
        }

        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
            qrContainer.style.display = screenName === 'main-menu' ? 'none' : 'block';
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
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';

        screen.innerHTML = `
            ${this.createHeader('ИНТЕРВАЛЫ')}
            <div class="flex flex-col items-center gap-8 mt-24 w-full max-w-[45rem] px-4">
                <div class="grid grid-cols-[1fr,1fr,1fr] gap-4 w-full">
                    <label class="text-right self-center text-4xl">${this.translations.ROUNDS}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="rounds" 
                               value="${this.settings.interval.rounds}" 
                               min="1" 
                               max="99" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center">&nbsp;</span>

                    <label class="text-right self-center text-4xl">${this.translations.WORK}</label>
                    <div class="grid grid-cols-2 gap-2 border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="workMinutes" 
                               value="${this.settings.interval.workMinutes}" 
                               min="0" 
                               max="59" 
                               class="bg-transparent border-none text-4xl text-center">
                        <input type="number" 
                               name="workSeconds" 
                               value="${this.settings.interval.workSeconds}" 
                               min="0" 
                               max="59" 
                               class="bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">мин:сек</span>

                    <label class="text-right self-center text-4xl">${this.translations.REST}</label>
                    <div class="grid grid-cols-2 gap-2 border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="restMinutes" 
                               value="${this.settings.interval.restMinutes}" 
                               min="0" 
                               max="59" 
                               class="bg-transparent border-none text-4xl text-center">
                        <input type="number" 
                               name="restSeconds" 
                               value="${this.settings.interval.restSeconds}" 
                               min="0" 
                               max="59" 
                               class="bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">мин:сек</span>

                    <label class="text-right self-center text-4xl">${this.translations.COUNTDOWN}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="countdownSeconds" 
                               value="${this.settings.interval.countdownSeconds}" 
                               min="0" 
                               max="59" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">секунд</span>
                </div>
                
                <button class="start-button w-[16rem] h-[72px] text-4xl bg-transparent border-2 border-white cursor-pointer uppercase hover:bg-white hover:text-black">
                    ${this.translations.START}
                </button>
            </div>
            
            <div class="timer-container hidden w-full flex justify-center items-center gap-8">
                <div class="round-number text-[18vw] font-semibold"></div>
                <div class="timer-display text-[18vw] font-semibold my-10 min-h-[144px] text-center"></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startInterval());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveIntervalSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

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
            if (!screen) return;

            const settings = this.settings.interval;
            const setupContainer = screen.querySelector('.flex.flex-col');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveIntervalSettings(screen);
            
            setupContainer.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex');
            
            this.remainingTime = settings.countdownSeconds;
            this.currentRound = 1;
            this.phase = 'countdown';
            this.workTime = settings.workMinutes * 60 + settings.workSeconds;
            this.restTime = settings.restMinutes * 60 + settings.restSeconds;
            
            this.updateHeader('ИНТЕРВАЛЫ', 'ПОДГОТОВКА');
            
            this.interval = setInterval(() => this.updateIntervalTimer(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    updateIntervalTimer() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        const roundNumber = document.querySelector('.round-number');
        
        if (!timerDisplay) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            return;
        }
        
        if (this.phase === 'countdown') {
            if (this.remainingTime <= 3 && this.remainingTime > 0) {
                this.playSound('beep');
            }
            
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.phase = 'work';
                this.remainingTime = this.workTime;
                this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound} - РАБОТА`);
            } else {
                this.remainingTime--;
            }
        } else if (this.phase === 'work') {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            roundNumber.textContent = this.currentRound;
            roundNumber.style.color = '#FF0101';
            
            
            if (this.remainingTime === 0) {
                if (this.currentRound < this.settings.interval.rounds) {
                    this.phase = 'rest';
                    this.remainingTime = this.restTime;
                    this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound} - ОТДЫХ`);
                    this.playSound('rest');
                } else {
                    this.finishInterval();
                    return;
                }
            }
            this.remainingTime--;
        } else if (this.phase === 'rest') {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            roundNumber.textContent = this.currentRound;
            roundNumber.style.color = '#01D9FF';
            
            if (this.remainingTime === 0) {
                this.currentRound++;
                this.phase = 'work';
                this.remainingTime = this.workTime;
                this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound} - РАБОТА`);
                this.playSound('start');
            }
            this.remainingTime--;
        }
    }

    finishInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            timerContainer.innerHTML = `
                <div class="finish-message">${this.settings.interval.rounds} раундов завершены</div>
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
        if (header) {
            header.textContent = details ? `${title} – ${details}` : title;
        }
    }

    togglePause() {
        if (this.isTransitioning) {
            return;
        }

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        this.isRunning = !this.isRunning;
        
        if (this.isRunning) {
            switch(this.currentScreen) {
                case 'interval':
                    this.interval = setInterval(() => this.updateIntervalTimer(), 1000);
                    break;
                case 'fortime':
                    this.interval = setInterval(() => this.updateForTimeTimer(), 1000);
                    break;
                case 'amrap':
                    this.interval = setInterval(() => this.updateAmrapTimer(), 1000);
                    break;
            }
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'state-change',
                state: this.isRunning ? 'running' : 'paused',
                screen: this.currentScreen
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
        menu.id = 'main-menu';
        menu.className = 'screen flex flex-col gap-4 items-center justify-center h-full';
        menu.innerHTML = `
            <button class="menu-item w-4/5 p-4 text-4xl bg-transparent border-2 border-white cursor-pointer uppercase" data-timer="clock">
                ${this.translations.CLOCK}
            </button>
            <button class="menu-item w-4/5 p-4 text-4xl bg-transparent border-2 border-white cursor-pointer uppercase" data-timer="interval">
                ${this.translations.INTERVAL}
            </button>
            <button class="menu-item w-4/5 p-4 text-4xl bg-transparent border-2 border-white cursor-pointer uppercase" data-timer="fortime">
                ${this.translations.FOR_TIME}
            </button>
            <button class="menu-item w-4/5 p-4 text-4xl bg-transparent border-2 border-white cursor-pointer uppercase" data-timer="amrap">
                AMRAP
            </button>
        `;

        menu.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', () => {
                const timerType = button.dataset.timer;
                if (timerType) {
                    this.showScreen(timerType);
                }
            });
        });

        return menu;
    }

    createClockScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full';

        screen.innerHTML = `
            ${this.createHeader('ЧАСЫ')}
            <div class="flex-1 w-full flex justify-center items-center">
                <div class="timer-display text-[18vw] font-semibold text-center"></div>
            </div>
        `;

        return screen;
    }

    createForTimeScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';

        screen.innerHTML = `
            ${this.createHeader('НА ВРЕМЯ')}
            <div class="flex flex-col items-center gap-8 mt-24 w-full max-w-[45rem] px-4">
                <div class="grid grid-cols-[1fr,1fr,1fr] gap-4 w-full">
                    <label class="text-right self-center text-4xl">ЦЕЛЬ</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="targetMinutes" 
                               value="${this.settings.fortime.targetMinutes}" 
                               min="0" 
                               max="99" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center">${this.translations.MINUTES}</span>

                    <label class="text-right self-center text-4xl">${this.translations.COUNTDOWN}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="countdownSeconds" 
                               value="${this.settings.fortime.countdownSeconds}" 
                               min="0" 
                               max="59" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">секунд</span>
                </div>
                
                <button class="start-button w-[16rem] h-[72px] text-4xl bg-transparent border-2 border-white cursor-pointer uppercase hover:bg-white hover:text-black">
                    ${this.translations.START}
                </button>
            </div>
            
            <div class="timer-container hidden w-full flex justify-center items-center relative">
                <div class="timer-display text-[18vw] font-semibold my-10 min-h-[144px] text-center "></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startForTime());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveForTimeSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

        const backButton = screen.querySelector('.back-button');
        if (backButton) {
            backButton.addEventListener('click', () => this.showScreen('main-menu'));
        }

        const fullscreenButton = screen.querySelector('.fullscreen-button');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        }

        return screen;
    }

    saveForTimeSettings(screen) {
        try {
            const settings = {
                targetMinutes: parseInt(screen.querySelector('[name="targetMinutes"]').value) || 0,
                targetSeconds: 0,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };

            this.settings.fortime = settings;
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }

    createAmrapScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';

        screen.innerHTML = `
            ${this.createHeader('AMRAP')}
            <div class="flex flex-col items-center gap-8 mt-24 w-full max-w-[45rem] px-4">
                <div class="grid grid-cols-[1fr,1fr,1fr] gap-4 w-full">
                    <label class="text-right self-center text-4xl">&nbsp;</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="targetMinutes" 
                               value="${this.settings.amrap.targetMinutes}" 
                               min="0" 
                               max="99" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">${this.translations.MINUTES}</span>

                    <label class="text-right self-center text-4xl">${this.translations.COUNTDOWN}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="countdownSeconds" 
                               value="${this.settings.amrap.countdownSeconds}" 
                               min="0" 
                               max="59" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">секунд</span>
                </div>
                
                <button class="start-button w-[16rem] h-[72px] text-4xl bg-transparent border-2 border-white cursor-pointer uppercase hover:bg-white hover:text-black">
                    ${this.translations.START}
                </button>
            </div>
            
            <div class="timer-container hidden w-full flex justify-center items-center relative">
                <div class="timer-display text-[18vw] font-semibold my-10 min-h-[144px] text-center "></div>
            </div>
        `;

        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => this.startAmrap());

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => this.saveAmrapSettings(screen));
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());

        return screen;
    }

    saveAmrapSettings(screen) {
        try {
            const settings = {
                targetMinutes: parseInt(screen.querySelector('[name="targetMinutes"]').value) || 0,
                targetSeconds: 0,
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
            const setupContainer = screen.querySelector('.flex.flex-col');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveForTimeSettings(screen);
            
            setupContainer.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex');
            
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
            if (this.remainingTime <= 3 && this.remainingTime > 0) {
                this.playSound('beep');
            }
            
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.phase = 'work';
                this.elapsedTime = 0;
                this.updateHeader('НА ВРЕМЯ', `ЦЕЛЬ ${Math.floor(this.targetTime / 60)}:${(this.targetTime % 60).toString().padStart(2, '0')}`);
            } else {
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
            if (!screen) return;

            const settings = this.settings.amrap;
            const setupContainer = screen.querySelector('.flex.flex-col');
            const timerContainer = screen.querySelector('.timer-container');
            
            this.saveAmrapSettings(screen);
            
            setupContainer.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex');
            
            this.remainingTime = settings.countdownSeconds;
            this.targetTime = settings.targetMinutes * 60;
            this.phase = 'countdown';
            
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
            if (this.remainingTime <= 3 && this.remainingTime > 0) {
                this.playSound('beep');
            }
            
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.phase = 'work';
                this.remainingTime = this.targetTime;
                this.updateHeader('AMRAP', `${Math.floor(this.targetTime / 60)}:${(this.targetTime % 60).toString().padStart(2, '0')}`);
            } else {
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

    updateBottomClock() {
        const clockButton = document.getElementById('clock-button');
        if (clockButton) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
            clockButton.textContent = timeString;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating Timer');
    window.timer = new Timer();
});
