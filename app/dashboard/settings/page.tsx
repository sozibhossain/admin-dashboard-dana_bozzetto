'use client';

import { useEffect, useState } from 'react';
import { Building2, Lock, Bell } from 'lucide-react';
import CompanyProfile from '@/components/dashboard/settings/company-profile';
import SecuritySettings from '@/components/dashboard/settings/security-settings';
import NotificationSettings from '@/components/dashboard/settings/notification-settings';

type SettingTab = 'profile' | 'security' | 'notifications';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>('notifications');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'profile' || tab === 'security' || tab === 'notifications') {
      setActiveTab(tab);
    }
  }, []);

  const navItems = [
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold text-white mb-2">Settings</h1>
        <p className="text-slate-300/80 text-lg">Manage your Application Settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingTab)}
              className={`w-full text-left px-5 py-3.5 rounded-xl transition-all flex items-center gap-4 border ${
                activeTab === item.id
                  ? 'bg-[#007074] text-white border-transparent shadow-lg shadow-teal-900/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10 backdrop-blur-md'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 min-h-[600px]">
          {activeTab === 'profile' && <CompanyProfile />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}
