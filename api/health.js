export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const gaConnected = !!(process.env.GA_CLIENT_EMAIL && process.env.GA_PRIVATE_KEY);

  res.json({
    status: 'ok',
    gaConnected,
    timestamp: new Date().toISOString()
  });
}
