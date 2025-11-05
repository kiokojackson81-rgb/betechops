// Boot ts-node in CJS mode to avoid ESM loader cycles, then run the TS script.
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    target: 'ES2017',
  },
});

require('./cleanup-jumia-orders.ts');
