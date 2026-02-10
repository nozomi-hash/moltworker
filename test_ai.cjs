async function testAi() {
    const url = 'https://moltbot-sandbox.nozomi-zinga.workers.dev/api/admin/test-ai';
    const token = '12345';
    console.log(`Testing AI connectivity at ${url}...`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers.get('content-type')}`);
        console.log(`X-Moltworker-Source: ${res.headers.get('x-moltworker-source')}`);

        const text = await res.text();
        console.log('--- Body Start ---');
        console.log(text.slice(0, 1000));
        console.log('--- Body End ---');

        if (res.status === 401) {
            console.log('Note: 401 is expected if not authenticated via Cloudflare Access cookies in this script.');
            console.log('However, if it returned HTML, the navy screen issue persists.');
        }
    } catch (err) {
        console.error('Fetch failed:', err);
    }
}

testAi();
