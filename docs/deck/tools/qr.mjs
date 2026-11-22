// node qr.mjs <out.svg> <url>   (needs the `qrcode` package; QR_MODULES points at a node_modules dir that has it)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire((process.env.QR_MODULES || process.cwd()) + '/');
const QR = require('qrcode');
const [,, out, url] = process.argv;
const svg = await QR.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0d1117', light: '#ffffff' } });
fs.writeFileSync(out, svg); console.log(out, url);
