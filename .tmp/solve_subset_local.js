// Local subset solver using known per-account payouts for week 2026-01-05
const items = [
  { id: '3ad790b3-e827-49e2-b1a1-4fb978c9b577', amt: 139813.95 },
  { id: '0307b9d2-5971-4abd-ab3b-d75bed0bab74', amt: 308921.76 },
  { id: '7596b1ff-df9c-4a4c-8266-6d96659c12d6', amt: 0.0 },
  { id: '84c205b8-c1c7-40b7-8f2a-b4ba971d3cb4', amt: 85071.6 },
  { id: 'd8bc9dd9-27fd-4999-9b2d-4fa8d59686ef', amt: 151685.04 },
  { id: '0a76295b-a31d-4e89-9876-44d069939a50', amt: 818.82 },
  { id: '8deea4b5-a4f5-4b67-8530-6f15154acbc1', amt: 36713.58 },
  { id: '9d13d36e-c67c-4388-943e-af7c3effde8c', amt: 308921.76 },
];

const target = 767281.06;
function cents(n){return Math.round(n*100);} 
const tC = cents(target);
const n = items.length;
function findBestWithinTolerance(toleranceKES) {
  const tolC = Math.round(toleranceKES * 100);
  let best = null;
  for(let mask=1; mask < (1<<n); mask++){
    let sum=0; const sel=[];
    for(let i=0;i<n;i++) if(mask & (1<<i)){ sum += cents(items[i].amt); sel.push(items[i]); }
    const diff = Math.abs(sum - tC);
    if (diff <= tolC) return { sel, sum, diff };
    if (!best || diff < best.diff) best = { sel, sum, diff };
  }
  return { bestFound: best };
}

const tolerances = [1, 10, 100, 1000, 2500, 5000];
let found = null;
for (const tol of tolerances) {
  const res = findBestWithinTolerance(tol);
  if (res && res.sel) { found = { tol, sel: res.sel, sum: res.sum, diff: res.diff }; break; }
}

if (found) {
  console.log(`Found subset within tolerance ${found.tol} KES:`);
  for (const s of found.sel) console.log(' -', s.id, s.amt.toFixed(2));
  console.log('Sum:', (found.sum/100).toFixed(2), 'diff:', (found.diff/100).toFixed(2));
} else {
  console.log('No subset found within tested tolerances. Closest overall match:');
  const overall = findBestWithinTolerance(1e9).bestFound; // effectively no tolerance
  console.log('Sum:', (overall.sum/100).toFixed(2), 'diff:', (overall.diff/100).toFixed(2));
  for (const s of overall.sel) console.log(' -', s.id, s.amt.toFixed(2));
}
