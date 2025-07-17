# Чек-лист рефакторинга

## Ключевые селекторы
- [ ] .menu-item
- [ ] .timer-display
- [ ] .timer-container
- [ ] .back-button
- [ ] .fullscreen-button
- [ ] #main-menu
- [ ] #timer-screens
- [ ] #qr-container
- [ ] #settings-button
- [ ] #clock-button
- [ ] #qr-modal

## CSS классы
- [ ] .screen
- [ ] .hidden
- [ ] .modal-slide-up
- [ ] .show
- [ ] .transition-duration-200

## Обработчики событий
- [ ] click на .menu-item
- [ ] click на .back-button
- [ ] click на .fullscreen-button
- [ ] click на #settings-button
- [ ] click на #clock-button
- [ ] keydown для 'Escape'
- [ ] change для input[type="number"]

## Методы таймера
- [ ] showScreen()
- [ ] toggleFullscreen()
- [ ] togglePause()
- [ ] startClock()
- [ ] startForTime()
- [ ] startInterval()
- [ ] startAmrap()
- [ ] updateHeader()
- [ ] playSound()

## Состояния таймера
- [ ] isRunning
- [ ] isTransitioning
- [ ] currentScreen
- [ ] interval
- [ ] phase
- [ ] remainingTime
- [ ] elapsedTime
- [ ] currentRound

## Звуковые файлы
- [ ] beep.mp3
- [ ] start.mp3
- [ ] finish.mp3
- [ ] rest.mp3

## WebSocket события
- [ ] 'screen-change'
- [ ] 'controller-connected'
- [ ] 'controller-disconnected'
- [ ] 'command'