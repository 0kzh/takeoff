import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from './components/App.js';
import { installDevApi } from './store/dev.js';

const root = createRoot(document.getElementById('root')!);
flushSync(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
installDevApi();
