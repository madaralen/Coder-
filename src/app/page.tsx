'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ProjectExplorer from '@/components/ProjectExplorer';
import MainSection from '@/components/MainSection';
import FileEditor from '@/components/FileEditor';
import Settings from '@/components/Settings';
import { useProjectStore } from '@/store/projectStore';
import { useBranchStore } from '@/store/branchStore';
import { ArrowLeft, X } from 'lucide-react';

export default function Home() {
  const [activeView, setActiveView] = useState<'main' | 'files' | 'settings'>('main');
  const [messageCount, setMessageCount] = useState(0);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const { selectedFile, setSelectedFile } = useProjectStore();
  const { getCurrentBranch, updateBranchFiles } = useBranchStore();

  // Get current branch and message count
  const currentBranch = getCurrentBranch();
  
  useEffect(() => {
    if (currentBranch?.chatHistory) {
      setMessageCount(Math.max(0, currentBranch.chatHistory.length - 1));
    }
  }, [currentBranch?.chatHistory]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    setShowFileEditor(true);
  };

  const handleFileClose = () => {
    setSelectedFile(null);
    setShowFileEditor(false);
    // Ensure we return to files view on mobile when closing
    if (window.innerWidth < 640) { // sm breakpoint
      setActiveView('files');
    }
  };

  const handleBackToFiles = () => {
    setShowFileEditor(false);
    setSelectedFile(null);
    // Ensure we return to files view
    setActiveView('files');
  };

  const handleFileSave = (filePath: string, content: string) => {
    const currentBranch = getCurrentBranch();
    if (!currentBranch) return;

    interface FileNode {
      name: string;
      path: string;
      type: 'file' | 'folder';
      content?: string;
      children?: FileNode[];
      expanded?: boolean;
      size?: number;
      lastModified?: Date;
      isNew?: boolean;
    }
    
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === filePath && node.type === 'file') {
          return { ...node, content, lastModified: new Date() };
        }
        if (node.children && node.type === 'folder') {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    
    const updatedFileTree = updateNode(currentBranch.fileTree || []);
    updateBranchFiles(currentBranch.id, updatedFileTree);
  };

  const renderContent = () => {
    // Mobile file editor view
    if (showFileEditor && selectedFile) {
      return (
        <div className="flex flex-col h-full">
          {/* Mobile File Editor Header */}
          <div className="sm:hidden bg-gray-800 border-b border-gray-700 flex items-center px-4 py-3 z-10">
            <button
              onClick={handleBackToFiles}
              className="mr-3 p-2 -ml-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-300" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-medium truncate">
                {selectedFile.split('/').pop()}
              </h1>
              <p className="text-gray-400 text-sm truncate">
                {selectedFile}
              </p>
            </div>
            <button
              onClick={handleFileClose}
              className="ml-3 p-2 -mr-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          
          {/* File Editor */}
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

    // Desktop: side-by-side when file is selected in files view
    if (activeView === 'files' && selectedFile) {
      return (
        <div className="hidden sm:flex h-full">
          <div className="w-64 lg:w-80 border-r border-gray-700 flex-shrink-0">
            <ProjectExplorer onFileSelect={handleFileSelect} currentBranch={currentBranch} />
          </div>
          <div className="flex-1 min-w-0">
            <FileEditor 
              filePath={selectedFile} 
              onClose={handleFileClose} 
              onSave={handleFileSave}
            />
          </div>
        </div>
      );
    }

    // Regular views
    switch (activeView) {
      case 'main':
        return <MainSection />;
      case 'files':
        return <ProjectExplorer onFileSelect={handleFileSelect} currentBranch={currentBranch} />;
      case 'settings':
        return <Settings />;
      default:
        return <MainSection />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>
        
        {/* Mobile Bottom Navigation - Always show when not in file editor */}
        <div className={`sm:hidden bg-black/30 backdrop-blur-md border-t border-white/10 flex-shrink-0 transition-all duration-300 ${showFileEditor ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex justify-center p-4">
            <div className="flex bg-black/50 backdrop-blur-md rounded-full p-2 border border-white/10">
              {[
                { id: 'main' as const, label: 'Chat', icon: '💬', badge: messageCount > 0 ? messageCount : null },
                { id: 'files' as const, label: 'Files', icon: '📁', badge: selectedFile ? '•' : null },
                { id: 'settings' as const, label: 'Settings', icon: '⚙️', badge: null }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (item.id !== 'files') {
                      setShowFileEditor(false);
                      setSelectedFile(null);
                    }
                  }}
                  className={`
                    relative flex flex-col items-center justify-center 
                    min-w-[64px] min-h-[48px] px-3 py-2 mx-1 rounded-full
                    transition-all duration-300 
                    ${activeView === item.id
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  <div className="text-lg leading-none mb-1">{item.icon}</div>
                  <div className="text-xs font-medium">{item.label}</div>
                  
                  {/* Badge/Indicator */}
                  {item.badge && (
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-xs font-bold bg-red-500 text-white">
                      {item.badge}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
