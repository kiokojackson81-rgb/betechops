#!/usr/bin/env node
const fetch = globalThis.fetch || require('node-fetch');
const CLIENT_ID = 'f7df0953-7c18-4191-b304-614f9f0987a4';
const REFRESH = '3USNy5f3rr89XWye1xc5ELHdvGMsylc2xofdC9Nh1uo';
const URL = 'https://vendor-api.jumia.com/token';

(async ()=>{
  try{
    const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: REFRESH });
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    console.log('status', res.status);
    const text = await res.text();
    console.log('body', text);
  }catch(e){ console.error('ERR', e); process.exit(1); }
})();
