import { IEventBus } from '../types/services.types';

export class EventBus implements IEventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Возвращаем функцию для отписки
    return () => this.off(event, callback);
  }

  once(event: string, callback: (data: any) => void): void {
    const onceCallback = (data: any) => {
      callback(data);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  off(event: string, callback?: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      if (callback) {
        eventListeners.delete(callback);
      } else {
        eventListeners.clear();
      }
    }
  }
}