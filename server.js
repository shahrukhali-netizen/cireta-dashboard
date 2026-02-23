import express from 'express';
import cors from 'cors';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Cireta Website GA4 Property ID
const PROPERTY_ID = '461877498';

// Initialize GA client with service account
let analyticsClient = null;

const credentialsPath = join(__dirname, 'ga-credentials.json');
if (existsSync(credentialsPath)) {
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  analyticsClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
  });
  console.log('GA Service Account loaded successfully');
} else {
  console.warn('Warning: ga-credentials.json not found. GA endpoints will return mock data.');
}

// Helper to format date
const formatDate = (dateStr) => dateStr;

// GA Overview endpoint
app.get('/api/ga/overview', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockOverview());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
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
      });
    } else {
      res.json(getMockOverview());
    }
  } catch (error) {
    console.error('GA Overview Error:', error.message);
    res.json(getMockOverview());
  }
});

// GA Monthly Data endpoint
app.get('/api/ga/monthly', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockMonthly());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
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
});

// GA Countries endpoint
app.get('/api/ga/countries', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockCountries());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    if (response.rows) {
      const colors = ['#13636f', '#1a7a88', '#2596a8', '#3ab0c4', '#5cc4d4', '#7dd3e0', '#a0e2eb', '#c3f0f5', '#e0f7fa', '#f0fbfc'];
      const countries = response.rows.map((row, idx) => ({
        country: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        fill: colors[idx % colors.length],
      }));
      res.json(countries);
    } else {
      res.json(getMockCountries());
    }
  } catch (error) {
    console.error('GA Countries Error:', error.message);
    res.json(getMockCountries());
  }
});

// GA Cities endpoint
app.get('/api/ga/cities', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockCities());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
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
});

// GA Devices endpoint
app.get('/api/ga/devices', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockDevices());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
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
});

// GA Pages endpoint
app.get('/api/ga/pages', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockPages());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
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
});

// GA Events endpoint
app.get('/api/ga/events', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockEvents());
  }

  try {
    const [response] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 50,
    });

    if (response.rows) {
      const events = response.rows.map((row) => ({
        eventName: row.dimensionValues[0].value,
        count: parseInt(row.metricValues[0].value),
      }));
      res.json(events);
    } else {
      res.json(getMockEvents());
    }
  } catch (error) {
    console.error('GA Events Error:', error.message);
    res.json(getMockEvents());
  }
});

// GA Sources endpoint
app.get('/api/ga/sources', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockSources());
  }

  try {
    const colors = ['#13636f', '#1a7a88', '#2596a8', '#3ab0c4', '#5cc4d4', '#7dd3e0', '#a0e2eb', '#c3f0f5'];

    const [channelResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const [sourceResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const [mediumResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'sessionMedium' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    });

    const result = { channels: [], sources: [], mediums: [] };

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
});

// GA Demographics endpoint
app.get('/api/ga/demographics', async (req, res) => {
  const { startDate = '90daysAgo', endDate = 'today' } = req.query;

  if (!analyticsClient) {
    return res.json(getMockDemographics());
  }

  try {
    const colors = ['#13636f', '#1a7a88', '#2596a8', '#3ab0c4', '#5cc4d4', '#7dd3e0', '#a0e2eb', '#c3f0f5'];

    const [browserResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'browser' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    });

    const [osResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'operatingSystem' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    });

    const [resolutionResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'screenResolution' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    });

    const [languageResponse] = await analyticsClient.runReport({
      property: `properties/${PROPERTY_ID}`,
      dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
      dimensions: [{ name: 'language' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 8,
    });

    const result = { browsers: [], operatingSystems: [], screenResolutions: [], languages: [] };

    if (browserResponse.rows) {
      result.browsers = browserResponse.rows.map((row, idx) => ({
        browser: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        fill: colors[idx % colors.length],
      }));
    }

    if (osResponse.rows) {
      result.operatingSystems = osResponse.rows.map((row, idx) => ({
        os: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        fill: colors[idx % colors.length],
      }));
    }

    if (resolutionResponse.rows) {
      result.screenResolutions = resolutionResponse.rows.map((row) => ({
        resolution: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
      }));
    }

    if (languageResponse.rows) {
      result.languages = languageResponse.rows.map((row) => ({
        language: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
      }));
    }

    res.json(result);
  } catch (error) {
    console.error('GA Demographics Error:', error.message);
    res.json(getMockDemographics());
  }
});

