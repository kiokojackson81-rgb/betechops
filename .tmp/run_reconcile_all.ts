import { reconcileWeeks } from '../src/lib/jobs/onlineReconcile.ts';
(async ()=>{
  const res = await reconcileWeeks(12);
  console.log(JSON.stringify(res, null, 2));
})();
