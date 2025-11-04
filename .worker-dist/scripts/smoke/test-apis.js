"use strict";
(async () => {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    console.log('Using BASE_URL=', base);
    function rand(n = 6) { return Math.random().toString(36).slice(2, 2 + n); }
    try {
        // create shop
        const shopRes = await fetch(`${base}/api/shops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `smoke-${rand()}`, platform: 'JUMIA', credentials: {} })
        });
        const shopJson = await shopRes.json();
        console.log('create shop:', shopRes.status, shopJson);
        // create user
        const userRes = await fetch(`${base}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `smoke+${rand()}@example.com`, name: `Smoke ${rand(3)}` })
        });
        const userJson = await userRes.json();
        console.log('create user:', userRes.status, userJson);
        // assign if both succeeded
        if (shopRes.ok && userRes.ok) {
            const assignRes = await fetch(`${base}/api/shops/${shopJson.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userJson.user?.id || userJson.id, roleAtShop: 'ATTENDANT' })
            });
            const assignJson = await assignRes.json();
            console.log('assign:', assignRes.status, assignJson);
        }
        else {
            console.warn('skipping assign because create failed');
        }
    }
    catch (err) {
        console.error('smoke run failed', err);
        process.exitCode = 2;
    }
})();
