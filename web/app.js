// FleetShares web app entry. Plain ES modules, no build step.
// Each view module registers itself with registerView() when imported.
import { boot } from './core.js?v=20261125b';
import './views/vault.js?v=20261125b';
import './views/car.js?v=20261125b';
import './views/market.js?v=20261125b';
import './views/portfolio.js?v=20261125b';
import './views/transparency.js?v=20261125b';
import './views/how.js?v=20261125b';

boot();
