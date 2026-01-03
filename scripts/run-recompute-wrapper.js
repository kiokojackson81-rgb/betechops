const path = require('path');
const fs = require('fs');

(function registerAndRun() {
  try {
    const projectRoot = path.resolve(__dirname, '..');

    // Register ts-node programmatically
    try {
      require('ts-node').register({
        transpileOnly: true,
        project: path.join(projectRoot, 'tsconfig.json'),
        // Force CommonJS and node resolution to avoid ESM package-resolution for path aliases
        compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
      });
    } catch (e) {
      console.error('Failed to register ts-node:', e.message || e);
      process.exit(1);
    }

    // Read tsconfig to get path mappings and register tsconfig-paths
    try {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      const baseUrl = projectRoot;
      const paths = (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) || {};
      require('tsconfig-paths').register({ baseUrl, paths });
    } catch (e) {
      console.error('Failed to register tsconfig-paths:', e.message || e);
      process.exit(1);
    }

    // Hand off to the existing JS runner which will require the TS modules.
    require('./recompute-marketing-run.js');
  } catch (err) {
    console.error('Wrapper error:', err);
    process.exit(1);
  }
})();
