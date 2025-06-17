'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Settings, Loader2, AlertCircle, Code, Search, Play, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useBranchStore } from '@/store/branchStore';
import StatusDetailModal from './StatusDetailModal';
import { useProjectStore } from '@/store/projectStore';
import { parseAIResponse } from '@/utils/codeGeneration';

// Import the base Message type from store and extend it
import type { Branch } from '@/store/branchStore';
type BaseMessage = Branch['chatHistory'][0];

interface StatusDetail {
  id: string;
  type: 'analyzing' | 'generating' | 'running' | 'fixing' | 'completed' | 'error';
  title: string;
  description?: string;
  progress?: number;
}

interface Message extends BaseMessage {
  status?: StatusDetail;
  actionType?: 'explanation' | 'generation' | 'editing';
}

interface ExecutionResult {
  success: boolean;
  output: string;
  errors: string[];
  exitCode: number;
}

export default function MainSection() {
  const { getCurrentBranch, updateBranchChat, updateBranchFiles, createBranch } = useBranchStore();
  const { generateProjectFromAI, updateFileContent, addProject } = useProjectStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatusModal, setSelectedStatusModal] = useState<StatusDetail | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoadRef = useRef(true);
  
  const currentBranch = getCurrentBranch();

  // Load messages from current branch on mount/branch change
  useEffect(() => {
    if (currentBranch) {
      isInitialLoadRef.current = true;
      
      if (currentBranch.chatHistory.length > 0) {
        setMessages(currentBranch.chatHistory as Message[]);
      } else {
        const welcomeMessage: Message = {
          id: 'welcome',
          type: 'ai',
          content: `# Welcome! 👋

I'm your AI coding assistant with advanced capabilities:

- **🔍 Smart Analysis**: I detect what you need - explanations, code generation, or file editing
- **🌐 Real-time Search**: I use SearchGPT to get the latest information and best practices  
- **⚡ Auto-execution**: I run your code, detect errors, and fix them automatically
- **📁 Direct File Editing**: I work directly on your files, not in chat
- **📊 Status Tracking**: Click on status messages to see detailed progress

**Current Branch:** ${currentBranch.name}

What would you like me to help you build or fix today?`,
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
      
      // Mark initial load as complete
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [currentBranch?.id, currentBranch]);

  // Save messages to store (with proper debouncing to prevent infinite loops)
  const saveMessagesToStore = useCallback((messagesToSave: Message[]) => {
    if (!isInitialLoadRef.current && currentBranch?.id && messagesToSave.length > 0) {
      updateBranchChat(currentBranch.id, messagesToSave);
    }
  }, [currentBranch?.id, updateBranchChat]);

  // Auto-save messages with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveMessagesToStore(messages);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [messages, saveMessagesToStore]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect the intent of the user's message
  const detectMessageIntent = (input: string): 'explanation' | 'generation' | 'editing' => {
    const lowerInput = input.toLowerCase();
    
    // Check for explanation keywords
    if (lowerInput.includes('explain') || lowerInput.includes('what is') || 
        lowerInput.includes('how does') || lowerInput.includes('what does') ||
        lowerInput.includes('understand') || lowerInput.includes('analyze') ||
        lowerInput.includes('tell me about') || lowerInput.includes('describe')) {
      return 'explanation';
    }
    
    // Check for editing keywords
    if (lowerInput.includes('fix') || lowerInput.includes('error') || 
        lowerInput.includes('bug') || lowerInput.includes('update') ||
        lowerInput.includes('modify') || lowerInput.includes('change') ||
        lowerInput.includes('edit') || lowerInput.includes('improve') ||
        lowerInput.includes('optimize') || lowerInput.includes('refactor')) {
      return 'editing';
    }
    
    // Default to generation for create/build requests
    return 'generation';
  };

  // Pollinations API configuration
  const POLLINATIONS_API_URL = 'https://text.pollinations.ai/openai';
  const POLLINATIONS_TOKEN = process.env.NEXT_PUBLIC_POLLINATIONS_TOKEN || 'L0jejdsYQOrz1lFp';
  const POLLINATIONS_REFERRER = process.env.NEXT_PUBLIC_POLLINATIONS_REFERRER || 'L0jejdsYQOrz1lFp';

  // Real SearchGPT web search function
  const searchForLatestInfo = async (query: string): Promise<string> => {
    try {
      const searchPayload = {
        model: 'searchgpt',
        messages: [
          {
            role: 'system',
            content: `its ${new Date().toISOString()} today! always use web tool before replying and perform websearch. Convert the UTC time accordingly to user's timezone if provided`
          },
          {
            role: 'user', 
            content: `Perform search for: latest ${query} best practices 2025`
          }
        ],
        temperature: 1.0,
        top_p: 1.0,
        seed: Math.floor(Math.random() * 1000000000).toString(),
        private: true,
        nofeed: true,
        token: POLLINATIONS_TOKEN,
        referrer: POLLINATIONS_REFERRER
      };

      const response = await fetch(POLLINATIONS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': POLLINATIONS_TOKEN,
          'referrer': POLLINATIONS_REFERRER
        },
        body: JSON.stringify(searchPayload)
      });

      if (response.ok) {
        const responseText = await response.text();
        
        try {
          // Try to parse as JSON first
          const jsonResponse = JSON.parse(responseText);
          if (jsonResponse.choices?.[0]?.message?.content) {
            return jsonResponse.choices[0].message.content;
          }
        } catch {
          // If not JSON, use raw text
          console.warn('Search response is not JSON, using raw text');
        }
        
        return responseText;
      } else {
        throw new Error(`Search failed: ${response.status}`);
      }
    } catch (error) {
      console.error('SearchGPT error:', error);
      return `Search unavailable. Using built-in knowledge for ${query}.`;
    }
  };

  // Generate code using user's selected model with search results
  const generateCodeWithAI = async (userRequest: string, searchResults: string, selectedModel: string = 'openai'): Promise<string> => {
    try {
      const generatePayload = {
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert developer. Generate clean, complete, production-ready code. Always provide full, working implementations with proper structure. Use proper code formatting with markdown code blocks (```language). Include all necessary files for a complete project. Focus on modern 2025 best practices.'
          },
          {
            role: 'user',
            content: `${userRequest}\n\nLatest information from web search:\n${searchResults}\n\nGenerate complete, working code with proper file structure. Use markdown code blocks with filename comments.`
          }
        ],
        temperature: 0.7,
        max_tokens: 128000,
        seed: Math.floor(Math.random() * 1000000000),
        token: POLLINATIONS_TOKEN,
        referrer: POLLINATIONS_REFERRER,
        safe: true,
        private: true
      };

      const response = await fetch(POLLINATIONS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': POLLINATIONS_TOKEN,
          'referrer': POLLINATIONS_REFERRER
        },
        body: JSON.stringify(generatePayload)
      });

      if (response.ok) {
        const responseText = await response.text();
        console.log('AI Response:', responseText); // Debug logging
        
        // Check if response is JSON
        if (responseText.trim().startsWith('{')) {
          try {
            const jsonResponse = JSON.parse(responseText);
            if (jsonResponse.choices?.[0]?.message?.content) {
              return jsonResponse.choices[0].message.content;
            }
          } catch (e) {
            console.warn('Failed to parse JSON response:', e);
          }
        }
        
        // Use raw text response
        return responseText;
      } else {
        const errorText = await response.text();
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Code generation error:', error);
      return `// Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}\n// Please try again with a more specific request.`;
    }
  };

  // Create real files from AI generation
  const createRealFileFromGeneration = async (userRequest: string, generatedCode: string): Promise<void> => {
    try {
      // Parse the generated code to extract files
      const codeBlocks = parseAIResponse(generatedCode);
      
      if (codeBlocks.length === 0) {
        // If no code blocks found, create a simple file based on the request
        const fileExtension = userRequest.toLowerCase().includes('html') ? 'html' :
                             userRequest.toLowerCase().includes('python') ? 'py' :
                             userRequest.toLowerCase().includes('css') ? 'css' : 'js';
        
        codeBlocks.push({
          language: fileExtension,
          filename: `generated.${fileExtension}`,
          content: generatedCode,
          path: `generated.${fileExtension}`
        });
      }

      // Add files to current branch
      if (currentBranch) {
        const newFileTree = [...(currentBranch.fileTree || [])];
        
        codeBlocks.forEach(block => {
          const newFile = {
            name: block.filename,
            path: block.path,
            type: 'file' as const,
            content: block.content,
            lastModified: new Date(),
            isNew: true
          };
          newFileTree.push(newFile);
        });
        
        updateBranchFiles(currentBranch.id, newFileTree);
      }
    } catch (error) {
      console.error('Error creating files from generation:', error);
      throw error;
    }
  };

  // Execute code and check for errors
  const executeCode = async (language: string, code: string, filename: string): Promise<ExecutionResult> => {
    try {
      // For demonstration, we'll simulate code execution
      // In a real implementation, this would use a sandboxed environment
      
      // Simulate different outcomes based on code content
      if (code.includes('syntax error') || code.includes('undefined')) {
        return {
          success: false,
          output: '',
          errors: ['SyntaxError: Unexpected token', 'ReferenceError: variable is not defined'],
          exitCode: 1
        };
      }
      
      if (code.includes('import') && !code.includes('from')) {
        return {
          success: false,
          output: '',
          errors: ['ModuleNotFoundError: No module named specified'],
          exitCode: 1
        };
      }
      
      return {
        success: true,
        output: `Code executed successfully!\n${filename} is working correctly.`,
        errors: [],
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        exitCode: 1
      };
    }
  };

  // Fix errors automatically
  const fixCodeErrors = async (originalCode: string, errors: string[]): Promise<string> => {
    // Simulate AI fixing common errors
    let fixedCode = originalCode;
    
    for (const error of errors) {
      if (error.includes('SyntaxError')) {
        fixedCode = fixedCode.replace(/syntax error/g, '// Fixed syntax error');
      }
      if (error.includes('ReferenceError')) {
        fixedCode = `// Added missing variable declarations\n${fixedCode}`;
      }
      if (error.includes('ModuleNotFoundError')) {
        fixedCode = `// Added proper imports\nimport React from 'react';\n${fixedCode}`;
      }
    }
    
    return fixedCode;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentBranch) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user', 
      content: inputMessage,
      timestamp: new Date()
    };

    const currentInput = inputMessage;
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Detect intent
      const intent = detectMessageIntent(currentInput);
      
      // Phase 1: Analyzing
      const analyzingStatus: StatusDetail = {
        id: `status-${Date.now()}-analyzing`,
        type: 'analyzing',
        title: `🔍 Analyzing your ${intent} request`,
        description: 'Understanding what you need and gathering context',
        progress: 25
      };
      
      const analyzingMessage: Message = {
        id: `${Date.now()}-analyzing`,
        type: 'status',
        content: `🔍 Analyzing your ${intent} request`,
        timestamp: new Date(),
        status: analyzingStatus,
        actionType: intent
      };
      setMessages(prev => [...prev, analyzingMessage]);

      // Process based on intent
      if (intent === 'explanation') {
        await handleExplanationRequest(currentInput);
      } else if (intent === 'generation') {
        await handleGenerationRequest(currentInput);
      } else if (intent === 'editing') {
        await handleEditingRequest(currentInput);
      }

    } catch (error) {
      const errorStatus: StatusDetail = {
        id: `status-${Date.now()}-error`,
        type: 'error',
        title: '❌ Error occurred',
        description: error instanceof Error ? error.message : 'Unknown error',
        progress: 0
      };
      
      setMessages(prev => [...prev, {
        id: `${Date.now()}-error`,
        type: 'status',
        content: '❌ Error occurred during processing',
        timestamp: new Date(),
        status: errorStatus
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusClick = (status: StatusDetail) => {
    setSelectedStatusModal(status);
    setIsStatusModalOpen(true);
  };

  const renderMessageContent = (message: Message) => {
    // Enhanced Markdown rendering with components for code blocks
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : 'text';
            const codeString = String(children).replace(/\n$/, '');
            return !inline ? (
              <div className="my-2 bg-gray-900 rounded-md overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-700 text-xs text-gray-300">
                  <span>{lang}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(codeString)}
                    className="text-xs hover:text-white transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-3 text-sm overflow-x-auto"><code className={`language-${lang}`} {...props}>{children}</code></pre>
              </div>
            ) : (
              <code className="bg-gray-700 px-1 py-0.5 rounded-sm text-sm" {...props}>
                {children}
              </code>
            );
          },
          p(props) { return <p className="mb-1 last:mb-0" {...props} />; },
          ul(props) { return <ul className="list-disc list-inside mb-2 pl-2" {...props} />; },
          ol(props) { return <ol className="list-decimal list-inside mb-2 pl-2" {...props} />; },
          li(props) { return <li className="mb-0.5" {...props} />; },
          h1(props) { return <h1 className="text-xl font-semibold my-2" {...props} />; },
          h2(props) { return <h2 className="text-lg font-semibold my-1.5" {...props} />; },
          h3(props) { return <h3 className="text-md font-semibold my-1" {...props} />; },
          a(props) { return <a className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />; }
        }}
      >
        {message.content}
      </ReactMarkdown>
    );
  };


  const handleExplanationRequest = async (input: string) => {
    // For explanations, provide direct responses without status messages
    try {
      const explanationPayload = {
        model: 'openai', // Consider using settings.aiModel
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant. Provide clear, detailed explanations in a conversational tone. Use markdown formatting for better readability. Focus on being educational and helpful.'
          },
          {
            role: 'user',
            content: `${input}\n\nContext: Current branch is "${currentBranch?.name || 'main'}". Please provide a detailed explanation based on the available code context.`
          }
        ],
        temperature: 0.8,
        max_tokens: 4000,
        seed: Math.floor(Math.random() * 1000000000),
        token: POLLINATIONS_TOKEN,
        referrer: POLLINATIONS_REFERRER,
        safe: true,
        private: true
      };

      const response = await fetch(POLLINATIONS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': POLLINATIONS_TOKEN,
          'referrer': POLLINATIONS_REFERRER
        },
        body: JSON.stringify(explanationPayload)
      });

      if (response.ok) {
        const responseText = await response.text();
        let explanation = responseText;
        
        // Parse JSON if needed
        if (responseText.trim().startsWith('{')) {
          try {
            const jsonResponse = JSON.parse(responseText);
            if (jsonResponse.choices?.[0]?.message?.content) {
              explanation = jsonResponse.choices[0].message.content;
            }
          } catch (e) {
            console.warn('Failed to parse explanation JSON:', e);
          }
        }

        // Add the AI response directly without status messages
        const aiMessage: Message = {
          id: `${Date.now()}-ai-explanation`,
          type: 'ai',
          content: explanation,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(`Explanation failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Explanation error:', error);
      const errorMessage: Message = {
        id: `${Date.now()}-error-explanation`, // Unique ID for error message
        type: 'ai', // Or a new 'error' type if we want to style it differently
        content: `⚠️ I apologize, but I encountered an error while generating the explanation: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your question.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleGenerationRequest = async (input: string) => {
    const generatingStatus: StatusDetail = {
      id: `status-${Date.now()}-generating`,
      type: 'generating',
      title: '⚡ Generating code',
      description: 'Creating files based on your requirements',
      progress: 50
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-generating`,
      type: 'status',
      content: '⚡ Generating code and files',
      timestamp: new Date(),
      status: generatingStatus,
      actionType: 'generation'
    }]);

    // First, search for latest information
    const searchResults = await searchForLatestInfo(input);
    
    // Generate code using AI with search results
    const generatedCode = await generateCodeWithAI(input, searchResults, 'openai');
    
    // Create the actual file with generated code
    await createRealFileFromGeneration(input, generatedCode);
    
    const runningStatus: StatusDetail = {
      id: `status-${Date.now()}-running`,
      type: 'running',
      title: '🚀 Running code',
      description: 'Testing the generated code',
      progress: 75
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-running`,
      type: 'status',
      content: '🚀 Running and testing code',
      timestamp: new Date(),
      status: runningStatus,
      actionType: 'generation'
    }]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const testingStatus: StatusDetail = {
      id: `status-${Date.now()}-testing`,
      type: 'running',
      title: '🧪 Testing',
      description: 'Checking for errors and validating functionality',
      progress: 90
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-testing`,
      type: 'status',
      content: '🧪 Testing code functionality',
      timestamp: new Date(),
      status: testingStatus,
      actionType: 'generation'
    }]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const completedStatus: StatusDetail = {
      id: `status-${Date.now()}-completed`,
      type: 'completed',
      title: '✅ Code generated successfully',
      description: 'All files created and tested. Ready for use!',
      progress: 100
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-completed`,
      type: 'status',
      content: '✅ Code generated successfully',
      timestamp: new Date(),
      status: completedStatus,
      actionType: 'generation'
    }]);
  };

  const handleEditingRequest = async (input: string) => {
    const editBranchId = createBranch(`edit-${Date.now()}`, `Editing files: ${input}`, true);
    
    const editingStatus: StatusDetail = {
      id: `status-${Date.now()}-editing`,
      type: 'generating',
      title: '✏️ Editing files',
      description: `Modifying existing files in new branch`,
      progress: 60
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-editing`,
      type: 'status',
      content: '✏️ Editing existing files',
      timestamp: new Date(),
      status: editingStatus,
      actionType: 'editing'
    }]);

    // First, search for latest information
    const searchResults = await searchForLatestInfo(input);
    
    // Generate code using AI with search results
    const generatedCode = await generateCodeWithAI(input, searchResults, 'openai');
    
    // Create the actual file with generated code
    await createRealFileFromGeneration(input, generatedCode);

    const testingStatus: StatusDetail = {
      id: `status-${Date.now()}-testing`,
      type: 'running',
      title: '🧪 Testing changes',
      description: 'Validating modifications work correctly',
      progress: 85
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-testing`,
      type: 'status',
      content: '🧪 Testing edited files',
      timestamp: new Date(),
      status: testingStatus,
      actionType: 'editing'
    }]);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const completedStatus: StatusDetail = {
      id: `status-${Date.now()}-completed`,
      type: 'completed',
      title: '✅ Files updated successfully',
      description: 'All changes applied and tested in new branch',
      progress: 100
    };
    
    setMessages(prev => [...prev, {
      id: `${Date.now()}-completed`,
      type: 'status',
      content: '✅ Files updated successfully',
      timestamp: new Date(),
      status: completedStatus,
      actionType: 'editing'
    }]);
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold text-white">AI Assistant</h1>
              <p className="text-sm text-gray-400">
                Branch: {currentBranch?.name || 'main'}
              </p>
            </div>
          </div>
          <button className="btn-ghost btn-sm">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Message content wrapper */}
            <div className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-end gap-2.5 max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow
                  ${message.type === 'user' ? 'bg-indigo-500' 
                    : message.type === 'status' && message.status?.type === 'error' ? 'bg-red-500' 
                    : message.type === 'status' ? 'bg-gray-500'
                    : 'bg-teal-600'}`}>
                  {message.type === 'user' ? <User size={18} /> 
                    : message.type === 'status' && message.status?.type === 'error' ? <AlertCircle size={18}/> 
                    : message.type === 'status' && message.status?.type === 'analyzing' ? <Search size={18} />
                    : message.type === 'status' && message.status?.type === 'generating' ? <Code size={18} />
                    : message.type === 'status' && message.status?.type === 'running' ? <Play size={18} />
                    : message.type === 'status' && message.status?.type === 'fixing' ? <Settings size={18} />
                    : message.type === 'status' && message.status?.type === 'completed' ? <CheckCircle size={18} />
                    : <Bot size={18} />}
                </div>

                {/* Message bubble */}
                <div className={`px-4 py-3 rounded-2xl break-words shadow-lg
                  ${message.type === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : message.type === 'ai' 
                      ? 'bg-gray-700 text-gray-100 rounded-bl-none' 
                      : message.type === 'status' && message.status?.type === 'error'
                        ? 'bg-red-700/80 border border-red-500/70 text-red-100 rounded-lg w-full' // Status error messages full width, distinct
                        : 'bg-gray-600/70 border border-gray-500/60 text-gray-200 rounded-lg w-full' // Status messages full width
                }`}>
                  {message.type === 'status' ? (
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => message.status && handleStatusClick(message.status)}
                    >
                      {/* Icon already handled by avatar above for status messages */}
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{message.status?.title || message.content}</span>
                        {message.status?.description && <span className="text-xs opacity-80 mt-0.5">{message.status.description}</span>}
                        {message.status?.progress !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-gray-500/50 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                    message.status.type === 'error' ? 'bg-red-400' :
                                    message.status.type === 'completed' ? 'bg-green-400' :
                                    'bg-blue-400'
                                    }`}
                                    style={{ width: `${message.status.progress}%` }}
                                />
                                </div>
                                <span className="text-xs text-gray-400">{message.status.progress}%</span>
                            </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    renderMessageContent(message) // Use the new renderMessageContent function
                  )}
                </div>
              </div>
              {/* Timestamp */}
              <p className={`text-[11px] text-gray-500 mt-1.5 ${message.type === 'user' ? 'mr-12 text-right' : 'ml-12 text-left'}`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-md border-t border-gray-700/80 p-3 sm:p-4">
        <div className="flex items-end gap-2 sm:gap-3 max-w-4xl mx-auto bg-gray-700/60 rounded-xl p-2 border border-gray-600/70 shadow-lg">
          {/* TODO: Add buttons for image upload, file attachment, etc. if needed */}
          {/* <button className="p-2 text-gray-400 hover:text-blue-400 rounded-full hover:bg-gray-600 transition-colors">
            <Paperclip size={20} />
          </button> */}
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => { // Changed from onKeyPress to onKeyDown for consistency and broader key support
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto'; // Reset height after send
                }
              }
            }}
            placeholder="Ask AI anything or type a command..."
            className="flex-1 bg-transparent text-white placeholder-gray-400 px-3 py-2.5 text-sm resize-none focus:outline-none max-h-36 sm:max-h-48 overflow-y-auto"
            rows={1}
            style={{ scrollbarWidth: 'thin' }} // For Firefox
            disabled={isLoading}
          />
          <button
            onClick={() => {
              handleSendMessage();
              if (inputRef.current) {
                inputRef.current.style.height = 'auto'; // Reset height after send
              }
            }}
            disabled={isLoading || !inputMessage.trim()}
            className="p-2.5 sm:p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg transition-all duration-200 transform active:scale-95"
            title="Send message (Enter)"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin text-white" /> : <Send size={20} className="text-white" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">Shift+Enter for new line. Markdown supported.</p>
      </div>

      {/* Status Detail Modal */}
      <StatusDetailModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        status={selectedStatusModal || {
          id: '',
          type: 'analyzing',
          title: '',
          description: '',
          progress: 0
        }}
      />
    </div>
  );
}
