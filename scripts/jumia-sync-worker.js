// JS bootstrap to run the built worker from .worker-dist
require('dotenv/config');
// In the built output, this file is copied to .worker-dist/scripts/
// and the compiled worker exists at .worker-dist/scripts/jumia-sync-worker.js
require('./jumia-sync-worker.js');
