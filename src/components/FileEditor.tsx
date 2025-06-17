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
      <div className="hidden sm:flex bg-gray-800 border-b border-gray-700 items-center justify-between px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="text-blue-400 flex-shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white truncate" title={fileName}>{fileName}{isDirty ? "*" : ""}</h1>
            <p className="text-xs text-gray-400 truncate" title={filePath}>{filePath}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${isDirty 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            title={isDirty ? "Save (Ctrl+S)" : "Saved"}
          >
            <Save size={14} />
            {isDirty ? 'Save' : 'Saved'}
          </button>

          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search size={16} />
          </button>
          
          {/* Tools Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowTools(!showTools)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="More tools"
            >
              <MoreHorizontal size={16} />
            </button>
            {/* Tools Dropdown Panel - will be positioned absolutely */}
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-red-400"
            title="Close File"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Search Bar - Unchanged for now, might be restyled later */}
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

      {/* Tools Dropdown Panel - Positioned absolutely relative to its trigger */}
      {showTools && (
        <div className="absolute top-12 right-4 z-20 bg-gray-700 border border-gray-600 rounded-lg shadow-xl p-3 w-64">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="fontSize" className="text-gray-300">Font Size:</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setFontSize(Math.max(10, fontSize - 1))} className="p-1 hover:bg-gray-600 rounded"><ZoomOut size={14} /></button>
                <span className="text-white w-8 text-center">{fontSize}px</span>
                <button onClick={() => setFontSize(Math.min(30, fontSize + 1))} className="p-1 hover:bg-gray-600 rounded"><ZoomIn size={14} /></button>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="wordWrapToggle" className="text-gray-300">Word Wrap:</label>
              <input
                type="checkbox"
                id="wordWrapToggle"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-500 bg-gray-600 border-gray-500 rounded focus:ring-blue-400"
              />
            </div>
            
            <button
              onClick={() => { handleCopy(); setShowTools(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-md transition-colors"
            >
              <Copy size={14} />
              Copy All Content
            </button>
            
            <button
              onClick={() => { handleDownload(); setShowTools(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-md transition-colors"
            >
              <Download size={14} />
              Download File
            </button>
          </div>
        </div>
      )}

      {/* Code Editor Area (includes line numbers and textarea) */}
      <div className="flex-1 relative overflow-hidden" onKeyDown={handleKeyDown}> {/* Moved onKeyDown here */}
        {/* Editor Content (Line numbers + Textarea) */}
        <div className="absolute inset-0 flex">
          {/* Line Numbers */}
          <div 
            className="bg-gray-800 border-r border-gray-700/50 px-2 py-4 text-gray-500 text-right font-mono select-none flex-shrink-0 sticky top-0 h-full overflow-y-hidden"
            style={{ fontSize: `${Math.max(fontSize - 2, 10)}px`, lineHeight: '1.57' }} // Adjusted line height for better alignment
            ref={(el) => { // Sync scroll with textarea
              if (el && textareaRef.current) {
                textareaRef.current.onscroll = () => {
                  el.scrollTop = textareaRef.current!.scrollTop;
                };
              }
            }}
          >
            {content.split('\n').map((_, index) => (
              <div key={index} className="h-[25px]"> {/* Approximate height of a line */}
                {index + 1}
              </div>
            ))}
          </div>
          
          {/* Editor Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className={`flex-1 bg-gray-900 text-gray-100 p-4 font-mono resize-none focus:outline-none custom-scrollbar ${
              wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto' // `whitespace-pre` for tabs/spaces
            }`}
            style={{ 
              fontSize: `${fontSize}px`,
              lineHeight: '1.57', // Match line number div
              tabSize: 2, // Standard tab size
              WebkitTabSize: 2, // For Safari/Chrome
              MozTabSize: 2, // For Firefox
              OTabSize: 2, // For Opera
            }}
            placeholder="Start typing your code..."
            spellCheck={false}
            // onKeyDown moved to parent div to capture Ctrl+S even when textarea not focused
          />
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-1.5 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Ln {content.substring(0, textareaRef.current?.selectionStart || 0).split('\n').length}, Col {(textareaRef.current?.selectionStart || 0) - content.lastIndexOf('\n', (textareaRef.current?.selectionStart || 1) -1 ) }</span>
          <span>{language}</span>
          <span>Lines: {lineCount}</span>
          <span>Chars: {content.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>UTF-8</span>
          {/* Add other status indicators like Git branch if needed */}
        </div>
      </div>
    </div>
  );
}
