import { syncOrdersJob, syncPayoutsJob, returnsSlaJob, commissionCalcJob, priceLearnerJob } from './jobs/syncJobs';

export async function runAllJobs() {
  const out: Record<string, any> = {};
  out.syncOrders = await syncOrdersJob();
  out.syncPayouts = await syncPayoutsJob();
  out.returnsSla = await returnsSlaJob();
  out.commissionCalc = await commissionCalcJob();
  out.priceLearner = await priceLearnerJob();
  return out;
}

// Example: callers can import runAllJobs and invoke on a schedule.
