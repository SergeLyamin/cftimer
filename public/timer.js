class Timer {
    constructor() {
        this.currentScreen = 'main-menu';
        this.interval = null;
        this.time = 0;
        this.isRunning = false;
        
        this.screens = {
            'main-menu': this.createMainMenu.bind(this),
            'clock': this.createClockScreen.bind(this),
            'tabata': this.createTabataScreen.bind(this),
            'fortime': this.createForTimeScreen.bind(this),
            'emom': this.createEmomScreen.bind(this),
            'amrap': this.createAmrapScreen.bind(this)
        };

        this.translations = {
            'CLOCK': 'ЧАСЫ',
            'FOR TIME': 'НА ВРЕМЯ',
            'START': 'СТАРТ',
            'PAUSE': 'ПАУЗА',
            'RESET': 'СБРОС',
        };

        this.init();
        this.initWebSocket();
    }

    initWebSocket() {
        // Обработка команд от удаленного управления
        if (window.ws) {
            window.ws.onmessage = (event) => {
                const command = JSON.parse(event.data);
                switch(command.action) {
                    case 'changeTimer':
                        this.showScreen(command.timerType);
                        break;
                    case 'start':
                        this.toggleTimer();
                        break;
                    case 'reset':
                        this.resetTimer();
                        break;
                }
            };
        }
    }

    init() {
        // Инициализация обработчиков событий
        document.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const timerType = e.target.dataset.timer;
                this.showScreen(timerType);
            });
        });
    }

    showScreen(screenName) {
        // Очищаем текущий экран
        const timerScreens = document.getElementById('timer-screens');
        timerScreens.innerHTML = '';
        
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });

        // Показываем нужный экран
        if (screenName === 'main-menu') {
            document.getElementById('main-menu').style.display = 'flex';
        } else {
            const screen = this.screens[screenName]();
            timerScreens.appendChild(screen);
        }
        
        this.currentScreen = screenName;

        // Отправляем состояние через WebSocket
        this.broadcastState();
    }

    broadcastState() {
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            window.ws.send(JSON.stringify({
                screen: this.currentScreen,
                time: this.time,
                isRunning: this.isRunning
            }));
        }
    }

    createMainMenu() {
        const menu = document.createElement('div');
        menu.className = 'screen';
        return menu;
    }

    createClockScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';

        const display = document.createElement('div');
        display.className = 'timer-display';
        display.textContent = '00:00:00';

        const controlPanel = document.createElement('div');
        controlPanel.className = 'control-panel';

        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.textContent = '←';
        backButton.onclick = () => this.showScreen('main-menu');

        screen.appendChild(backButton);
        screen.appendChild(display);
        screen.appendChild(controlPanel);

        // Запускаем часы
        this.startClock();

        return screen;
    }

    createTabataScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen';

        // Верхняя панель с заголовком и кнопками
        const header = document.createElement('div');
        header.className = 'header-panel';

        // Левая часть с кнопкой назад и заголовком
        const leftHeader = document.createElement('div');
        leftHeader.className = 'header-left';

        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.innerHTML = '←';
        backButton.onclick = () => this.showScreen('main-menu');

        const title = document.createElement('h2');
        title.className = 'timer--header';
        title.textContent = 'TABATA';

        leftHeader.appendChild(backButton);
        leftHeader.appendChild(title);

        // Кнопка полноэкранного режима
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'fullscreen-button';
        fullscreenButton.innerHTML = '⤢';
        fullscreenButton.onclick = () => this.toggleFullscreen();

        header.appendChild(leftHeader);
        header.appendChild(fullscreenButton);

        // Настройки таймера
        const settings = document.createElement('div');
        settings.className = 'timer--settings';
        settings.innerHTML = `
            <div class="timer--settingField">
                <label>
                    <span class="tr">FOR</span>
                    <div class="timer--input-container">
                        <input type="number" name="rounds" value="8" min="1" class="timer--input">
                    </div>
                    <span class="tl">ROUND</span>
                </label>
            </div>
            <div class="timer--settingField">
                <label>
                    <span class="tr">WORK</span>
                    <div class="timer--input-container">
                        <input type="number" name="work" value="20" min="1" class="timer--input">
                    </div>
                    <span class="tl">SECONDS</span>
                </label>
            </div>
            <div class="timer--settingField">
                <label>
                    <span class="tr">REST</span>
                    <div class="timer--input-container">
                        <input type="number" name="rest" value="10" min="1" class="timer--input">
                    </div>
                    <span class="tl">SECONDS</span>
                </label>
            </div>
        `;

        // Дисплей таймера (изначально скрыт)
        const display = document.createElement('div');
        display.className = 'timer-display';
        display.style.display = 'none';

        // Информация о текущем раунде
        const roundInfo = document.createElement('div');
        roundInfo.className = 'round-info';
        roundInfo.style.display = 'none';

        // Кнопка старт
        const startButton = document.createElement('button');
        startButton.className = 'menu-item start-button';
        startButton.textContent = this.translations.START;
        startButton.onclick = () => {
            if (!this.isRunning) {
                const rounds = parseInt(settings.querySelector('[name="rounds"]').value);
                const work = parseInt(settings.querySelector('[name="work"]').value);
                const rest = parseInt(settings.querySelector('[name="rest"]').value);
                
                settings.style.display = 'none';
                display.style.display = 'block';
                startButton.style.display = 'none';
                
                // Начинаем обратный отсчет
                this.startCountdown(() => {
                    roundInfo.style.display = 'block';
                    this.startTabata(rounds, work, rest);
                });
            }
        };

        screen.appendChild(header);
        screen.appendChild(settings);
        screen.appendChild(display);
        screen.appendChild(roundInfo);
        screen.appendChild(startButton);

        return screen;
    }

    createForTimeScreen() {
        // Аналогично TabataScreen
        return this.createTabataScreen();
    }

    createEmomScreen() {
        // Аналогично TabataScreen
        return this.createTabataScreen();
    }

    createAmrapScreen() {
        // Аналогично TabataScreen
        return this.createTabataScreen();
    }

    startClock() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            const now = new Date();
            const display = document.querySelector('.timer-display');
            if (display) {
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                display.textContent = `${hours}:${minutes}:${seconds}`;
            }
        }, 1000);
    }

    toggleTimer() {
        this.isRunning = !this.isRunning;
        const startButton = document.querySelector('.start-button');
        if (startButton) {
            startButton.textContent = this.isRunning ? 
                this.translations.PAUSE : 
                this.translations.START;
        }
    }

    resetTimer() {
        this.isRunning = false;
        const display = document.querySelector('.timer-display');
        if (display) {
            display.textContent = '00:00';
            display.classList.remove('countdown', 'running');
        }
        const startButton = document.querySelector('.start-button');
        if (startButton) {
            startButton.textContent = this.translations.START;
        }
    }

    // Добавим методы для работы с Tabata таймером
    startTabata(rounds, workTime, restTime) {
        let currentRound = 1;
        let timeLeft = workTime;
        let isWorkPhase = true;
        
        const roundInfo = document.querySelector('.round-info');
        const display = document.querySelector('.timer-display');
        
        display.addEventListener('click', () => {
            this.isRunning = !this.isRunning;
            if (!this.isRunning) {
                this.playBeep(true);
            }
        });
        
        this.interval = setInterval(() => {
            if (!this.isRunning) return;

            if (timeLeft > 0) {
                timeLeft--;
                display.textContent = this.formatTime(timeLeft);
                roundInfo.textContent = `Round ${currentRound}/${rounds} - ${isWorkPhase ? 'WORK' : 'REST'}`;
            } else {
                this.playBeep(true);
                
                if (isWorkPhase) {
                    timeLeft = restTime;
                    isWorkPhase = false;
                } else {
                    currentRound++;
                    if (currentRound > rounds) {
                        this.resetTimer();
                        display.classList.remove('running');
                        return;
                    }
                    timeLeft = workTime;
                    isWorkPhase = true;
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    playBeep(isLong = false) {
        const event = new CustomEvent('playBeep', { 
            detail: { isLong } 
        });
        document.dispatchEvent(event);
    }

    // Добавим метод для обратного отсчета
    startCountdown(callback) {
        let count = 10;
        const display = document.querySelector('.timer-display');
        display.style.display = 'block';
        display.classList.add('countdown');
        
        const countdown = setInterval(() => {
            display.textContent = count;
            
            if (count <= 3) {
                this.playBeep(count === 1);
            }
            
            count--;
            
            if (count < 0) {
                clearInterval(countdown);
                this.isRunning = true;
                display.classList.remove('countdown');
                display.classList.add('running');
                callback();
            }
        }, 1000);
    }

    // Обновим метод toggleFullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

// Создаем экземпляр таймера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.timer = new Timer();
});

// Добавляем обработчик кликов и нажатия пробела
function initializeTimerControls() {
    const timerArea = document.querySelector('.timer-clickable-area');
    
    // Обработчик клика
    timerArea.addEventListener('click', toggleTimer);
    
    // Обработчик нажатия пробела
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            event.preventDefault(); // Предотвращаем прокрутку страницы
            toggleTimer();
        }
    });
}

function toggleTimer() {
    // Здесь логика паузы/возобновления таймера
    const isRunning = timer.isRunning;
    if (isRunning) {
        timer.pause();
    } else {
        timer.resume();
    }
}
