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
            // ... остальные переводы
        };

        this.init();
    }

    // Метод переключения полноэкранного режима
    toggleFullscreen() {
        const fullscreenButton = document.querySelector('.fullscreen-button');
        
        if (!document.fullscreenElement) {
            // Входим в полноэкранный режим
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Ошибка при переходе в полноэкранный режим: ${err.message}`);
            });
            // Меняем иконку на "выход из полноэкранного режима"
            fullscreenButton.innerHTML = '⤢';
        } else {
            // Выходим из полноэкранного режима
            document.exitFullscreen().catch(err => {
                console.log(`Ошибка при выходе из полноэкранного режима: ${err.message}`);
            });
            // Меняем иконку на "вход в полноэкранный режим"
            fullscreenButton.innerHTML = '⤡';
        }
    }

    // Создание кнопки полноэкранного режима
    createFullscreenButton() {
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'fullscreen-button';
        // Устанавливаем начальную иконку в зависимости от текущего состояния
        fullscreenButton.innerHTML = document.fullscreenElement ? '⤢' : '⤡';
        
        // Обработчик клика по кнопке
        fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        
        // Обработчик изменения состояния полноэкранного режима
        // Срабатывает при любом способе входа/выхода (кнопка, F, ESC)
        document.addEventListener('fullscreenchange', () => {
            fullscreenButton.innerHTML = document.fullscreenElement ? '⤢' : '⤡';
        });

        return fullscreenButton;
    }

    init() {
        // Инициализация обработчиков событий
        document.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const timerType = e.target.dataset.timer;
                this.showScreen(timerType);
            });
        });

        // Обработчик клавиши F для полноэкранного режима
        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
                // Иконка обновится автоматически через обработчик fullscreenchange
            }
        });
    }

    // Продолжить?
}

// Создаем экземпляр таймера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new Timer();
});
