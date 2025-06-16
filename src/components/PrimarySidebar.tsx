'use client';

import ProjectExplorer from '@/components/ProjectExplorer';
import BranchSelector from '@/components/BranchSelector'; // We'll likely need a more dedicated Branch UI
import Settings from '@/components/Settings';
import { ActiveView } from './ActivityBar'; // Assuming ActiveView type is exported from ActivityBar
import { useProjectStore } from '@/store/projectStore';
import { useBranchStore, Branch } from '@/store/branchStore';

interface PrimarySidebarProps {
  activeView: ActiveView;
  onFileSelect: (filePath: string) => void; // For ProjectExplorer
  // Add other necessary props as components are integrated
}

export default function PrimarySidebar({ activeView, onFileSelect }: PrimarySidebarProps) {
  const { getCurrentBranch } = useBranchStore();
  const currentBranch = getCurrentBranch();

  const renderSidebarContent = () => {
    switch (activeView) {
      case 'explorer':
        return <ProjectExplorer onFileSelect={onFileSelect} currentBranch={currentBranch} />;
      case 'branches':
        // Placeholder for a more dedicated branches UI
        // For now, we can reuse BranchSelector or create a new component
        return (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Branches</h2>
            <BranchSelector />
            {/* TODO: Add more branch management features here */}
          </div>
        );
      case 'search':
        return (
          <div className="p-4 text-gray-300">
            <h2 className="text-lg font-semibold mb-4">Global Search</h2>
            <input 
              type="text" 
              placeholder="Search across project..." 
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            {/* TODO: Implement search functionality */}
            <p className="mt-4 text-sm">Search functionality coming soon.</p>
          </div>
        );
      case 'imageTools':
        return (
          <div className="p-4 text-gray-300">
            <h2 className="text-lg font-semibold mb-4">Image Tools</h2>
            {/* TODO: Integrate ImageProcessor and MultiImageChat or a new unified component */}
            <p className="text-sm">Image tools integration coming soon.</p>
          </div>
        );
      case 'settings':
        // Settings might be better as a full-page modal or a dedicated main content view
        // For now, let's see how it fits here.
        return <Settings />;
      case 'chat': // Chat is main content, so sidebar might be empty or show context
      case 'dashboard': // Dashboard is main content
      default:
        return (
          <div className="p-4 text-gray-400">
            <p>Select an item from the activity bar.</p>
          </div>
        );
    }
  };

  // Hide sidebar for views that take full main content area or don't need a sidebar
  if (activeView === 'chat' || activeView === 'dashboard') {
    return null; 
  }

  return (
    <div className="h-full w-64 lg:w-80 bg-gray-800 border-r border-gray-700 flex-shrink-0 overflow-y-auto">
      {renderSidebarContent()}
    </div>
  );
}
