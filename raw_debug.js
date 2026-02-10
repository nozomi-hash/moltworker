const fetch = require('node-fetch');

async function debug() {
    const url = 'https://moltbot-sandbox.nozomi-zinga.workers.dev/api/admin/diagnostics';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers.get('content-type')}`);
        console.log('--- Body Start ---');
        console.log(text.slice(0, 1000));
        console.log('--- Body End ---');
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

debug();
