import { IApp, AppState } from '../types/app.types';
import { EventBus } from '../services/EventBus';
import { StateManager } from '../services/StateManager';
import { TimerEngine } from '../timers/TimerEngine';

export class App implements IApp {
  private eventBus: EventBus;
  private stateManager: StateManager;
  private timerEngine: TimerEngine;

  constructor() {
    this.eventBus = new EventBus();
    this.stateManager = new StateManager(this.eventBus);
    this.timerEngine = new TimerEngine(this.eventBus);
  }

  async initialize(): Promise<void> {
    // Инициализация приложения
    console.log('CrossFit Timer v2.0 initializing...');
  }

  navigate(screen: string, params?: any): void {
    // Навигация между экранами
  }

  getCurrentState(): AppState {
    return this.stateManager.getState();
  }

  destroy(): void {
    // Очистка ресурсов
  }
}