import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/index.css'

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const bridge = window.electronAPI;
console.log = (...args) => {
  originalLog(...args);
  try { bridge?.send('renderer-log', 'INFO', ...args); } catch {}
};
console.error = (...args) => {
  originalError(...args);
  try { bridge?.send('renderer-log', 'ERROR', ...args); } catch {}
};
console.warn = (...args) => {
  originalWarn(...args);
  try { bridge?.send('renderer-log', 'WARN', ...args); } catch {}
};

window.onerror = (message, source, lineno, colno, error) => {
  console.error('Renderer Error:', message, 'at', source, lineno, colno, error);
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
