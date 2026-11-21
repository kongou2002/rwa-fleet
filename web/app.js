// FleetShares web app entry. Plain ES modules, no build step.
// Each view module registers itself with registerView() when imported.
import { boot } from './core.js';
import './views/vault.js';
import './views/car.js';
import './views/market.js';
import './views/portfolio.js';
import './views/transparency.js';
import './views/how.js';

boot();
