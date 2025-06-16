'use client';

import { 
  MessageSquare, 
  FolderOpen, 
  Search, 
  GitBranch, 
  Image as ImageIcon, 
  Settings as SettingsIcon,
  LayoutGrid // Placeholder for a "Dashboard" or "Home" icon
} from 'lucide-react';
import { useState } from 'react';

export type ActiveView = 'chat' | 'explorer' | 'search' | 'branches' | 'imageTools' | 'settings' | 'dashboard';

interface ActivityBarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

const activityItems = [
  { id: 'dashboard' as ActiveView, icon: LayoutGrid, label: 'Dashboard' },
  { id: 'chat' as ActiveView, icon: MessageSquare, label: 'Chat' },
  { id: 'explorer' as ActiveView, icon: FolderOpen, label: 'Explorer' },
  { id: 'search' as ActiveView, icon: Search, label: 'Search' },
  { id: 'branches' as ActiveView, icon: GitBranch, label: 'Branches' },
  { id: 'imageTools' as ActiveView, icon: ImageIcon, label: 'Image Tools' },
  { id: 'settings' as ActiveView, icon: SettingsIcon, label: 'Settings' },
];

export default function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <div className="h-full w-16 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 space-y-3">
      {/* Logo or App Icon */}
      <div className="mb-4">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          C
        </div>
      </div>

      {activityItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={item.label}
            className={`
              w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200
              hover:bg-gray-700 group relative
              ${isActive ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'text-gray-400 hover:text-white'}
            `}
          >
            <Icon size={22} />
            <span
              className="absolute left-full ml-3 px-2 py-1 bg-gray-800 text-white text-xs rounded-md shadow-lg 
                         opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none
                         whitespace-nowrap z-50"
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
