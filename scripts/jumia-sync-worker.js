// JS bootstrap to run the TS worker under Node with ts-node and tsconfig-paths
require('dotenv/config');
require('ts-node/register');
require('tsconfig-paths/register');
require('./jumia-sync-worker.ts');
