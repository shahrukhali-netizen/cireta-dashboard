import { BetaAnalyticsDataClient } from '@google-analytics/data';

const PROPERTY_ID = '472271698';

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

function getMockOverview() {
  return {
    activeUsers: 2998,
    sessions: 4521,
    pageViews: 6957,
    events: 28182,
    avgSessionDuration: 61.5,
    bounceRate: 45.2,
    newUsers: 2654,
    engagedSessions: 2891,
  };
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
    return res.json(getMockOverview());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'eventCount' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'newUsers' },
        { name: 'engagedSessions' },
      ],
    });

    if (response.rows && response.rows[0]) {
      const metrics = response.rows[0].metricValues;
      res.json({
        activeUsers: parseInt(metrics[0].value),
        sessions: parseInt(metrics[1].value),
        pageViews: parseInt(metrics[2].value),
        events: parseInt(metrics[3].value),
        avgSessionDuration: parseFloat(metrics[4].value),
        bounceRate: parseFloat(metrics[5].value) * 100,
        newUsers: parseInt(metrics[6].value),
        engagedSessions: parseInt(metrics[7].value),
        _isLive: true
      });
    } else {
      res.json({ ...getMockOverview(), _isLive: false, _noRows: true });
    }
  } catch (error) {
    console.error('GA Overview Error:', error.message);
    res.json({
      ...getMockOverview(),
      _error: error.message,
      _isLive: false
    });
  }
}
