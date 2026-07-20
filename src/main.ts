import './style.css';
import { startApp } from './ui/app';

const container = document.getElementById('app');
if (container) {
  startApp(container);
}
