import { BetaAnalyticsDataClient } from '@google-analytics/data';

const PROPERTY_ID = '461877498';

function getAnalyticsClient() {
  if (process.env.GA_CLIENT_EMAIL && process.env.GA_PRIVATE_KEY) {
    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA_CLIENT_EMAIL,
        private_key: process.env.GA_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });
  }
  return null;
}

function getMockCities() {
  return [
    { city: 'New York', users: 234 },
    { city: 'London', users: 187 },
    { city: 'Singapore', users: 156 },
    { city: 'Dubai', users: 134 },
    { city: 'Shanghai', users: 112 },
    { city: 'Los Angeles', users: 98 },
    { city: 'Karachi', users: 87 },
    { city: 'Toronto', users: 76 },
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

  const analyticsClient = getAnalyticsClient();

  if (!analyticsClient) {
    return res.json(getMockCities());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'city' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    if (response.rows) {
      const cities = response.rows.map((row) => ({
        city: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
      }));
      res.json(cities);
    } else {
      res.json(getMockCities());
    }
  } catch (error) {
    console.error('GA Cities Error:', error.message);
    res.json(getMockCities());
  }
}
