export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasEmail = !!process.env.GA_CLIENT_EMAIL;
  const hasKey = !!process.env.GA_PRIVATE_KEY;
  const gaConnected = hasEmail && hasKey;

  res.json({
    status: 'ok',
    gaConnected,
    debug: {
      hasEmail,
      hasKey,
      emailLength: process.env.GA_CLIENT_EMAIL ? process.env.GA_CLIENT_EMAIL.length : 0,
      keyLength: process.env.GA_PRIVATE_KEY ? process.env.GA_PRIVATE_KEY.length : 0,
    },
    timestamp: new Date().toISOString()
  });
}
