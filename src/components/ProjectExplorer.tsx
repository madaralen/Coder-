'use client';

import { useState, useEffect, useRef } from 'react';
import { useProjectStore, initializeSampleProjects } from '@/store/projectStore';
import { useBranchStore, Branch } from '@/store/branchStore';
import BranchSelector from './BranchSelector';
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
          className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer select-none group"
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              handleFileSelect(node.path);
            }
          }}
        >
          {node.type === 'folder' && (
            <span className="mr-2">
              {node.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          
          {node.type === 'folder' ? (
            <Folder size={18} className="mr-3 text-blue-400 flex-shrink-0" />
          ) : (
            <span className="mr-3 flex-shrink-0">{getFileIcon(node.name)}</span>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <span className={`text-sm truncate ${node.isNew ? 'text-green-400' : 'text-gray-100'}`}>
                {node.name}
              </span>
              {node.isNew && (
                <span className="ml-2 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">NEW</span>
              )}
            </div>
            {node.type === 'file' && node.size && (
              <div className="text-xs text-gray-400 truncate">
                {(node.size / 1024).toFixed(1)} KB
              </div>
            )}
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
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Files</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Upload files"
          >
            <Upload size={18} className="text-gray-400" />
          </button>
        </div>
        
        {/* Branch Selector */}
        <div className="mb-3">
          <BranchSelector />
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNewFileModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            <FilePlus size={14} />
            New File
          </button>
          
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <FolderPlus size={14} />
            Folder
          </button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-white">Create New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFile();
                if (e.key === 'Escape') setShowNewFileModal(false);
              }}
              placeholder="Enter file name (e.g., script.js, style.css)"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-white"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewFile}
                disabled={!newFileName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-white">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewFolder();
                if (e.key === 'Escape') setShowNewFolderModal(false);
              }}
              placeholder="Enter folder name"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-white"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
