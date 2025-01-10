import { WebSocketService } from '../services/WebSocket.js';

export class Timer {
    constructor() {
        // Общие свойства
        this.isRunning = false;
        this.isTransitioning = false;
        this.interval = null;
        this.currentScreen = 'main-menu';

        // Звуки
        this.sounds = {
            beep: new Audio('sound/beep.mp3'),
            start: new Audio('sound/start.mp3'),
            rest: new Audio('sound/rest.mp3'),
            finish: new Audio('sound/finish.mp3')
        };

        // Переводы
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
            'COUNTDOWN': 'ПОДГОТОВКА',
            'TARGET': 'ЦЕЛЬ'
        };

        // Базовые методы для работы со временем
        this.formatTime = (minutes, seconds) => {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        // Базовые методы UI
        this.createHeader = this.createHeader.bind(this);
        this.showScreen = this.showScreen.bind(this);
        this.toggleFullscreen = this.toggleFullscreen.bind(this);
        this.updateHeader = this.updateHeader.bind(this);
        this.playSound = this.playSound.bind(this);
        this.togglePause = this.togglePause.bind(this);

        // Инициализация WebSocket
        this.ws = new WebSocketService(this);

        // Инициализация часов
        this.updateBottomClock();
        setInterval(() => this.updateBottomClock(), 1000);

        // Добавляем обработчик клавиатуры
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а') {
                this.toggleFullscreen();
            }
        });

        // Добавляем обработчик пробела
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Предотвращаем прокрутку страницы
                this.togglePause();
            }
        });

        // Добавляем обработчики для модального окна настроек
        const settingsButton = document.getElementById('settings-button');
        const settingsBackdrop = document.getElementById('settings-backdrop');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettings = document.getElementById('close-settings');

        if (settingsButton && settingsBackdrop && settingsModal && closeSettings) {
            settingsButton.addEventListener('click', () => {
                settingsBackdrop.classList.remove('hidden');
                setTimeout(() => {
                    settingsBackdrop.classList.add('show');
                    settingsModal.classList.add('show');
                    // Просто показываем сохраненный QR-код
                    this.ws.showQRCode();
                }, 10);
            });

            closeSettings.addEventListener('click', () => {
                settingsBackdrop.classList.remove('show');
                settingsModal.classList.remove('show');
                setTimeout(() => {
                    settingsBackdrop.classList.add('hidden');
                }, 300);
            });
        }
    }

    // Базовые методы UI
    createHeader(title, details = '') {
        return `
            <div class="header-panel fixed top-0 left-0 right-0 flex justify-between items-center p-5 bg-black">
                <div class="flex items-center gap-4">
                    <button class="back-button">
                        <div class="back-arrow"></div>
                    </button>
                    <h2 class="timer--header text-2xl md:text-2xl">${title}${details ? ' – ' + details : ''}</h2>
                </div>
                <button class="fullscreen-button hidden md:block"></button>
            </div>
        `;
    }

    showScreen(screenName) {
        // Отправляем сообщение через WebSocket
        this.ws.sendMessage({ 
            type: 'screen-change', 
            screen: screenName 
        });

        // Остальная логика showScreen...
    }

    updateHeader(title, details = '') {
        const header = document.querySelector('.timer--header');
        if (header) {
            header.textContent = details ? `${title} – ${details}` : title;
        }
    }

    playSound(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            // Создаем новый экземпляр звука для каждого воспроизведения
            const clone = sound.cloneNode();
            clone.volume = sound.volume;
            
            // Воспроизводим звук асинхронно
            setTimeout(() => {
                clone.play().catch(e => console.log('Ошибка воспроизведения звука:', e));
            }, 0);
        }
    }

    togglePause() {
        if (this.isTransitioning) return;
        this.isRunning = !this.isRunning;
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

    cleanup() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.ws.cleanup();
        this.isRunning = false;
        this.isTransitioning = false;
    }
} 