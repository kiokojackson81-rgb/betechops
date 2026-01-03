const urlBase = 'http://localhost:3000';
const impersonateId = 'cmimxqfnr0005v5mc05nwhg9o';

async function fetchText(path){
  const res = await fetch(urlBase + path, {redirect:'follow'});
  const ct = res.headers.get('content-type') || '';
  const body = await res.text();
  return {status: res.status, headers: Object.fromEntries(res.headers), body, contentType: ct};
}

(async ()=>{
  try{
    console.log('Fetching page: /admin/daily-report?impersonateId='+impersonateId+'\n');
    const page = await fetchText('/admin/daily-report?impersonateId='+impersonateId);
    console.log('PAGE STATUS:', page.status);
    console.log('PAGE content-type:', page.contentType);
    console.log('PAGE snippet:\n', page.body.slice(0, 4000));

    const apis = [
      `/api/daily-report?impersonateId=${impersonateId}`,
      `/api/attendant/earnings/summary?impersonateId=${impersonateId}`,
      `/api/online/earnings/summary?impersonateId=${impersonateId}`
    ];

    for(const p of apis){
      console.log('\nFetching API:', p);
      try{
        const r = await fetchText(p);
        console.log('STATUS:', r.status, 'content-type:', r.contentType);
        if((r.contentType||'').includes('application/json')){
          try{ console.log('JSON:', JSON.stringify(JSON.parse(r.body), null, 2).slice(0, 4000)); }catch(e){ console.log('JSON parse failed, raw body snippet:', r.body.slice(0,2000)); }
        } else {
          console.log('BODY snippet:', r.body.slice(0,2000));
        }
      }catch(e){ console.error('API fetch failed', e); }
    }
  }catch(e){ console.error('fetch script failed:', e); }
})();
