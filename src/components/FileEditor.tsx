'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Save, 
  Copy, 
  Download, 
  FileText,
  Code,
  Search,
  ZoomIn,
  ZoomOut,
  MoreHorizontal,
  Type,
  X
} from 'lucide-react';
import { useBranchStore } from '@/store/branchStore';

interface FileEditorProps {
  filePath?: string;
  onClose: () => void;
  onSave: (path: string, content: string) => void;
}

export default function FileEditor({ filePath, onClose, onSave }: FileEditorProps) {
  const { getCurrentBranch } = useBranchStore();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [showTools, setShowTools] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentBranch = getCurrentBranch();

  // Get file language for syntax highlighting hints
  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'JavaScript',
      'jsx': 'React',
      'ts': 'TypeScript',
      'tsx': 'React TypeScript',
      'py': 'Python',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
      'yml': 'YAML',
      'yaml': 'YAML',
      'xml': 'XML',
      'sql': 'SQL',
      'sh': 'Shell',
      'php': 'PHP',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'rs': 'Rust',
      'go': 'Go'
    };
    return languageMap[extension || ''] || 'Text';
  };

  // Find file content in current branch
  const findFileContent = useCallback((path: string): string => {
    if (!currentBranch) return '';
    
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
    
    const findInNodes = (nodes: FileNode[], targetPath: string): string => {
      for (const node of nodes) {
        if (node.path === targetPath && node.type === 'file') {
          return node.content || '';
        }
        if (node.children && node.type === 'folder') {
          const found = findInNodes(node.children, targetPath);
          if (found !== '') return found;
        }
      }
      return '';
    };
    
    return findInNodes(currentBranch.fileTree || [], path);
  }, [currentBranch]);

  // Load file content when filePath changes
  useEffect(() => {
    if (filePath) {
      const fileContent = findFileContent(filePath);
      setContent(fileContent);
      setIsDirty(false);
    }
  }, [filePath, findFileContent]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (filePath && content !== undefined) {
      onSave(filePath, content);
      setIsDirty(false);
    }
  };

  const handleSearch = () => {
    if (!searchTerm || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const text = textarea.value.toLowerCase();
    const searchIndex = text.indexOf(searchTerm.toLowerCase());
    
    if (searchIndex !== -1) {
      textarea.focus();
      textarea.setSelectionRange(searchIndex, searchIndex + searchTerm.length);
      textarea.scrollIntoView({ block: 'center' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
    }
    
    if (e.key === 'Escape') {
      setShowSearch(false);
    }
  };

  const handleCopy = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
    }
  };

  const handleDownload = () => {
    if (!filePath || !content) return;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No file selected</h3>
          <p className="text-sm">Select a file from the project explorer to start editing</p>
        </div>
      </div>
    );
  }

  const fileName = filePath.split('/').pop() || 'untitled';
  const language = getLanguageFromPath(filePath);
  const lineCount = content.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Desktop Header - Hidden on mobile since mobile header is in parent */}
      <div className="hidden sm:flex bg-gray-800 border-b border-gray-700 items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <Code className="text-blue-400" size={20} />
          <div>
            <h1 className="font-medium text-white">{fileName}</h1>
            <p className="text-sm text-gray-400">{filePath}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search size={16} />
          </button>
          
          <button
            onClick={() => setShowTools(!showTools)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="More tools"
          >
            <MoreHorizontal size={16} />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in file..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Find
            </button>
          </div>
        </div>
      )}

      {/* Tools Panel */}
      {showTools && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Type size={16} className="text-gray-400" />
              <span className="text-gray-400">Font Size:</span>
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-white min-w-[2rem] text-center">{fontSize}px</span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <ZoomIn size={14} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wordWrap"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="wordWrap" className="text-gray-400">Word Wrap</label>
            </div>
            
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Copy size={14} />
              Copy All
            </button>
            
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
      )}

      {/* File Info Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Language: <span className="text-white">{language}</span>
          </span>
          <span className="text-gray-400">
            Lines: <span className="text-white">{lineCount}</span>
          </span>
          <span className="text-gray-400">
            Characters: <span className="text-white">{content.length}</span>
          </span>
        </div>
        
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`flex items-center gap-2 px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
            isDirty 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save size={14} />
          {isDirty ? 'Save (Ctrl+S)' : 'Saved'}
        </button>
      </div>

      {/* Code Editor */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex">
          {/* Line Numbers */}
          <div 
            className="bg-gray-800 border-r border-gray-700 px-3 py-4 text-gray-400 text-right font-mono select-none flex-shrink-0"
            style={{ fontSize: `${Math.max(fontSize - 2, 10)}px`, lineHeight: '1.5' }}
          >
            {content.split('\n').map((_, index) => (
              <div key={index} className="leading-6">
                {index + 1}
              </div>
            ))}
          </div>
          
          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className={`flex-1 bg-gray-900 text-white p-4 font-mono resize-none focus:outline-none ${
              wordWrap ? '' : 'whitespace-nowrap overflow-x-auto'
            }`}
            style={{ 
              fontSize: `${fontSize}px`,
              lineHeight: '1.5',
              tabSize: 2
            }}
            placeholder="Start typing your code..."
            spellCheck={false}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
