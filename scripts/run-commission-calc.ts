import { commissionCalcJob } from '../src/lib/jobs/syncJobs';

async function main() {
  try {
    console.log('Starting commissionCalcJob...');
    const result = await commissionCalcJob();
    console.log('commissionCalcJob result:\n', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('commissionCalcJob failed:', err);
    process.exit(1);
  }
}

main();
