// Load tsconfig-paths first so path aliases are registered before ts-node compiles imports
require('tsconfig-paths/register');
require('ts-node/register');

(async () => {
  try {
    const { commissionCalcJob } = require('../src/lib/jobs/syncJobs');
    console.log('Starting commissionCalcJob (CJS runner)...');
    const result = await commissionCalcJob();
    console.log('commissionCalcJob result:\n', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('commissionCalcJob failed:', err);
    process.exit(1);
  }
})();
