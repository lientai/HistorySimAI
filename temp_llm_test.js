const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:3002/api/chongzhen/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: { currentDay: 10, currentPhase: 'morning', currentMonth: 1, currentYear: 1630, nation: { treasury: 1000000 } },
        lastChoiceId: 'reinforce_border',
        lastChoiceText: '继续增派军队，加强边防',
      }),
    });

    console.log('status', res.status);
    const text = await res.text();
    console.log('body:', text);
  } catch (e) {
    console.error('error', e);
  }
})();
