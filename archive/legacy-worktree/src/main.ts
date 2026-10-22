import { App } from './app/App';
import './styles/main.css';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  await app.initialize();
});