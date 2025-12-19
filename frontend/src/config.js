// frontend/src/config.js
const isElectron = window.navigator.userAgent.includes('Electron');

const API_URL = isElectron
  ? 'http://localhost:3001/api'
  : 'http://localhost:3001/api';

export default API_URL;
