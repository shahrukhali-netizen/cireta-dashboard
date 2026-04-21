import Icon from './Icon';

export const MENU_ITEMS = {
  analytics: [
    { id: 'overview', label: 'Traffic Overview', icon: 'grid' },
    { id: 'website', label: 'Activity Stats', icon: 'chart' },
    { id: 'events', label: 'Custom Events', icon: 'zap' },
    { id: 'demographics', label: 'Demographics', icon: 'users' },
    { id: 'countries', label: 'Countries', icon: 'globe' },
    { id: 'sources', label: 'Traffic Sources', icon: 'link' },
  ],
  socials: [
    { id: 'social-overview', label: 'Social Overview', icon: 'share' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
    { id: 'x', label: 'X (Twitter)', icon: 'x' },
  ],
  emails: [
    { id: 'email', label: 'Email Campaigns', icon: 'mail' },
  ],
  content: [
    { id: 'blog-cms', label: 'Blog CMS', icon: 'edit' },
  ],
};

const SECTIONS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'socials', label: 'Socials' },
  { key: 'emails', label: 'Emails' },
  { key: 'content', label: 'Content' },
];

export default function DashboardSidebar({
  activeItem,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  gaConnected = false,
}) {
  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-40 shadow-sm`}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && <img src="/cireta-logo.svg" alt="Cireta" className="h-8" />}
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'menu' : 'chevronLeft'} className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {SECTIONS.map(({ key, label }) => (
          <div key={key} className="mb-6">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {label}
              </p>
            )}
            {MENU_ITEMS[key].map((item) => {
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                    isActive
                      ? 'bg-[#13636f] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-[#13636f]'
                  }`}
                >
                  <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className={`w-2 h-2 rounded-full ${gaConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          {!collapsed && (
            <span className={`text-sm ${gaConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
              {gaConnected ? 'GA Connected' : 'Using Cache'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
