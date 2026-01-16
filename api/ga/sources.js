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

function getMockSources() {
  return {
    channels: [
      { channel: 'Organic Search', users: 1245, sessions: 1890, fill: '#13636f' },
      { channel: 'Direct', users: 876, sessions: 1234, fill: '#1a7a88' },
      { channel: 'Social', users: 543, sessions: 678, fill: '#3ab0c4' },
      { channel: 'Referral', users: 321, sessions: 432, fill: '#5cc4d4' },
      { channel: 'Email', users: 198, sessions: 267, fill: '#7dd3e0' },
      { channel: 'Paid Search', users: 87, sessions: 123, fill: '#a0e2eb' },
    ],
    sources: [
      { source: 'google', users: 1100, sessions: 1650 },
      { source: '(direct)', users: 876, sessions: 1234 },
      { source: 'linkedin.com', users: 320, sessions: 410 },
      { source: 'twitter.com', users: 180, sessions: 225 },
      { source: 'facebook.com', users: 43, sessions: 58 },
      { source: 'bing', users: 89, sessions: 134 },
      { source: 'yahoo', users: 56, sessions: 78 },
    ],
    mediums: [
      { medium: 'organic', users: 1245, sessions: 1890 },
      { medium: '(none)', users: 876, sessions: 1234 },
      { medium: 'referral', users: 543, sessions: 678 },
      { medium: 'social', users: 321, sessions: 432 },
      { medium: 'email', users: 198, sessions: 267 },
      { medium: 'cpc', users: 87, sessions: 123 },
    ],
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
    return res.json(getMockSources());
  }

  try {
    const colors = ['#13636f', '#1a7a88', '#2596a8', '#3ab0c4', '#5cc4d4', '#7dd3e0', '#a0e2eb', '#c3f0f5'];

    // Fetch channel grouping data
    const [channelResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    // Fetch source data
    const [sourceResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    // Fetch medium data
    const [mediumResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionMedium' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const result = {
      channels: [],
      sources: [],
      mediums: [],
    };

    if (channelResponse.rows) {
      result.channels = channelResponse.rows.map((row, idx) => ({
        channel: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
        fill: colors[idx % colors.length],
      }));
    }

    if (sourceResponse.rows) {
      result.sources = sourceResponse.rows.map((row) => ({
        source: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      }));
    }

    if (mediumResponse.rows) {
      result.mediums = mediumResponse.rows.map((row) => ({
        medium: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      }));
    }

    res.json(result);
  } catch (error) {
    console.error('GA Sources Error:', error.message);
    res.json(getMockSources());
  }
}
