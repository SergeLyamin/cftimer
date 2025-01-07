import { Timer } from './Timer.js';

export class AmrapTimer extends Timer {
    constructor() {
        super();
        
        this.settings = {
            targetMinutes: 10,
            targetSeconds: 0,
            countdownSeconds: 10
        };

        this.phase = 'countdown';
        this.remainingTime = 0;
        this.targetTime = 0;
    }

    createScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';
        
        screen.innerHTML = `
            ${this.createHeader('AMRAP')}
            <div class="flex flex-col items-center gap-8 mt-24 w-full max-w-[46rem] px-4">
                <div class="grid grid-cols-[1fr,1fr,1fr] gap-4 w-full">
                    <label class="text-right self-center text-4xl">${this.translations.TARGET}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="targetMinutes" 
                               value="${this.settings.targetMinutes}" 
                               min="0" 
                               max="59" 
                               class="w-[50%] bg-transparent border-none text-4xl text-center">
                        <input type="number" 
                               name="targetSeconds" 
                               value="${this.settings.targetSeconds}" 
                               min="0" 
                               max="59" 
                               class="w-[50%] bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">мин:сек</span>

                    <label class="text-right self-center text-4xl">${this.translations.COUNTDOWN}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="countdownSeconds" 
                               value="${this.settings.countdownSeconds}" 
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
            
            <div class="timer-container hidden w-full flex justify-center items-center gap-20 md:my-10">
                <div class="timer-display text-[18vw] font-semibold min-h-[144px] text-center self-center cursor-pointer"></div>
            </div>
        `;

        this.bindEvents(screen);
        return screen;
    }

    bindEvents(screen) {
        const startButton = screen.querySelector('.start-button');
        startButton.addEventListener('click', () => {
            this.start(screen);
        });

        // Сохраняем ссылки на inputs
        const targetMinutesInput = screen.querySelector('[name="targetMinutes"]');
        const countdownInput = screen.querySelector('[name="countdownSeconds"]');

        const saveSettings = () => {
            this.settings = {
                targetMinutes: parseInt(targetMinutesInput.value) || 10,
                targetSeconds: 0, // Всегда 0, так как нет поля ввода
                countdownSeconds: parseInt(countdownInput.value) || 10
            };
        };

        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', saveSettings);
        });

        const timerDisplay = screen.querySelector('.timer-display');
        timerDisplay.addEventListener('click', () => this.togglePause());
    }

    start(screen) {
        try {
            if (!screen) return;

            const setupContainer = screen.querySelector('.flex.flex-col');
            const timerContainer = screen.querySelector('.timer-container');
            
            // Сохраняем настройки перед стартом
            const targetMinutes = parseInt(screen.querySelector('[name="targetMinutes"]').value);
            const targetSeconds = parseInt(screen.querySelector('[name="targetSeconds"]').value);
            const countdownSeconds = parseInt(screen.querySelector('[name="countdownSeconds"]').value);

            this.settings = {
                targetMinutes: isNaN(targetMinutes) ? 10 : targetMinutes,
                targetSeconds: isNaN(targetSeconds) ? 0 : targetSeconds,
                countdownSeconds: isNaN(countdownSeconds) ? 10 : countdownSeconds
            };
            
            setupContainer.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex');
            
            // Инициализация состояния
            this.remainingTime = this.settings.countdownSeconds;
            this.phase = 'countdown';
            this.targetTime = this.settings.targetMinutes * 60 + this.settings.targetSeconds;
            
            // Показываем целевое время в заголовке
            const targetTimeStr = this.formatTime(this.settings.targetMinutes, this.settings.targetSeconds);
            this.updateHeader('AMRAP', targetTimeStr);
            
            this.interval = setInterval(() => this.update(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    update() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        if (!timerDisplay) {
            this.cleanup();
            return;
        }
        
        if (this.phase === 'countdown') {
            if (this.remainingTime <= 3 && this.remainingTime > 0) {
                this.playSound('beep');
            }
            
            timerDisplay.textContent = this.formatTime(0, this.remainingTime);
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.phase = 'running';
                this.remainingTime = this.targetTime;
                const targetTimeStr = this.formatTime(this.settings.targetMinutes, this.settings.targetSeconds);
                this.updateHeader('AMRAP', targetTimeStr);
            } else {
                this.remainingTime--;
            }
        } else if (this.phase === 'running') {
            if (this.remainingTime === 0) {
                this.finish();
                return;
            }
            
            timerDisplay.textContent = this.formatTime(
                Math.floor(this.remainingTime / 60),
                this.remainingTime % 60
            );
            this.remainingTime--;
        }
    }

    finish() {
        this.cleanup();
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            const targetTimeStr = this.formatTime(this.settings.targetMinutes, this.settings.targetSeconds);
            timerContainer.innerHTML = `
                <div class="flex flex-col items-center gap-20">
                    <div class="finish-message text-7xl font-semibold">
                        ${targetTimeStr} выполнены
                    </div>
                    <button class="restart-button w-[16rem] h-[72px] text-4xl bg-transparent border-2 border-white cursor-pointer uppercase hover:bg-white hover:text-black">
                        ${this.translations.RESTART}
                    </button>
                </div>
            `;
            
            const restartButton = timerContainer.querySelector('.restart-button');
            if (restartButton) {
                restartButton.addEventListener('click', () => {
                    // Очищаем контейнер и показываем начальный экран
                    const timerScreens = document.getElementById('timer-screens');
                    timerScreens.innerHTML = '';
                    const screen = this.createScreen();
                    timerScreens.appendChild(screen);
                });
            }
        }
    }

    cleanup() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        this.isTransitioning = false;
    }

    saveSettings(screen) {
        try {
            this.settings = {
                targetMinutes: parseInt(screen.querySelector('[name="targetMinutes"]').value) || 10,
                targetSeconds: parseInt(screen.querySelector('[name="targetSeconds"]').value) || 0,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
        }
    }
} 