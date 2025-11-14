
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Web3Provider } from './contexts/Web3Context';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </React.StrictMode>
);
