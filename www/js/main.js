import { Timer } from './components/Timer.js';
import { IntervalTimer } from './components/Interval.js';
import { ForTimeTimer } from './components/ForTime.js';
import { AmrapTimer } from './components/Amrap.js';
import { ClockTimer } from './components/Clock.js';

document.addEventListener('DOMContentLoaded', () => {
    // Создаем экземпляры таймеров
    const timers = {
        interval: new IntervalTimer(),
        fortime: new ForTimeTimer(),
        amrap: new AmrapTimer(),
        clock: new ClockTimer()
    };

    // Базовый таймер для общей функциональности
    const baseTimer = new Timer();
    window.timer = baseTimer; // Временно оставляем глобальную переменную

    // Обработчики для модального окна настроек
    const settingsButton = document.getElementById('settings-button');
    const settingsBackdrop = document.getElementById('settings-backdrop');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    settingsButton.addEventListener('click', () => {
        settingsBackdrop.classList.remove('hidden');
        requestAnimationFrame(() => {
            settingsBackdrop.classList.add('show');
            settingsModal.classList.add('show');
        });
    });

    function closeModal() {
        settingsBackdrop.classList.remove('show');
        settingsModal.classList.remove('show');
        setTimeout(() => {
            settingsBackdrop.classList.add('hidden');
        }, 300);
    }

    closeSettings.addEventListener('click', closeModal);
    settingsBackdrop.addEventListener('click', (e) => {
        if (e.target === settingsBackdrop) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Обработчики для кнопок меню
    document.querySelectorAll('.menu-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const timerType = e.target.dataset.timer;
            if (timerType && timers[timerType]) {
                const timer = timers[timerType];
                const screen = timer.createScreen();
                
                const timerScreens = document.getElementById('timer-screens');
                timerScreens.innerHTML = '';
                timerScreens.appendChild(screen);

                document.getElementById('main-menu').style.display = 'none';
                timerScreens.style.display = 'block';
            }
        });
    });

    // Обработчик для часов
    document.getElementById('clock-button').addEventListener('click', () => {
        if (timers.clock) {
            const clockButton = document.getElementById('clock-button');
            clockButton.style.display = 'none';
            
            const screen = timers.clock.createScreen();
            const timerScreens = document.getElementById('timer-screens');
            timerScreens.innerHTML = '';
            timerScreens.appendChild(screen);

            document.getElementById('main-menu').style.display = 'none';
            timerScreens.style.display = 'block';
        }
    });

    // Обработчик для кнопки "Назад"
    document.addEventListener('click', (e) => {
        if (e.target.closest('.back-button')) {
            const currentTimer = Object.values(timers).find(timer => 
                timer.interval !== null || timer.isRunning
            );
            
            if (currentTimer) {
                currentTimer.cleanup();
            }

            const clockButton = document.getElementById('clock-button');
            clockButton.style.display = 'block';

            document.getElementById('timer-screens').style.display = 'none';
            document.getElementById('main-menu').style.display = 'flex';
        }
    });

    // Обработчик для кнопки "Полный экран"
    document.addEventListener('click', (e) => {
        if (e.target.closest('.fullscreen-button')) {
            baseTimer.toggleFullscreen();
        }
    });
}); 