import { render } from 'preact';
import './styles/base.css';
import './styles/components.css';
import { AppShell } from './ui/app-shell.js';
import { kv } from './state/app.js';
import { startPersistence } from './state/persist.js';

startPersistence(kv);

const mount = document.getElementById('app');
if (mount === null) throw new Error('asanakit studio: #app mount point missing');

render(<AppShell />, mount);
