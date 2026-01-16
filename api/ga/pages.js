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

function getMockPages() {
  return [
    { page: '/', views: 2341, users: 1567 },
    { page: '/about', views: 876, users: 654 },
    { page: '/projects', views: 654, users: 432 },
    { page: '/contact', views: 432, users: 321 },
    { page: '/team', views: 234, users: 187 },
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
    return res.json(getMockPages());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    });

    if (response.rows) {
      const pages = response.rows.map((row) => ({
        page: row.dimensionValues[0].value,
        views: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
      }));
      res.json(pages);
    } else {
      res.json(getMockPages());
    }
  } catch (error) {
    console.error('GA Pages Error:', error.message);
    res.json(getMockPages());
  }
}
