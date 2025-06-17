'use client';

import { useState, useEffect } from 'react';
import ActivityBar, { ActiveView as ActivityBarViewType } from '@/components/ActivityBar';
import PrimarySidebar from '@/components/PrimarySidebar';
import MainSection from '@/components/MainSection';
import FileEditor from '@/components/FileEditor';
import Settings from '@/components/Settings'; // May be rendered by PrimarySidebar or MainContent
import ProjectExplorer from '@/components/ProjectExplorer'; // May be rendered by PrimarySidebar
import { useProjectStore } from '@/store/projectStore';
import { useBranchStore } from '@/store/branchStore';
import { ArrowLeft, X, Menu, Search as SearchIcon, FolderOpen, MessageSquare, Settings as SettingsIconLucide, GitBranch, Image as ImageIconLucide, LayoutGrid } from 'lucide-react'; // Added Menu for mobile

// Define a more comprehensive view state
type MainContentViewType = 'chat' | 'editor' | 'settings_main' | 'dashboard_main' | 'image_tools_main'; // For what's in the main panel

export default function Home() {
  // State for the new layout
  const [activityBarView, setActivityBarView] = useState<ActivityBarViewType>('dashboard');
  const [mainContentView, setMainContentView] = useState<MainContentViewType>('dashboard_main');
  
  // Existing state (some might be adapted or replaced)
  const [messageCount, setMessageCount] = useState(0); // For chat badges
  const [showMobileFileEditor, setShowMobileFileEditor] = useState(false); // For mobile-specific editor view
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false); // For mobile primary sidebar

  const { selectedFile, setSelectedFile } = useProjectStore();
  const { getCurrentBranch, updateBranchFiles } = useBranchStore();
  const currentBranch = getCurrentBranch();

  useEffect(() => {
    if (currentBranch?.chatHistory) {
      setMessageCount(Math.max(0, currentBranch.chatHistory.length - 1));
    }
  }, [currentBranch?.chatHistory]);

  // Handle view changes from ActivityBar
  const handleActivityViewChange = (newView: ActivityBarViewType) => {
    setActivityBarView(newView);
    setIsMobileSidebarOpen(false); // Close mobile sidebar when changing main activity

    // Determine what to show in the main content area
    switch (newView) {
      case 'chat':
        setMainContentView('chat');
        setSelectedFile(null); // Close file editor if chat is selected
        break;
      case 'explorer':
        // If a file is already selected, show editor, otherwise, explorer might be in sidebar
        // This logic will be refined. For now, explorer implies files, editor if one is selected.
        if (!selectedFile) setMainContentView('chat'); // Default to chat if no file selected and explorer is chosen
        else setMainContentView('editor');
        break;
      case 'settings':
        setMainContentView('settings_main');
        setSelectedFile(null);
        break;
      case 'dashboard':
        setMainContentView('dashboard_main');
        setSelectedFile(null);
        break;
      case 'imageTools':
        setMainContentView('image_tools_main');
        setSelectedFile(null);
        break;
      case 'search': // Search UI might be in primary sidebar or a modal
      case 'branches': // Branch UI might be in primary sidebar
        // For these, the main content might not change, or show a relevant view
        // If a file is open, keep it open. Otherwise, default to chat or dashboard.
        if (!selectedFile) setMainContentView('dashboard_main');
        else setMainContentView('editor');
        break;
      default:
        setMainContentView('dashboard_main');
        setSelectedFile(null);
    }
  };
  
  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    setMainContentView('editor'); // Switch main content to editor
    setShowMobileFileEditor(true); // For mobile, trigger full screen editor
    setIsMobileSidebarOpen(false); // Close mobile sidebar when a file is selected
  };

  const handleFileClose = () => {
    setSelectedFile(null);
    // Determine what to show after closing a file
    // If explorer was the last active sidebar view, maybe show that, or default to chat/dashboard
    if (activityBarView === 'explorer') {
      // Potentially do nothing if explorer is in sidebar, or switch main view
      setMainContentView('dashboard_main'); // Or 'chat'
    } else {
      setMainContentView('dashboard_main'); // Or 'chat'
    }
    setShowMobileFileEditor(false);
  };
  
  const handleBackToFilesMobile = () => {
    setShowMobileFileEditor(false);
    setSelectedFile(null);
    setActivityBarView('explorer'); // Switch back to explorer view on mobile
    setMainContentView('chat'); // Or some other default for mobile main content when no file
  };

  const handleFileSave = (filePath: string, content: string) => {
    const branch = getCurrentBranch();
    if (!branch) return;

    // Simplified FileNode for this context, ensure it matches store's FileNode
    interface FileNode {
      name: string; path: string; type: 'file' | 'folder';
      content?: string; children?: FileNode[];
    }
    
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === filePath && node.type === 'file') {
          return { ...node, content, lastModified: new Date() } as FileNode;
        }
        if (node.children && node.type === 'folder') {
          return { ...node, children: updateNode(node.children) } as FileNode;
        }
        return node;
      });
    };
    
    const updatedFileTree = updateNode(branch.fileTree || []);
    updateBranchFiles(branch.id, updatedFileTree as any); // Cast if necessary
  };

  // Render logic for the main content area based on mainContentView and selectedFile
  const renderMainContent = () => {
    if (mainContentView === 'editor' && selectedFile) {
      return (
        <FileEditor 
          filePath={selectedFile} 
          onClose={handleFileClose} 
          onSave={handleFileSave}
        />
      );
    }
    switch (mainContentView) {
      case 'chat':
        return <MainSection />;
      case 'settings_main':
        return <Settings />; // Assuming Settings can be a main content view
      case 'dashboard_main':
        return (
          <div className="p-8 text-gray-300">
            <h1 className="text-3xl font-bold mb-6">Welcome to Coder AI</h1>
            <p className="mb-4">Select an option from the activity bar to get started, or ask the AI assistant for help.</p>
            {/* TODO: Add dashboard widgets, quick actions, recent projects etc. */}
          </div>
        );
      case 'image_tools_main':
        return (
          <div className="p-8 text-gray-300">
            <h1 className="text-3xl font-bold mb-6">Image Tools</h1>
            {/* Placeholder for integrated image tools UI */}
            <p>Image processing and multi-image chat features will be integrated here.</p>
          </div>
        );
      default:
        return <MainSection />; // Default to chat
    }
  };

  // Mobile specific rendering for file editor
  if (showMobileFileEditor && selectedFile) {
    return (
      <div className="flex flex-col h-screen w-screen bg-gray-900">
        {/* Mobile File Editor Header */}
        <div className="bg-gray-800 border-b border-gray-700 flex items-center px-4 py-3 z-20 flex-shrink-0">
          <button
            onClick={handleBackToFilesMobile}
            className="mr-3 p-2 -ml-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-medium truncate">
              {selectedFile.split('/').pop()}
            </h1>
          </div>
          <button
            onClick={handleFileClose}
            className="ml-3 p-2 -mr-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <FileEditor 
            filePath={selectedFile} 
            onClose={handleFileClose} 
            onSave={handleFileSave}
          />
        </div>
      </div>
    );
  }
  
  const mobileNavItems = [
    { id: 'dashboard' as ActivityBarViewType, label: 'Home', icon: LayoutGrid },
    { id: 'chat' as ActivityBarViewType, label: 'Chat', icon: MessageSquare, badge: messageCount > 0 ? messageCount : null },
    { id: 'explorer' as ActivityBarViewType, label: 'Files', icon: FolderOpen, badge: selectedFile ? '•' : null },
    // { id: 'search' as ActivityBarViewType, label: 'Search', icon: SearchIcon }, // Add if search is a primary mobile view
    // { id: 'branches' as ActivityBarViewType, label: 'Branches', icon: GitBranch }, // Add if branches is a primary mobile view
    { id: 'settings' as ActivityBarViewType, label: 'Settings', icon: SettingsIconLucide }
  ];


  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900 text-white overflow-hidden">
      {/* Activity Bar (Desktop and Mobile trigger) */}
      <div className="hidden sm:block flex-shrink-0">
        <ActivityBar activeView={activityBarView} onViewChange={handleActivityViewChange} />
      </div>
      
      {/* Primary Sidebar (Desktop) */}
      <div className="hidden sm:block flex-shrink-0">
        { (activityBarView === 'explorer' || activityBarView === 'search' || activityBarView === 'branches' || activityBarView === 'settings' /* Add other views that use primary sidebar */) &&
          <PrimarySidebar activeView={activityBarView} onFileSelect={handleFileSelect} />
        }
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Mobile Header */}
        <div className="sm:hidden bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 py-3 z-10">
          <button onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} className="p-2 -ml-2">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">
            {activityBarView.charAt(0).toUpperCase() + activityBarView.slice(1)}
          </h1>
          {/* Potentially add a context-specific action button here, e.g., search icon */}
          <div className="w-8"></div> {/* Spacer */}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderMainContent()}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <div className={`sm:hidden fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-md border-t border-white/10 flex-shrink-0 transition-all duration-300 z-20`}>
        <div className="flex justify-around p-2">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                handleActivityViewChange(item.id);
                // If 'files' is tapped and a file is open, it might stay open or close.
                // If 'files' is tapped and no file is open, it should open the file explorer (handled by PrimarySidebar logic on mobile).
                if (item.id === 'explorer') {
                    setIsMobileSidebarOpen(true); // Open file explorer sidebar
                } else {
                    setIsMobileSidebarOpen(false);
                }
                if (item.id !== 'explorer' || !selectedFile) { // Close file editor if not navigating to explorer with a file or if navigating away
                    setShowMobileFileEditor(false);
                    // setSelectedFile(null); // This might be too aggressive, consider user flow
                }
              }}
              className={`
                relative flex flex-col items-center justify-center 
                px-3 py-2 mx-1 rounded-lg
                transition-all duration-200 
                flex-1 
                ${activityBarView === item.id
                  ? 'bg-blue-600 text-white scale-105' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
                }
              `}
            >
              <item.icon size={20} className="mb-0.5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge && (
                <div className="absolute top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[10px] font-bold bg-red-500 text-white">
                  {item.badge}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Primary Sidebar (Drawer) */}
      {isMobileSidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-30">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
          {/* Sidebar Content */}
          <div className="absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-gray-800 border-r border-gray-700 shadow-xl overflow-y-auto">
            <div className="p-4">
                <button onClick={() => setIsMobileSidebarOpen(false)} className="absolute top-3 right-3 p-2 text-gray-400 hover:text-white">
                    <X size={20}/>
                </button>
                 <h2 className="text-xl font-semibold mb-4 mt-2">Menu</h2>
            </div>
            {/* Render the actual sidebar content for mobile */}
            { (activityBarView === 'explorer' || activityBarView === 'search' || activityBarView === 'branches' || activityBarView === 'settings') &&
              <PrimarySidebar activeView={activityBarView} onFileSelect={handleFileSelect} />
            }
            {/* Fallback or specific mobile sidebar content if needed */}
            { !(activityBarView === 'explorer' || activityBarView === 'search' || activityBarView === 'branches' || activityBarView === 'settings') && (
                <div className="p-4 text-gray-300">No specific sidebar for this view.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
