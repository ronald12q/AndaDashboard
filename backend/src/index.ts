import 'dotenv/config';
import { createApp } from './app.js';
import { validateJwtConfiguration } from './lib/jwt.js';
import { institutionalDomains } from './lib/validation.js';

validateJwtConfiguration();
institutionalDomains();

const PORT = Number(process.env.PORT ?? 3000);
const host = process.env.HOST;

if (process.env.TRUST_LOCAL_PROXY === 'true' && host !== '127.0.0.1' && host !== '::1') {
  throw new Error('TRUST_LOCAL_PROXY requiere HOST=127.0.0.1 o HOST=::1.');
}

const app = createApp();

const onListen = () => {
  console.log(`🚀 API lista en http://localhost:${PORT}`);
};
if (host) app.listen(PORT, host, onListen);
else app.listen(PORT, onListen);
