import { Timer } from './Timer.js';

export class ClockTimer extends Timer {
    constructor() {
        super();
        this.interval = null;
    }

    createScreen() {
        const screen = document.createElement('div');
        screen.className = 'screen flex flex-col items-center relative w-full pt-20';
        
        screen.innerHTML = `
            ${this.createHeader('ЧАСЫ')}
            <div class="w-full flex justify-center items-center mt-24">
                <div class="clock-display text-[18vw] font-semibold min-h-[144px] text-center"></div>
            </div>
        `;

        this.startClock(screen);
        return screen;
    }

    startClock(screen) {
        const clockDisplay = screen.querySelector('.clock-display');
        
        const updateDisplay = () => {
            const now = new Date();
            clockDisplay.textContent = now.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };

        // Первое обновление
        updateDisplay();
        
        // ��бновление каждую секунду
        this.interval = setInterval(updateDisplay, 1000);
    }

    cleanup() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
} 