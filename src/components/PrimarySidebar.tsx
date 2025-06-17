'use client';

import ProjectExplorer from '@/components/ProjectExplorer';
import BranchManagementView from './BranchManagementView';
import Settings from '@/components/Settings';
import ImageToolsView from './ImageToolsView'; // Import ImageToolsView
import { ActiveView } from './ActivityBar';
import { useProjectStore } from '@/store/projectStore';
import { useBranchStore } from '@/store/branchStore';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface PrimarySidebarProps {
  activeView: ActiveView;
  onFileSelect: (filePath: string) => void;
}

export default function PrimarySidebar({ activeView, onFileSelect }: PrimarySidebarProps) {
  const { getCurrentBranch } = useBranchStore();
  const currentBranch = getCurrentBranch();
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]); // Placeholder for search results

  const handleGlobalSearch = () => {
    // TODO: Implement actual global search logic
    // This would involve searching through file contents, names, chat history, etc.
    console.log("Searching for:", globalSearchTerm);
    setSearchResults([
      `Result for "${globalSearchTerm}" 1`,
      `Result for "${globalSearchTerm}" 2`,
    ]);
  };

  const renderSidebarContent = () => {
    switch (activeView) {
      case 'explorer':
        return <ProjectExplorer onFileSelect={onFileSelect} currentBranch={currentBranch} />;
      case 'branches':
        return <BranchManagementView />;
      case 'search':
        return (
          <div className="p-4 flex flex-col h-full">
            <h2 className="text-xl font-semibold mb-4 text-white">Global Search</h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="Search project..." 
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGlobalSearch()}
                className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
              />
              <button 
                onClick={handleGlobalSearch}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
              >
                <Search size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchResults.length > 0 ? (
                <ul className="space-y-2">
                  {searchResults.map((result, index) => (
                    <li key={index} className="p-2 bg-gray-700/50 rounded-md text-sm text-gray-300 hover:bg-gray-600/50 cursor-pointer">
                      {result}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm text-center mt-4">
                  {globalSearchTerm ? 'No results found.' : 'Enter a term to search.'}
                </p>
              )}
            </div>
            {/* TODO: Add filters, context for search results */}
          </div>
        );
      case 'imageTools':
        // TODO: Implement proper callbacks that send analysis to MainSection chat
        const handleSingleImageAnalyzed = (analysis: string, imageUrl: string) => {
          console.log("Single Image Analyzed in PrimarySidebar:", { analysis, imageUrl });
          // This should eventually add a message to MainSection's chat
          // Example: addMessageToChat(`Image analysis for ${imageUrl}:\n${analysis}`);
        };
        const handleMultiImagesAnalyzed = (images: any[], combinedAnalysis: string) => {
          console.log("Multi Images Analyzed in PrimarySidebar:", { images, combinedAnalysis });
          // This should eventually add a message to MainSection's chat
          // Example: addMessageToChat(`Combined analysis for ${images.length} images:\n${combinedAnalysis}`);
        };
        return (
          <div className="h-full overflow-y-auto">
            <ImageToolsView 
              onSingleImageAnalyzed={handleSingleImageAnalyzed}
              onMultiImagesAnalyzed={handleMultiImagesAnalyzed}
            />
          </div>
        );
      case 'settings':
        // Settings might be better as a full-page modal or a dedicated main content view.
        // If kept in sidebar, ensure it's scrollable and well-contained.
        return <div className="h-full overflow-y-auto"><Settings /></div>;
      case 'chat': 
      case 'dashboard': 
      default:
        // These views typically don't have a primary sidebar, or it shows contextual info.
        // The parent component (page.tsx) should handle hiding/showing the sidebar.
        return null; 
    }
  };

  // The decision to show the sidebar is now primarily in page.tsx based on activityBarView
  // This component just renders its content if it's supposed to be visible.
  // Return null if the activeView doesn't warrant a sidebar content here,
  // page.tsx will handle not rendering <PrimarySidebar /> at all for 'chat' or 'dashboard'.
  if (activeView === 'chat' || activeView === 'dashboard') {
    return null;
  }

  return (
    <div className="h-full w-64 lg:w-80 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex flex-col overflow-hidden">
      {/* Ensure content itself is scrollable if it overflows, not the whole sidebar div if fixed height */}
      <div className="flex-1 overflow-y-auto">
        {renderSidebarContent()}
      </div>
    </div>
  );
}
