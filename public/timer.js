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
                targetMinutes: 0,
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
            <div class="timer-display">
                В разработке...
            </div>
        `;
        return screen;
    }

    createAmrapScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';
        screen.innerHTML = `
            ${this.createHeader('AMRAP')}
            <div class="timer-display">
                В разработке...
            </div>
        `;
        return screen;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.timer = new Timer();
});
