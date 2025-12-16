require('ts-node/register');
require('tsconfig-paths/register');

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
