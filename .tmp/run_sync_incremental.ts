async function main() {
  try {
    // Import via dynamic require to avoid ESM resolution issues under ts-node
    // Use CommonJS-style import when available
    let mod: any;
    try {
      mod = await import('../src/lib/jobs/jumia.ts');
    } catch (e) {
      mod = require('../src/lib/jobs/jumia');
    }
    const fn = mod.syncOrdersIncremental ?? mod.default?.syncOrdersIncremental;
    if (!fn) throw new Error('syncOrdersIncremental not found');
    console.log('Invoking syncOrdersIncremental with lookbackDays=90');
    const res = await fn({ lookbackDays: 90 });
    console.log('sync result:', JSON.stringify(res).slice(0, 1000));
  } catch (e) {
    console.error('sync failed', e);
    process.exitCode = 1;
  }
}

main();
