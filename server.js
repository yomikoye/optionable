import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createApp, startServer } from './server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = createApp(__dirname);
startServer(app);
