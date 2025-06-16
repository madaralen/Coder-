'use client';

import { useState, useEffect, useRef } from 'react';
import { useProjectStore, initializeSampleProjects } from '@/store/projectStore';
import { useBranchStore, Branch } from '@/store/branchStore';
import { 
  Folder, 
  File, 
  FolderPlus, 
  Upload,
  ChevronRight,
  ChevronDown,
  FileText,
  Code,
  Image as ImageIcon,
  FilePlus,
  Search
} from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  expanded?: boolean;
  content?: string;
  size?: number;
  lastModified?: Date;
  isNew?: boolean;
}

interface ProjectExplorerProps {
  onFileSelect: (filePath: string) => void;
  currentBranch: Branch | null;
}

export default function ProjectExplorer({ onFileSelect, currentBranch }: ProjectExplorerProps) {
  const { toggleFolder } = useProjectStore();
  const { updateBranchFiles } = useBranchStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Array<{fileName: string; progress: number}>>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with sample projects if none exist
  useEffect(() => {
    if (currentBranch && 
        currentBranch.fileTree && 
        Array.isArray(currentBranch.fileTree) && 
        currentBranch.fileTree.length === 0 && 
        currentBranch.isMain) {
      initializeSampleProjects();
    }
  }, [currentBranch]);

  const handleFileSelect = (filePath: string) => {
    onFileSelect(filePath);
  };

  const handleFileUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const progress = { fileName: file.name, progress: 0 };
      setUploadProgress(prev => [...prev, progress]);

      try {
        const content = await readFileAsText(file);
        
        const newFile: FileNode = {
          name: file.name,
          type: 'file',
          path: file.name,
          content,
          size: file.size,
          lastModified: new Date(file.lastModified),
          isNew: true
        };

        if (currentBranch && currentBranch.fileTree) {
          updateBranchFiles(currentBranch.id, [...currentBranch.fileTree, newFile]);
        }

        progress.progress = 100;
        setUploadProgress(prev => prev.map(p => p.fileName === file.name ? progress : p));
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    // Clear progress after delay
    setTimeout(() => {
      setUploadProgress([]);
    }, 2000);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const createNewFile = () => {
    if (!newFileName.trim() || !currentBranch) return;
    
    const newFile: FileNode = {
      name: newFileName,
      type: 'file',
      path: newFileName,
      content: '',
      isNew: true,
      lastModified: new Date()
    };

    updateBranchFiles(currentBranch.id, [...(currentBranch.fileTree || []), newFile]);
    setShowNewFileModal(false);
    setNewFileName('');
  };

  const createNewFolder = () => {
    if (!newFolderName.trim() || !currentBranch) return;
    
    const newFolder: FileNode = {
      name: newFolderName,
      type: 'folder',
      path: newFolderName,
      expanded: true,
      isNew: true,
      children: []
    };

    updateBranchFiles(currentBranch.id, [...(currentBranch.fileTree || []), newFolder]);
    setShowNewFolderModal(false);
    setNewFolderName('');
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'rs':
      case 'go':
        return <Code size={16} className="text-blue-400" />;
      case 'html':
      case 'css':
      case 'scss':
      case 'less':
        return <Code size={16} className="text-green-400" />;
      case 'md':
      case 'txt':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
        return <FileText size={16} className="text-yellow-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return <ImageIcon size={16} className="text-purple-400" />;
      default:
        return <File size={16} className="text-gray-400" />;
    }
  };

  const filterFiles = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    
    return nodes.filter(node => {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
      if (node.children) {
        const filteredChildren = filterFiles(node.children, query);
        if (filteredChildren.length > 0) {
          return true;
        }
      }
      return false;
    });
  };

  const renderFileNode = (node: FileNode, depth = 0): React.ReactNode => {
    const indent = depth * 16;
    
    return (
      <div key={node.path}>
        <div 
          className="flex items-center px-2 py-1.5 hover:bg-gray-700/70 rounded-md cursor-pointer select-none group mx-1"
          style={{ paddingLeft: `${8 + indent}px` }} // Slightly reduced base padding
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              handleFileSelect(node.path);
            }
          }}
        >
          {node.type === 'folder' ? (
            node.expanded ? <ChevronDown size={16} className="mr-1.5 text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="mr-1.5 text-gray-400 flex-shrink-0" />
          ) : (
            <div className="w-[16px] mr-1.5 flex-shrink-0"></div> // Placeholder for alignment
          )}
          
          {node.type === 'folder' ? (
            <Folder size={16} className="mr-1.5 text-sky-400 flex-shrink-0" />
          ) : (
            <span className="mr-1.5 flex-shrink-0">{getFileIcon(node.name)}</span>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <span className={`text-sm truncate ${node.isNew ? 'text-green-400 font-medium' : 'text-gray-200 group-hover:text-white'}`}>
                {node.name}
              </span>
              {node.isNew && (
                <span className="ml-1.5 text-[10px] bg-green-500/30 text-green-300 px-1 py-0.5 rounded-sm font-medium">NEW</span>
              )}
            </div>
            {/* Optional: File size display, could be a tooltip or secondary info
            {node.type === 'file' && node.size && (
              <div className="text-xs text-gray-500 truncate">
                {(node.size / 1024).toFixed(1)} KB
              </div>
            )} */}
          </div>
        </div>
        
        {node.type === 'folder' && node.expanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = currentBranch?.fileTree || [];
  const filteredFiles = filterFiles(fileTree, searchQuery);

  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Files</h2>
          {/* Action Icons Group */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewFileModal(true)}
              className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
              title="New File"
            >
              <FilePlus size={16} className="text-gray-300 hover:text-white" />
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
              title="New Folder"
            >
              <FolderPlus size={16} className="text-gray-300 hover:text-white" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
              title="Upload Files"
            >
              <Upload size={16} className="text-gray-300 hover:text-white" />
            </button>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-gray-700 border border-gray-600 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploadProgress.map((progress, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm truncate text-white">{progress.fileName}</span>
                  <span className="text-xs text-gray-400">{progress.progress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1">
                  <div 
                    className="h-1 rounded-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".js,.jsx,.ts,.tsx,.py,.html,.css,.scss,.json,.md,.txt,.java,.cpp,.c,.rs,.go"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            {searchQuery ? (
              <div>
                <Search size={48} className="mx-auto mb-2 opacity-50" />
                <p>No files found for &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div>
                <FolderPlus size={48} className="mx-auto mb-2 opacity-50" />
                <p>No files yet</p>
                <p className="text-sm">Create or upload files to get started</p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            {filteredFiles.map(node => renderFileNode(node))}
          </div>
        )}
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Create New File</h3>
              <button onClick={() => setShowNewFileModal(false)} className="text-gray-400 hover:text-white"><FilePlus size={14} /> {/* Using XCircle from BranchManagementView for consistency */}</button>
            </div>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFile();
                if (e.key === 'Escape') setShowNewFileModal(false);
              }}
              placeholder="Enter file name (e.g., script.js)"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 mb-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewFile}
                disabled={!newFileName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md shadow-xl">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Create New Folder</h3>
                <button onClick={() => setShowNewFolderModal(false)} className="text-gray-400 hover:text-white"><FolderPlus size={14} /></button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFolder();
                if (e.key === 'Escape') setShowNewFolderModal(false);
              }}
              placeholder="Enter folder name"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 mb-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
