import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Area, LabelList } from 'recharts';

// Backend API URL - auto-detect local vs deployed
const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';

// Google Sheets config for Socials & Emails
const SPREADSHEET_ID = '1FpAsnmjFK60DZ5NHlwaRTXo0LNH1EgI7_NjKsdw-FOs';
const MAIN_SHEET_GID = '707588878';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${MAIN_SHEET_GID}`;
const EMAILS_SHEET_GID = '1842333950';
const EMAILS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${EMAILS_SHEET_GID}`;

// Menu items configuration
const MENU_ITEMS = {
  analytics: [
    { id: 'overview', label: 'Traffic Overview', icon: 'grid' },
    { id: 'sources', label: 'Traffic Sources', icon: 'link' },
    { id: 'website', label: 'Activity Stats', icon: 'chart' },
    { id: 'events', label: 'Custom Events', icon: 'zap' },
    { id: 'demographics', label: 'Demographics', icon: 'users' },
    { id: 'countries', label: 'Countries', icon: 'globe' },
  ],
  socials: [
    { id: 'social-overview', label: 'Social Overview', icon: 'share' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
    { id: 'x', label: 'X (Twitter)', icon: 'x' },
  ],
  emails: [
    { id: 'email', label: 'Email Campaigns', icon: 'mail' },
  ],
};

const CiretaDashboard = () => {
  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [gaConnected, setGaConnected] = useState(false);

  // Project name
  const projectName = 'Cireta Website';

  // Date filter state
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // GA Data states
  const [gaOverview, setGaOverview] = useState(null);
  const [gaMonthlyData, setGaMonthlyData] = useState([]);
  const [gaCountryData, setGaCountryData] = useState([]);
  const [gaCityData, setGaCityData] = useState([]);
  const [gaDeviceData, setGaDeviceData] = useState([]);
  const [gaPageData, setGaPageData] = useState([]);
  const [gaEventData, setGaEventData] = useState([]);
  const [gaSourceData, setGaSourceData] = useState({ channels: [], sources: [], mediums: [] });

  // Sheets Data states (for Socials & Emails)
  const [coldEmailData, setColdEmailData] = useState([]);
  const [linkedInData, setLinkedInData] = useState([]);
  const [personalizedOutreach, setPersonalizedOutreach] = useState([]);
  const [xData, setXData] = useState([]);

  // Parse CSV helper
  const parseCSV = (csv) => {
    const lines = csv.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      result.push(values);
    }
    return result;
  };

  const parseNum = (str) => {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
  };

  // Fetch GA Data from backend
  const fetchGAData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;

      // Fetch all GA data in parallel
      const [overviewRes, monthlyRes, countriesRes, citiesRes, devicesRes, pagesRes, eventsRes, sourcesRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/ga/overview${params}`),
        fetch(`${API_BASE}/ga/monthly${params}`),
        fetch(`${API_BASE}/ga/countries${params}`),
        fetch(`${API_BASE}/ga/cities${params}`),
        fetch(`${API_BASE}/ga/devices${params}`),
        fetch(`${API_BASE}/ga/pages${params}`),
        fetch(`${API_BASE}/ga/events${params}`),
        fetch(`${API_BASE}/ga/sources${params}`),
        fetch(`${API_BASE}/health`),
      ]);

      const [overview, monthly, countries, cities, devices, pages, events, sources, health] = await Promise.all([
        overviewRes.json(),
        monthlyRes.json(),
        countriesRes.json(),
        citiesRes.json(),
        devicesRes.json(),
        pagesRes.json(),
        eventsRes.json(),
        sourcesRes.json(),
        healthRes.json(),
      ]);

      setGaOverview(overview);
      setGaMonthlyData(monthly);
      setGaCountryData(countries);
      setGaCityData(cities);
      setGaDeviceData(devices);
      setGaPageData(pages);
      setGaEventData(events);
      setGaSourceData(sources);
      setGaConnected(health.gaConnected);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching GA data:', err);
      setError('Backend server not running. Start it with: node server.js');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Fetch Sheets data for Socials & Emails
  const fetchSheetsData = useCallback(async () => {
    try {
      const [mainResponse, emailsResponse] = await Promise.all([
        fetch(SHEET_URL),
        fetch(EMAILS_SHEET_URL),
      ]);

      if (!mainResponse.ok) throw new Error('Failed to fetch sheets data');

      const csv = await mainResponse.text();
      const rows = parseCSV(csv);

      // Parse Emails sheet
      let emailOutreachData = [];
      if (emailsResponse.ok) {
        const emailsCsv = await emailsResponse.text();
        const emailRows = parseCSV(emailsCsv);
        for (let i = 1; i < emailRows.length; i++) {
          const row = emailRows[i];
          const company = (row[0] || '').trim();
          const project = (row[1] || '').trim();
          const emails = parseNum(row[2]);
          const replies = parseNum(row[3]);
          const status = (row[4] || '').trim();
          if (company && company.length > 2 && !company.toLowerCase().includes('total')) {
            emailOutreachData.push({ company, project, emails, replies, status });
          }
        }
      }

      // Find section indices
      let coldEmailStartIdx = -1;
      let linkedInStartIdx = -1;
      let xAnalyticsStartIdx = -1;

      rows.forEach((row, idx) => {
        const firstCell = (row[0] || '').toLowerCase();
        if (firstCell.includes('cold emails') || firstCell.includes('cold email')) {
          coldEmailStartIdx = idx;
        }
        if (firstCell.includes('linkedin') || (row[1] || '').toLowerCase().includes('content')) {
          linkedInStartIdx = idx;
        }
        if (firstCell.includes('x analytics') || firstCell.includes('twitter') ||
            ((row[1] || '').toLowerCase() === 'impressions' && (row[2] || '').toLowerCase().includes('engagement'))) {
          xAnalyticsStartIdx = idx;
        }
      });

      // Parse Cold Email Data
      const coldRows = [];
      if (coldEmailStartIdx >= 0) {
        for (let i = coldEmailStartIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0] || row[0].toLowerCase().includes('personalised') || row[0].toLowerCase().includes('linkedin')) break;
          const campaign = row[1] || row[0];
          const sent = parseNum(row[2] || row[3]);
          const replies = parseNum(row[3] || row[4]);
          if (sent > 0) {
            coldRows.push({
              campaign: campaign.substring(0, 25),
              sent,
              replies,
              rate: sent > 0 ? (replies / sent * 100).toFixed(2) : 0,
            });
          }
        }
      }

      // Parse LinkedIn Data
      const linkedInRows = [];
      if (linkedInStartIdx >= 0) {
        for (let i = linkedInStartIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if ((row[1] || '').toLowerCase() === 'impressions' && (row[2] || '').toLowerCase().includes('engagement')) break;
          if (!row[0] || row[0].trim() === '') continue;
          const month = row[0];
          if (month && month.match(/\w+\s+\d+/)) {
            linkedInRows.push({
              month: month.replace(/\s+\d{4}$/, '').replace('ber', '').replace('ember', '').substring(0, 3) + ' ' + (month.match(/\d+/) || ['25'])[0],
              impressions: parseNum(row[1]),
              engagementRate: '0%',
              pageViews: parseNum(row[2]),
              followers: parseNum(row[3]) || 630,
            });
          }
        }
      }

      // Parse X Analytics Data
      const xRows = [];
      if (xAnalyticsStartIdx >= 0) {
        for (let i = xAnalyticsStartIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0] || row[0].trim() === '') continue;
          const month = row[0];
          if (month && month.match(/\w+\s+\d+/)) {
            const engagementStr = row[2] || '0%';
            const engagementRate = parseFloat(engagementStr.replace('%', '')) || 0;
            xRows.push({
              month: month.replace(/\s+\d{4}$/, '').replace('ber', '').replace('ember', '').substring(0, 3) + ' ' + (month.match(/\d+/) || ['25'])[0],
              impressions: parseNum(row[1]),
              engagementRate,
              likes: parseNum(row[3]),
              replies: parseNum(row[4]),
              retweets: parseNum(row[5]),
              reposts: parseNum(row[7]),
              shares: parseNum(row[8]),
            });
          }
        }
      }

      setColdEmailData(coldRows.length > 0 ? coldRows : getDefaultColdEmailData());
      setPersonalizedOutreach(emailOutreachData.length > 0 ? emailOutreachData : getDefaultOutreachData());
      setLinkedInData(linkedInRows.length > 0 ? linkedInRows : getDefaultLinkedInData());
      setXData(xRows.length > 0 ? xRows : getDefaultXData());
    } catch (err) {
      console.error('Error fetching sheets data:', err);
      setColdEmailData(getDefaultColdEmailData());
      setPersonalizedOutreach(getDefaultOutreachData());
      setLinkedInData(getDefaultLinkedInData());
      setXData(getDefaultXData());
    }
  }, []);

  // Default data fallbacks
  const getDefaultColdEmailData = () => [
    { campaign: 'Commodity Brokers', sent: 9997, replies: 2, rate: 0.02 },
    { campaign: 'LinkedIn Leads', sent: 254, replies: 0, rate: 0 },
  ];

  const getDefaultOutreachData = () => [
    { company: 'Deepwater MGT', project: 'Green Bitcoin Mining', emails: 7, replies: 0, status: 'Sent' },
    { company: 'Pantera Capital', project: 'Green Bitcoin Mining', emails: 14, replies: 0, status: 'Sent' },
    { company: 'Abu Dhabi Dev Holding', project: 'Copper Cathode', emails: 0, replies: 0, status: 'Drafted' },
    { company: 'Temasek', project: 'Copper Cathode', emails: 4, replies: 0, status: 'Sent' },
  ];

  const getDefaultLinkedInData = () => [
    { month: 'Sep 25', impressions: 2213, pageViews: 67, followers: 630 },
    { month: 'Oct 25', impressions: 23352, pageViews: 245, followers: 630 },
    { month: 'Nov 25', impressions: 5156, pageViews: 190, followers: 630 },
    { month: 'Dec 25', impressions: 12429, pageViews: 233, followers: 630 },
  ];

  const getDefaultXData = () => [
    { month: 'Sep 25', impressions: 2213, engagementRate: 7.7, likes: 171, replies: 15, retweets: 32, reposts: 11, shares: 8 },
    { month: 'Oct 25', impressions: 23352, engagementRate: 3.1, likes: 746, replies: 9, retweets: 76, reposts: 140, shares: 19 },
    { month: 'Nov 25', impressions: 5156, engagementRate: 16.6, likes: 860, replies: 73, retweets: 232, reposts: 58, shares: 95 },
    { month: 'Dec 25', impressions: 12429, engagementRate: 6.2, likes: 772, replies: 26, retweets: 128, reposts: 210, shares: 11 },
  ];

  // Fetch data on mount and when date changes
  useEffect(() => {
    fetchGAData();
    fetchSheetsData();
  }, []);

  useEffect(() => {
    fetchGAData();
  }, [dateRange, fetchGAData]);

  // Refresh all data
  const handleRefresh = () => {
    fetchGAData();
    fetchSheetsData();
  };

  // Handle tab change with scroll to top
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate totals
  const totalLinkedInImpressions = linkedInData.reduce((sum, d) => sum + d.impressions, 0);
  const totalXImpressions = xData.reduce((sum, d) => sum + d.impressions, 0);
  const totalEmails = coldEmailData.reduce((sum, d) => sum + d.sent, 0);

  // Icon components
  const Icon = ({ name, className = "w-5 h-5" }) => {
    const icons = {
      grid: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
      chart: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      users: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
      globe: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      share: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
      linkedin: <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
      x: <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      mail: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      zap: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      refresh: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      calendar: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      menu: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
      chevronLeft: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
      link: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    };
    return icons[name] || null;
  };

  const tooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #13636f',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(19, 99, 111, 0.15)',
    color: '#0C0C0C',
  };

  const StatCard = ({ title, value, subtitle, trend, accent }) => (
    <div className="rounded-xl p-5 shadow-sm border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white border-gray-100 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-20 h-20 transform translate-x-8 -translate-y-8 rounded-full opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: accent || '#13636f' }}></div>
      <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
      <p className="text-2xl font-bold mt-2 bg-gradient-to-r from-[#13636f] to-[#3ab0c4] bg-clip-text text-transparent">{value}</p>
      {subtitle && <p className="text-xs mt-2 text-gray-400 truncate">{subtitle}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-2 font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          <span className={`inline-block transform ${trend >= 0 ? 'rotate-0' : 'rotate-180'}`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </span>
          {Math.abs(trend).toFixed(1)}%
        </p>
      )}
    </div>
  );

  // Main dashboard (no login required)
  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-40 shadow-sm`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && (
            <img src="/cireta-logo.svg" alt="Cireta" className="h-8" />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <Icon name={sidebarCollapsed ? "menu" : "chevronLeft"} className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Analytics Section */}
          <div className="mb-6">
            {!sidebarCollapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Analytics</p>
            )}
            {MENU_ITEMS.analytics.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                  activeTab === item.id
                    ? 'bg-[#13636f] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#13636f]'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Socials Section */}
          <div className="mb-6">
            {!sidebarCollapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Socials</p>
            )}
            {MENU_ITEMS.socials.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                  activeTab === item.id
                    ? 'bg-[#13636f] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#13636f]'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Emails Section */}
          <div className="mb-6">
            {!sidebarCollapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emails</p>
            )}
            {MENU_ITEMS.emails.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                  activeTab === item.id
                    ? 'bg-[#13636f] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#13636f]'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* GA Connection Status */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${gaConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            {!sidebarCollapsed && (
              <span className={`text-sm ${gaConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {gaConnected ? 'GA Connected' : 'Using Cache'}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Left: Date Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</span>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#13636f]/20 focus:border-[#13636f] transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#13636f]/20 focus:border-[#13636f] transition-all"
                />
              </div>
            </div>

            {/* Center: Logo */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              <svg className="w-8 h-8 text-[#13636f]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-xl font-bold text-[#13636f]">cireta</span>
            </div>

            {/* Right: Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#13636f] text-white rounded-lg font-medium hover:bg-[#1a7a88] transition-all disabled:opacity-50 shadow-sm"
            >
              <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && !gaOverview && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[#13636f] rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading analytics data...</p>
              </div>
            </div>
          )}

          {/* Traffic Overview Tab */}
          {activeTab === 'overview' && gaOverview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard title="Active Users" value={gaOverview.activeUsers.toLocaleString()} subtitle="Total unique users" />
                <StatCard title="New Users" value={gaOverview.newUsers.toLocaleString()} subtitle="First-time visitors" />
                <StatCard title="Page Views" value={gaOverview.pageViews.toLocaleString()} subtitle="Total views" />
                <StatCard title="Events" value={gaOverview.events.toLocaleString()} subtitle="Total events" />
                <StatCard title="Sessions" value={gaOverview.sessions.toLocaleString()} subtitle="Total sessions" />
                <StatCard title="Session Duration" value={`${Math.floor(gaOverview.avgSessionDuration / 60)}m ${Math.round(gaOverview.avgSessionDuration % 60)}s`} subtitle="Average duration" />
                <StatCard title="Bounce Rate" value={`${gaOverview.bounceRate.toFixed(1)}%`} subtitle="Single-page sessions" />
              </div>

              {/* Monthly Trend Chart */}
              <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                  Traffic Trend
                </h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={gaMonthlyData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#13636f" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#13636f" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3ab0c4" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#3ab0c4" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="sessionsLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#d4af37" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#f0d78c" stopOpacity={1}/>
                        </linearGradient>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#d4af37" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#1f2937', fontSize: 13, fontWeight: 600 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(19, 99, 111, 0.05)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600 }} />
                      <Bar yAxisId="left" dataKey="activeUsers" name="Users" fill="url(#usersGradient)" radius={[6, 6, 0, 0]} animationDuration={1200} animationBegin={0} animationEasing="ease-out">
                        <LabelList dataKey="activeUsers" position="top" fill="#13636f" fontSize={12} fontWeight="700" formatter={(v) => v.toLocaleString()} />
                      </Bar>
                      <Bar yAxisId="left" dataKey="pageViews" name="Page Views" fill="url(#viewsGradient)" radius={[6, 6, 0, 0]} animationDuration={1400} animationBegin={200} animationEasing="ease-out" />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="sessions"
                        name="Sessions"
                        stroke="#d4af37"
                        strokeWidth={4}
                        dot={{ fill: '#d4af37', r: 6, strokeWidth: 3, stroke: '#fff', filter: 'url(#shadow)' }}
                        activeDot={{ r: 9, fill: '#d4af37', stroke: '#fff', strokeWidth: 3 }}
                        animationDuration={2000}
                        animationBegin={400}
                        animationEasing="ease-out"
                        isAnimationActive={true}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Countries & Devices */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Top Countries
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gaCountryData.slice(0, 5)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="users"
                          label={({ country, percent }) => `${country}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#6b7280', strokeWidth: 2 }}
                          animationDuration={1500}
                          animationBegin={0}
                          animationEasing="ease-out"
                        >
                          {gaCountryData.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={3} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value, name, props) => [`${value.toLocaleString()} users`, props.payload.country]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#3ab0c4] to-[#d4af37] rounded-full"></span>
                    Device Categories
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gaDeviceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="users"
                          label={({ device, percent }) => `${device}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#6b7280', strokeWidth: 2 }}
                          animationDuration={1500}
                          animationBegin={300}
                          animationEasing="ease-out"
                        >
                          {gaDeviceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={3} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value, name, props) => [`${value.toLocaleString()} users`, props.payload.device]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Sources Tab */}
          {activeTab === 'sources' && gaSourceData && (
            <div className="space-y-6">
              {/* Channel Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {gaSourceData.channels.slice(0, 6).map((channel, idx) => (
                  <div key={idx} className="rounded-xl p-4 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.fill }}></div>
                      <p className="text-xs font-medium text-gray-500 truncate">{channel.channel}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{channel.users.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">users</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Distribution Pie Chart */}
                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Traffic by Channel
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={gaSourceData.channels}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="users"
                        nameKey="channel"
                        animationDuration={1500}
                        animationEasing="ease-out"
                      >
                        {gaSourceData.channels.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="channel" position="outside" fill="#374151" fontSize={11} fontWeight="600" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        formatter={(value) => [value.toLocaleString(), 'Users']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Channel Bar Chart */}
                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Users vs Sessions by Channel
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gaSourceData.channels} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                      <YAxis dataKey="channel" type="category" width={100} tick={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        formatter={(value) => value.toLocaleString()}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                      <Bar dataKey="users" name="Users" fill="#13636f" radius={[0, 4, 4, 0]} animationDuration={1200} animationEasing="ease-out" />
                      <Bar dataKey="sessions" name="Sessions" fill="#3ab0c4" radius={[0, 4, 4, 0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Sources Table */}
                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Top Sources
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-500 text-sm">Source</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-500 text-sm">Users</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-500 text-sm">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gaSourceData.sources.map((source, idx) => {
                          const maxUsers = Math.max(...gaSourceData.sources.map(s => s.users));
                          const percentage = (source.users / maxUsers) * 100;
                          return (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-full max-w-[120px]">
                                    <div className="absolute inset-0 bg-[#13636f]/10 rounded" style={{ width: `${percentage}%` }}></div>
                                    <span className="relative font-medium text-gray-800 text-sm">{source.source}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-[#13636f]">{source.users.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-gray-600">{source.sessions.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Mediums Table */}
                <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Traffic by Medium
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-500 text-sm">Medium</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-500 text-sm">Users</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-500 text-sm">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gaSourceData.mediums.map((medium, idx) => {
                          const maxUsers = Math.max(...gaSourceData.mediums.map(m => m.users));
                          const percentage = (medium.users / maxUsers) * 100;
                          return (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-full max-w-[120px]">
                                    <div className="absolute inset-0 bg-[#3ab0c4]/10 rounded" style={{ width: `${percentage}%` }}></div>
                                    <span className="relative font-medium text-gray-800 text-sm">{medium.medium}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-[#3ab0c4]">{medium.users.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-gray-600">{medium.sessions.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Stats (Website) Tab */}
          {activeTab === 'website' && gaOverview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Active Users" value={gaOverview.activeUsers.toLocaleString()} />
                <StatCard title="Page Views" value={gaOverview.pageViews.toLocaleString()} />
                <StatCard title="Events" value={gaOverview.events.toLocaleString()} />
                <StatCard title="Avg Session" value={`${Math.round(gaOverview.avgSessionDuration)}s`} />
              </div>

              <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                  Monthly Activity
                </h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gaMonthlyData} barCategoryGap="20%" margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="activityUsersGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#13636f" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#13636f" stopOpacity={0.7}/>
                        </linearGradient>
                        <linearGradient id="activityViewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3ab0c4" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#3ab0c4" stopOpacity={0.7}/>
                        </linearGradient>
                        <linearGradient id="activityEventsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d4af37" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#d4af37" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#1f2937', fontSize: 13, fontWeight: 600 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                      <YAxis tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(19, 99, 111, 0.05)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600 }} />
                      <Bar dataKey="activeUsers" name="Users" fill="url(#activityUsersGradient)" radius={[6, 6, 0, 0]} animationDuration={1200} animationBegin={0} animationEasing="ease-out">
                        <LabelList dataKey="activeUsers" position="top" fill="#13636f" fontSize={12} fontWeight="700" formatter={(v) => v.toLocaleString()} />
                      </Bar>
                      <Bar dataKey="pageViews" name="Views" fill="url(#activityViewsGradient)" radius={[6, 6, 0, 0]} animationDuration={1400} animationBegin={200} animationEasing="ease-out" />
                      <Bar dataKey="events" name="Events" fill="url(#activityEventsGradient)" radius={[6, 6, 0, 0]} animationDuration={1600} animationBegin={400} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Pages */}
              <div className="rounded-xl p-6 shadow-lg border bg-white border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#3ab0c4] to-[#13636f] rounded-full"></span>
                  Top Pages
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#13636f] bg-gradient-to-r from-[#13636f]/5 to-transparent">
                        <th className="text-left py-4 px-4 font-semibold text-[#13636f]">Page</th>
                        <th className="text-right py-4 px-4 font-medium text-gray-500">Views</th>
                        <th className="text-right py-4 px-4 font-medium text-gray-500">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaPageData.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-[#13636f]/5 hover:to-transparent transition-all duration-200">
                          <td className="py-4 px-4 text-gray-800 font-medium truncate max-w-xs">{row.page}</td>
                          <td className="text-right py-4 px-4 text-[#13636f] font-semibold">{row.views.toLocaleString()}</td>
                          <td className="text-right py-4 px-4 text-gray-600">{row.users.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Custom Events Tab */}
          {activeTab === 'events' && gaEventData.length > 0 && (
            <div className="space-y-6">
              {/* Events Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Events"
                  value={gaEventData.reduce((sum, e) => sum + e.count, 0).toLocaleString()}
                  subtitle="All tracked events"
                />
                <StatCard
                  title="Unique Event Types"
                  value={gaEventData.length.toString()}
                  subtitle="Different event names"
                />
                <StatCard
                  title="Top Event"
                  value={gaEventData[0]?.eventName || '-'}
                  subtitle={`${(gaEventData[0]?.count || 0).toLocaleString()} occurrences`}
                />
                <StatCard
                  title="Custom Events"
                  value={gaEventData.filter(e => e.eventName.includes('_')).length.toString()}
                  subtitle="User-defined events"
                />
              </div>

              {/* Categorized Events */}
              {(() => {
                // Categorize events
                const categories = {
                  'HomePage': { color: '#13636f', gradient: 'from-[#13636f] to-[#1a8a9a]', icon: '🏠', events: [] },
                  'Menu': { color: '#3ab0c4', gradient: 'from-[#3ab0c4] to-[#5cc9db]', icon: '📋', events: [] },
                  'Footer': { color: '#0077b5', gradient: 'from-[#0077b5] to-[#0099e5]', icon: '📎', events: [] },
                  'Form': { color: '#22c55e', gradient: 'from-[#22c55e] to-[#4ade80]', icon: '📝', events: [] },
                  'RWA': { color: '#d4af37', gradient: 'from-[#d4af37] to-[#f0d78c]', icon: '💎', events: [] },
                  'Priority/Register': { color: '#8b5cf6', gradient: 'from-[#8b5cf6] to-[#a78bfa]', icon: '⭐', events: [] },
                  'System': { color: '#6b7280', gradient: 'from-[#6b7280] to-[#9ca3af]', icon: '⚙️', events: [] },
                };

                gaEventData.forEach(event => {
                  const name = event.eventName;
                  if (name.startsWith('HomePage_')) {
                    categories['HomePage'].events.push(event);
                  } else if (name.startsWith('Menu_')) {
                    categories['Menu'].events.push(event);
                  } else if (name.startsWith('Footer_')) {
                    categories['Footer'].events.push(event);
                  } else if (name.startsWith('Form_')) {
                    categories['Form'].events.push(event);
                  } else if (name.startsWith('RWA_')) {
                    categories['RWA'].events.push(event);
                  } else if (name.startsWith('PriorityList_') || name.startsWith('Register_')) {
                    categories['Priority/Register'].events.push(event);
                  } else {
                    categories['System'].events.push(event);
                  }
                });

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Object.entries(categories).filter(([_, cat]) => cat.events.length > 0).map(([catName, cat]) => {
                      const totalCount = cat.events.reduce((sum, e) => sum + e.count, 0);
                      const maxCount = Math.max(...cat.events.map(e => e.count));
                      return (
                        <div key={catName} className="rounded-xl overflow-hidden shadow-lg border border-gray-100 bg-white hover:shadow-xl transition-all duration-300">
                          {/* Header with gradient */}
                          <div className={`bg-gradient-to-r ${cat.gradient} px-5 py-4`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{cat.icon}</span>
                                <div>
                                  <h3 className="text-white font-bold text-lg">{catName}</h3>
                                  <p className="text-white/80 text-xs">{cat.events.length} event types</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-bold text-xl">{totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1)}k` : totalCount}</p>
                                <p className="text-white/80 text-xs">total</p>
                              </div>
                            </div>
                          </div>
                          {/* Event list */}
                          <div className="p-4 space-y-2">
                            {cat.events.slice(0, 5).map((event, idx) => {
                              const percentage = (event.count / maxCount) * 100;
                              return (
                                <div key={idx} className="group relative">
                                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all relative overflow-hidden">
                                    {/* Progress bar background */}
                                    <div
                                      className="absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500"
                                      style={{
                                        width: `${percentage}%`,
                                        backgroundColor: cat.color,
                                      }}
                                    ></div>
                                    <span className="text-sm font-medium text-gray-700 relative z-10 truncate max-w-[150px]">
                                      {event.eventName.replace(`${catName}_`, '').replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-sm font-bold relative z-10" style={{ color: cat.color }}>
                                      {event.count.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {cat.events.length > 5 && (
                              <p className="text-xs text-gray-400 text-center pt-2">+{cat.events.length - 5} more events</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Top Events Chart */}
              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                  Top 15 Events
                </h3>
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gaEventData.slice(0, 15)} layout="vertical" margin={{ top: 10, right: 80, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="eventGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#13636f" />
                          <stop offset="100%" stopColor="#3ab0c4" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                      <XAxis type="number" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => v.toLocaleString()} />
                      <YAxis
                        dataKey="eventName"
                        type="category"
                        tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 600 }}
                        width={160}
                        tickFormatter={(v) => v.length > 22 ? v.substring(0, 20) + '...' : v}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [value.toLocaleString(), 'Count']}
                        labelFormatter={(label) => `Event: ${label}`}
                      />
                      <Bar
                        dataKey="count"
                        name="Event Count"
                        fill="url(#eventGradient)"
                        radius={[0, 6, 6, 0]}
                        animationDuration={1500}
                        animationBegin={0}
                        animationEasing="ease-out"
                      >
                        <LabelList
                          dataKey="count"
                          position="right"
                          fill="#13636f"
                          fontSize={12}
                          fontWeight={700}
                          formatter={(v) => v.toLocaleString()}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* All Events Table */}
              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">All Tracked Events</h3>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b-2 border-[#13636f]">
                        <th className="text-left py-3 px-4 font-semibold text-[#13636f]">#</th>
                        <th className="text-left py-3 px-4 font-semibold text-[#13636f]">Event Name</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500">Count</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaEventData.map((event, idx) => {
                        const totalEvents = gaEventData.reduce((sum, e) => sum + e.count, 0);
                        const percentage = ((event.count / totalEvents) * 100).toFixed(1);
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-gray-400 text-sm">{idx + 1}</td>
                            <td className="py-3 px-4 font-medium text-gray-800">{event.eventName}</td>
                            <td className="text-right py-3 px-4 text-[#13636f] font-bold">{event.count.toLocaleString()}</td>
                            <td className="text-right py-3 px-4 text-gray-500">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Demographics Tab */}
          {activeTab === 'demographics' && gaDeviceData.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Device Distribution
                  </h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gaDeviceData}
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          innerRadius={50}
                          paddingAngle={4}
                          dataKey="users"
                          label={({ device, percent }) => `${device}: ${(percent * 100).toFixed(1)}%`}
                          labelLine={{ stroke: '#6b7280', strokeWidth: 2 }}
                          animationDuration={1500}
                          animationBegin={0}
                          animationEasing="ease-out"
                        >
                          {gaDeviceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={3} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontWeight: 600 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#3ab0c4] to-[#d4af37] rounded-full"></span>
                    Device Stats
                  </h3>
                  <div className="space-y-4">
                    {gaDeviceData.map((device, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all hover:scale-[1.02]">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: device.fill }}></div>
                          <span className="font-semibold text-gray-800 capitalize">{device.device}</span>
                        </div>
                        <span className="text-xl font-bold text-[#13636f]">{device.users.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Countries Tab */}
          {activeTab === 'countries' && gaCountryData.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#13636f] to-[#3ab0c4] rounded-full"></span>
                    Top Countries
                  </h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gaCountryData} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="countryGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#13636f" />
                            <stop offset="100%" stopColor="#1a8a9a" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => v.toLocaleString()} />
                        <YAxis dataKey="country" type="category" tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 600 }} width={110} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="users" name="Users" fill="url(#countryGradient)" radius={[0, 6, 6, 0]} animationDuration={1500} animationBegin={0} animationEasing="ease-out">
                          <LabelList dataKey="users" position="right" fill="#13636f" fontSize={12} fontWeight={700} formatter={(v) => v.toLocaleString()} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#3ab0c4] to-[#d4af37] rounded-full"></span>
                    Top Cities
                  </h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gaCityData} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="cityGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3ab0c4" />
                            <stop offset="100%" stopColor="#5cc9db" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => v.toLocaleString()} />
                        <YAxis dataKey="city" type="category" tick={{ fill: '#1f2937', fontSize: 12, fontWeight: 600 }} width={110} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="users" name="Users" fill="url(#cityGradient)" radius={[0, 6, 6, 0]} animationDuration={1500} animationBegin={200} animationEasing="ease-out">
                          <LabelList dataKey="users" position="right" fill="#3ab0c4" fontSize={12} fontWeight={700} formatter={(v) => v.toLocaleString()} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Social Overview Tab */}
          {activeTab === 'social-overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="LinkedIn Impressions" value={totalLinkedInImpressions.toLocaleString()} subtitle="Total reach" />
                <StatCard title="X Impressions" value={totalXImpressions.toLocaleString()} subtitle="Twitter reach" />
                <StatCard title="LinkedIn Followers" value={(linkedInData[linkedInData.length - 1]?.followers || 630).toLocaleString()} />
                <StatCard title="Avg X Engagement" value={`${(xData.reduce((sum, d) => sum + d.engagementRate, 0) / xData.length || 0).toFixed(1)}%`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">LinkedIn Performance</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={linkedInData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="impressions" name="Impressions" stroke="#0077b5" strokeWidth={2} dot={{ fill: '#0077b5', r: 4 }} />
                        <Line type="monotone" dataKey="pageViews" name="Page Views" stroke="#3ab0c4" strokeWidth={2} dot={{ fill: '#3ab0c4', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">X (Twitter) Performance</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={xData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 20]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#1DA1F2" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="engagementRate" name="Engagement %" stroke="#13636f" strokeWidth={2} dot={{ fill: '#13636f', r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LinkedIn Tab */}
          {activeTab === 'linkedin' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Impressions" value={totalLinkedInImpressions.toLocaleString()} />
                <StatCard title="Peak Impressions" value={Math.max(...linkedInData.map(d => d.impressions), 0).toLocaleString()} />
                <StatCard title="Total Page Views" value={linkedInData.reduce((sum, d) => sum + d.pageViews, 0).toLocaleString()} />
                <StatCard title="Followers" value={(linkedInData[linkedInData.length - 1]?.followers || 630).toLocaleString()} />
              </div>

              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">LinkedIn Engagement Over Time</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={linkedInData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="impressions" name="Impressions" fill="#0077b5" fillOpacity={0.15} stroke="#0077b5" strokeWidth={2} />
                      <Bar dataKey="pageViews" name="Page Views" fill="#3ab0c4" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="pageViews" position="top" fill="#3ab0c4" fontSize={10} />
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Monthly LinkedIn Stats</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#0077b5]">
                        <th className="text-left py-3 px-4 font-semibold text-[#0077b5]">Month</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500">Impressions</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500">Page Views</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-500">Followers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedInData.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-bold text-[#0077b5]">{row.month}</td>
                          <td className="text-right py-3 px-4 text-gray-600">{row.impressions.toLocaleString()}</td>
                          <td className="text-right py-3 px-4 text-gray-600">{row.pageViews}</td>
                          <td className="text-right py-3 px-4 text-gray-600">{row.followers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* X (Twitter) Tab */}
          {activeTab === 'x' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Impressions" value={totalXImpressions.toLocaleString()} />
                <StatCard title="Total Engagements" value={xData.reduce((sum, d) => sum + d.likes + d.replies + d.retweets + d.reposts + d.shares, 0).toLocaleString()} />
                <StatCard title="Avg Engagement Rate" value={`${(xData.reduce((sum, d) => sum + d.engagementRate, 0) / xData.length || 0).toFixed(1)}%`} />
                <StatCard title="Total Likes" value={xData.reduce((sum, d) => sum + d.likes, 0).toLocaleString()} />
              </div>

              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">X Impressions & Engagement</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={xData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 20]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#1DA1F2" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="impressions" position="top" fill="#1DA1F2" fontSize={9} formatter={(v) => v.toLocaleString()} />
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="engagementRate" name="Engagement %" stroke="#13636f" strokeWidth={2} dot={{ fill: '#13636f', r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Engagement Breakdown</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={xData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar dataKey="likes" name="Likes" fill="#13636f" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="retweets" name="Retweets" fill="#1DA1F2" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="replies" name="Replies" fill="#3ab0c4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Shares & Reposts</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={xData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fill: '#374151', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar dataKey="reposts" name="Reposts" fill="#13636f" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="shares" name="Shares" fill="#3ab0c4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Campaigns Tab */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Total Emails Sent" value={totalEmails.toLocaleString()} subtitle="All campaigns" />
                <StatCard title="Total Replies" value={coldEmailData.reduce((sum, d) => sum + d.replies, 0).toString()} subtitle="Response rate" />
                <StatCard title="Campaigns" value={coldEmailData.length.toString()} subtitle="Active campaigns" />
              </div>

              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Email Campaign Breakdown</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coldEmailData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis dataKey="campaign" type="category" tick={{ fill: '#374151', fontSize: 11 }} width={120} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="sent" name="Emails Sent" fill="#13636f" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="sent" position="right" fill="#13636f" fontSize={10} formatter={(v) => v.toLocaleString()} />
                      </Bar>
                      <Bar dataKey="replies" name="Replies" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Personalized Outreach Section */}
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-xl font-semibold mb-4 text-[#13636f]">Personalized Investor Outreach</h2>
              </div>

              {/* Status Summary */}
              {(() => {
                const sentCount = personalizedOutreach.filter(d => (d.status || '').toLowerCase().includes('sent')).length;
                const sentEmails = personalizedOutreach.filter(d => (d.status || '').toLowerCase().includes('sent')).reduce((sum, d) => sum + d.emails, 0);
                const draftedCount = personalizedOutreach.filter(d => (d.status || '').toLowerCase().includes('drafted')).length;
                const todoCount = personalizedOutreach.filter(d => (d.status || '').toLowerCase().includes('todo')).length;
                const repliedCount = personalizedOutreach.filter(d => d.replies > 0).length;

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl p-4 shadow-sm border-2 bg-amber-50 border-amber-400">
                      <p className="text-sm font-medium text-amber-800">Sent</p>
                      <p className="text-2xl font-bold mt-1 text-amber-600">{sentCount} companies</p>
                      <p className="text-xs mt-1 text-amber-700">{sentEmails} emails sent</p>
                    </div>
                    <div className="rounded-xl p-4 shadow-sm border-2 bg-sky-50 border-sky-400">
                      <p className="text-sm font-medium text-sky-800">Drafted</p>
                      <p className="text-2xl font-bold mt-1 text-sky-600">{draftedCount} companies</p>
                      <p className="text-xs mt-1 text-sky-700">Ready to send</p>
                    </div>
                    <div className="rounded-xl p-4 shadow-sm border-2 bg-gray-50 border-gray-400">
                      <p className="text-sm font-medium text-gray-600">Todo</p>
                      <p className="text-2xl font-bold mt-1 text-gray-700">{todoCount} companies</p>
                      <p className="text-xs mt-1 text-gray-500">Yet to start</p>
                    </div>
                    <div className="rounded-xl p-4 shadow-sm border-2 bg-emerald-50 border-emerald-400">
                      <p className="text-sm font-medium text-emerald-800">Replied</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-600">{repliedCount} companies</p>
                      <p className="text-xs mt-1 text-emerald-700">Responses received</p>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-xl p-6 shadow-sm border bg-white border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Detailed Outreach Status</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[#13636f]">
                        <th className="text-left py-3 px-4 font-semibold text-[#13636f]">Company</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Project</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-500">Emails</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-500">Replies</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personalizedOutreach.map((row, idx) => {
                        const statusLower = (row.status || '').toLowerCase();
                        const getStatusStyle = () => {
                          if (statusLower.includes('replied') || row.replies > 0) return { bg: '#dcfce7', color: '#166534' };
                          if (statusLower.includes('sent')) return { bg: '#fef3c7', color: '#92400e' };
                          if (statusLower.includes('drafted')) return { bg: '#e0f2fe', color: '#0369a1' };
                          return { bg: '#f3f4f6', color: '#6b7280' };
                        };
                        const statusStyle = getStatusStyle();
                        const displayStatus = row.status || (row.emails === 0 ? 'Pending' : row.replies > 0 ? 'Replied' : 'No Response');

                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-800">{row.company}</td>
                            <td className="py-3 px-4 text-gray-500">{row.project}</td>
                            <td className="text-center py-3 px-4 text-gray-600">{row.emails}</td>
                            <td className="text-center py-3 px-4" style={{ color: row.replies > 0 ? '#166534' : '#374151', fontWeight: row.replies > 0 ? 'bold' : 'normal' }}>{row.replies}</td>
                            <td className="text-center py-3 px-4">
                              <span style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                                {displayStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/cireta-logo.svg" alt="Cireta" className="h-5 opacity-70" />
              <span className="text-sm text-gray-500">Analytics Dashboard</span>
            </div>
            <div className="text-sm text-gray-500">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'Loading...'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CiretaDashboard;
