import { BetaAnalyticsDataClient } from '@google-analytics/data';

const PROPERTY_ID = '461877498';

let analyticsClient = null;

if (process.env.GA_CLIENT_EMAIL && process.env.GA_PRIVATE_KEY) {
  analyticsClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA_CLIENT_EMAIL,
      private_key: process.env.GA_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });
}

function getMockDevices() {
  return [
    { device: 'desktop', users: 1876, fill: '#13636f' },
    { device: 'mobile', users: 987, fill: '#3ab0c4' },
    { device: 'tablet', users: 135, fill: '#d4af37' },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockDevices());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
    });

    if (response.rows) {
      const colors = { desktop: '#13636f', mobile: '#3ab0c4', tablet: '#d4af37' };
      const devices = response.rows.map((row) => ({
        device: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        fill: colors[row.dimensionValues[0].value.toLowerCase()] || '#667085',
      }));
      res.json(devices);
    } else {
      res.json(getMockDevices());
    }
  } catch (error) {
    console.error('GA Devices Error:', error.message);
    res.json(getMockDevices());
  }
}