// Mock data functions
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

function getMockMonthly() {
  return [
    { month: 'Oct 25', activeUsers: 530, pageViews: 778, events: 5135, sessions: 612 },
    { month: 'Nov 25', activeUsers: 1600, pageViews: 2600, events: 10834, sessions: 1890 },
    { month: 'Dec 25', activeUsers: 475, pageViews: 1751, events: 6501, sessions: 892 },
    { month: 'Jan 26', activeUsers: 393, pageViews: 1828, events: 5712, sessions: 1127 },
  ];
}

function getMockCountries() {
  return [
    { country: 'United States', users: 845, fill: '#13636f' },
    { country: 'China', users: 523, fill: '#1a7a88' },
    { country: 'United Kingdom', users: 312, fill: '#2596a8' },
    { country: 'Pakistan', users: 287, fill: '#3ab0c4' },
    { country: 'Singapore', users: 198, fill: '#5cc4d4' },
    { country: 'United Arab Emirates', users: 156, fill: '#7dd3e0' },
    { country: 'Germany', users: 134, fill: '#a0e2eb' },
    { country: 'Canada', users: 98, fill: '#c3f0f5' },
  ];
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

function getMockDevices() {
  return [
    { device: 'desktop', users: 1876, fill: '#13636f' },
    { device: 'mobile', users: 987, fill: '#3ab0c4' },
    { device: 'tablet', users: 135, fill: '#d4af37' },
  ];
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

function getMockEvents() {
  return [
    { eventName: 'page_view', count: 5000 },
    { eventName: 'scroll', count: 3500 },
    { eventName: 'click', count: 2800 },
    { eventName: 'form_submit', count: 150 },
    { eventName: 'session_start', count: 1200 },
  ];
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

function getMockDemographics() {
  return {
    browsers: [
      { browser: 'Chrome', users: 1245, fill: '#13636f' },
      { browser: 'Safari', users: 567, fill: '#1a7a88' },
      { browser: 'Firefox', users: 234, fill: '#3ab0c4' },
      { browser: 'Edge', users: 189, fill: '#5cc4d4' },
      { browser: 'Opera', users: 45, fill: '#7dd3e0' },
    ],
    operatingSystems: [
      { os: 'Windows', users: 890, fill: '#13636f' },
      { os: 'macOS', users: 654, fill: '#1a7a88' },
      { os: 'iOS', users: 432, fill: '#3ab0c4' },
      { os: 'Android', users: 287, fill: '#5cc4d4' },
      { os: 'Linux', users: 67, fill: '#7dd3e0' },
    ],
    screenResolutions: [
      { resolution: '1920x1080', users: 567 },
      { resolution: '1366x768', users: 432 },
      { resolution: '1536x864', users: 321 },
      { resolution: '2560x1440', users: 234 },
      { resolution: '1440x900', users: 156 },
    ],
    languages: [
      { language: 'en-us', users: 890 },
      { language: 'en-gb', users: 234 },
      { language: 'zh-cn', users: 189 },
      { language: 'es', users: 134 },
      { language: 'de', users: 87 },
    ],
  };
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', gaConnected: !!analyticsClient });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!analyticsClient) {
    console.log('\n=== SETUP REQUIRED ===');
    console.log('To enable live GA data:');
    console.log('1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts');
    console.log('2. Create a Service Account');
    console.log('3. Download the JSON key and save as: ga-credentials.json');
    console.log('4. Add the service account email to your GA property with Viewer access');
    console.log('========================\n');
  }
});
