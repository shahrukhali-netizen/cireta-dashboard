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

function getMockMonthly() {
  return [
    { month: 'Oct 25', activeUsers: 530, pageViews: 778, events: 5135, sessions: 612 },
    { month: 'Nov 25', activeUsers: 1600, pageViews: 2600, events: 10834, sessions: 1890 },
    { month: 'Dec 25', activeUsers: 475, pageViews: 1751, events: 6501, sessions: 892 },
    { month: 'Jan 26', activeUsers: 393, pageViews: 1828, events: 5712, sessions: 1127 },
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
    return res.json(getMockMonthly());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'eventCount' },
        { name: 'sessions' },
      ],
      orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
    });

    if (response.rows) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthly = response.rows.map((row) => {
        const ym = row.dimensionValues[0].value;
        const year = ym.substring(2, 4);
        const monthNum = parseInt(ym.substring(4, 6));
        return {
          month: `${monthNames[monthNum - 1]} ${year}`,
          activeUsers: parseInt(row.metricValues[0].value),
          pageViews: parseInt(row.metricValues[1].value),
          events: parseInt(row.metricValues[2].value),
          sessions: parseInt(row.metricValues[3].value),
        };
      });
      res.json(monthly);
    } else {
      res.json(getMockMonthly());
    }
  } catch (error) {
    console.error('GA Monthly Error:', error.message);
    res.json(getMockMonthly());
  }
}
