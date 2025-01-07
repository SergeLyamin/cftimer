import { Timer } from './Timer.js';

export class IntervalTimer extends Timer {
    constructor() {
        super();
        
        this.settings = {
            rounds: 8,
            workMinutes: 0,
            workSeconds: 20,
            restMinutes: 0,
            restSeconds: 10,
            countdownSeconds: 10
        };

        this.currentRound = 1;
        this.phase = 'countdown';
        this.remainingTime = 0;
        this.workTime = 0;
        this.restTime = 0;
    }

    createScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';
        
        screen.innerHTML = `
            ${this.createHeader('ИНТЕРВАЛЫ')}
            <div class="flex flex-col items-center gap-8 mt-24 w-full max-w-[46rem] px-4">
                <div class="grid grid-cols-[1fr,1fr,1fr] gap-4 w-full">
                    <label class="text-right self-center text-4xl">${this.translations.ROUNDS}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="rounds" 
                               value="${this.settings.rounds}" 
                               min="1" 
                               max="99" 
                               class="w-full bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center">&nbsp;</span>

                    <label class="text-right self-center text-4xl">${this.translations.WORK}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="workMinutes" 
                               value="${this.settings.workMinutes}" 
                               min="0" 
                               max="59" 
                               class="w-[50%] bg-transparent border-none text-4xl text-center">
                        <input type="number" 
                               name="workSeconds" 
                               value="${this.settings.workSeconds}" 
                               min="0" 
                               max="59" 
                               class="w-[50%] bg-transparent border-none text-4xl text-center">
                    </div>
                    <span class="text-4xl self-center uppercase">мин:сек</span>

                    <label class="text-right self-center text-4xl">${this.translations.REST}</label>
                    <div class="flex items-center border-2 border-white w-[16rem] h-[72px]">
                        <input type="number" 
                               name="restMinutes" 
                               value="${this.settings.restMinutes}" 
                               min="0" 
                               max="59" 
                               class="w-[50%] bg-transparent border-none text-4xl text-center">
                        <input type="number" 
                               name="restSeconds" 
                               value="${this.settings.restSeconds}" 
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
                <div class="round-number text-[18vw] font-semibold min-h-[144px] self-center"></div>
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
        const roundsInput = screen.querySelector('[name="rounds"]');
        const workMinutesInput = screen.querySelector('[name="workMinutes"]');
        const workSecondsInput = screen.querySelector('[name="workSeconds"]');
        const restMinutesInput = screen.querySelector('[name="restMinutes"]');
        const restSecondsInput = screen.querySelector('[name="restSeconds"]');
        const countdownInput = screen.querySelector('[name="countdownSeconds"]');

        const saveSettings = () => {
            this.settings = {
                rounds: parseInt(roundsInput.value) || 8,
                workMinutes: parseInt(workMinutesInput.value) || 0,
                workSeconds: parseInt(workSecondsInput.value) || 20,
                restMinutes: parseInt(restMinutesInput.value) || 0,
                restSeconds: parseInt(restSecondsInput.value) || 10,
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
            this.settings = {
                rounds: parseInt(screen.querySelector('[name="rounds"]').value) || 8,
                workMinutes: parseInt(screen.querySelector('[name="workMinutes"]').value) || 0,
                workSeconds: parseInt(screen.querySelector('[name="workSeconds"]').value) || 20,
                restMinutes: parseInt(screen.querySelector('[name="restMinutes"]').value) || 0,
                restSeconds: parseInt(screen.querySelector('[name="restSeconds"]').value) || 10,
                countdownSeconds: parseInt(screen.querySelector('[name="countdownSeconds"]').value) || 10
            };
            
            setupContainer.style.display = 'none';
            timerContainer.classList.remove('hidden');
            timerContainer.classList.add('flex');
            
            // Инициализация состояния
            this.currentRound = 1;
            this.remainingTime = this.settings.countdownSeconds;
            this.phase = 'countdown';
            this.workTime = this.settings.workMinutes * 60 + this.settings.workSeconds;
            this.restTime = this.settings.restMinutes * 60 + this.settings.restSeconds;
            
            this.updateHeader('ИНТЕРВАЛЫ', 'ПОДГОТОВКА');
            
            this.interval = setInterval(() => this.update(), 1000);
            this.isRunning = true;
        } catch (error) {
            console.error('Ошибка запуска таймера:', error);
        }
    }

    update() {
        if (!this.isRunning) return;
        
        const timerDisplay = document.querySelector('.timer-display');
        const roundNumber = document.querySelector('.round-number');
        if (!timerDisplay || !roundNumber) {
            this.cleanup();
            return;
        }
        
        // Отображаем текущее время
        if (this.phase === 'countdown') {
            timerDisplay.textContent = this.formatTime(0, this.remainingTime);
            roundNumber.textContent = '';
            
            if (this.remainingTime <= 3 && this.remainingTime > 0) {
                this.playSound('beep');
            }
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.phase = 'work';
                this.remainingTime = this.workTime;
                roundNumber.style.color = '#FF0101';
                this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound}/${this.settings.rounds} – РАБОТА`);
            } else {
                this.remainingTime--;
            }
        } else if (this.phase === 'work') {
            timerDisplay.textContent = this.formatTime(Math.floor(this.remainingTime / 60), this.remainingTime % 60);
            roundNumber.textContent = this.currentRound;
            
            if (this.remainingTime === 0) {
                if (this.currentRound === this.settings.rounds) {
                    this.finish();
                    return;
                }
                this.playSound('rest');
                this.phase = 'rest';
                this.remainingTime = this.restTime;
                roundNumber.style.color = '#01D9FF';
                this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound}/${this.settings.rounds} – ОТДЫХ`);
            } else {
                this.remainingTime--;
            }
        } else if (this.phase === 'rest') {
            timerDisplay.textContent = this.formatTime(Math.floor(this.remainingTime / 60), this.remainingTime % 60);
            roundNumber.textContent = this.currentRound;
            
            if (this.remainingTime === 0) {
                this.playSound('start');
                this.currentRound++;
                this.phase = 'work';
                this.remainingTime = this.workTime;
                roundNumber.style.color = '#FF0101';
                this.updateHeader('ИНТЕРВАЛЫ', `РАУНД ${this.currentRound}/${this.settings.rounds} – РАБОТА`);
            } else {
                this.remainingTime--;
            }
        }
    }

    finish() {
        this.cleanup();
        
        const timerContainer = document.querySelector('.timer-container');
        if (timerContainer) {
            this.playSound('finish');
            timerContainer.innerHTML = `
                <div class="flex flex-col items-center gap-20">
                    <div class="finish-message text-7xl font-semibold">
                        ${this.settings.rounds} раундов завершены
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
} 