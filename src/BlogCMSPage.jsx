import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlogCMS from './BlogCMS';
import DashboardSidebar from './DashboardSidebar';

export default function BlogCMSPage() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleNavigate = (id) => {
    if (id === 'blog-cms') return;
    navigate(`/?tab=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <DashboardSidebar
        activeItem="blog-cms"
        onNavigate={handleNavigate}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
      <main className={`flex-1 ${collapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        <BlogCMS />
      </main>
    </div>
  );
}
