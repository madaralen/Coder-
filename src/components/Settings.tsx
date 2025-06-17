'use client';

import { useState, useEffect } from 'react';
import { 
  Monitor, 
  Palette, 
  Type, 
  Globe, 
  Shield, 
  Download,
  Upload,
  RotateCcw,
  Save,
} from 'lucide-react';

interface SettingsData {
  theme: 'dark' | 'light' | 'auto';
  fontSize: number;
  fontFamily: string;
  editorTheme: string;
  language: string;
  autoSave: boolean;
  showMinimap: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  tabSize: number;
  aiModel: string;
  terminalFontSize: number;
  soundEnabled: boolean;
}

const defaultSettings: SettingsData = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  editorTheme: 'vs-dark',
  language: 'en',
  autoSave: true,
  showMinimap: true,
  wordWrap: true,
  lineNumbers: true,
  tabSize: 2,
  aiModel: 'openai',
  terminalFontSize: 14,
  soundEnabled: true
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Get available models from environment variables
  const getAvailableModels = () => {
    const modelsString = process.env.NEXT_PUBLIC_AI_MODELS || 'openai,openai-fast,openai-large,qwen-coder,llama,mistral,deepseek-reasoning,grok,searchgpt';
    return modelsString.split(',').map(model => model.trim());
  };

  const availableModels = getAvailableModels();

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('coder-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const saveSettings = () => {
    localStorage.setItem('coder-settings', JSON.stringify(settings));
    setHasUnsavedChanges(false);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setHasUnsavedChanges(true);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `coder-settings-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setSettings({ ...defaultSettings, ...imported });
          setHasUnsavedChanges(true);
        } catch {
          alert('Error importing settings file');
        }
      };
      reader.readAsText(file);
    }
  };

  const SettingSection = ({ 
    title, 
    icon: Icon, 
    children 
  }: { 
    title: string; 
    icon: React.ComponentType<{ size?: number; className?: string }>; 
    children: React.ReactNode 
  }) => (
    // Adjusted section styling for better fit in sidebar
    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/70">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon size={18} className="text-blue-400" />
        <h3 className="text-md font-semibold text-gray-100">{title}</h3>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );

  const SettingRow = ({ 
    label, 
    description, 
    children 
  }: { 
    label: string; 
    description?: string; 
    children: React.ReactNode 
  }) => (
    // Simplified SettingRow for sidebar context, primarily vertical stacking
    <div className="border-t border-gray-600/50 pt-3 first:border-t-0 first:pt-0">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        <div className="flex-shrink-0">
          {children}
        </div>
      </div>
      {description && (
        <p className="text-xs text-gray-400 mt-1 pr-4">{description}</p>
      )}
    </div>
  );

  return (
    // Adjusted padding for sidebar context, removed mx-auto and max-w as sidebar controls width
    <div className="flex-1 bg-gray-800 overflow-y-auto text-white"> 
      <div className="p-4 space-y-6"> {/* Consistent padding and spacing */}
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-gray-400 text-sm mt-0.5">Customize your environment</p>
          </div>
          
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-yellow-400 text-xs font-medium animate-pulse">Unsaved</span>
            )}
            <button
              onClick={saveSettings}
              disabled={!hasUnsavedChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md text-sm font-medium transition-colors"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>

        <div className="space-y-6"> {/* Changed grid to space-y for better flow in sidebar */}
          {/* Appearance */}
          <SettingSection title="Appearance" icon={Palette}>
            <SettingRow 
              label="Theme" 
              description="Choose your preferred color scheme"
            >
              <select 
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value as 'dark' | 'light' | 'auto')}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[100px]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </SettingRow>

            <SettingRow 
              label="Editor Theme" 
              description="Code editor color theme"
            >
              <select 
                value={settings.editorTheme}
                onChange={(e) => updateSetting('editorTheme', e.target.value)}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[100px]"
              >
                <option value="vs-dark">VS Code Dark</option>
                <option value="vs-light">VS Code Light</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </SettingRow>
          </SettingSection>

          {/* Editor */}
          <SettingSection title="Editor" icon={Type}>
            <SettingRow 
              label="Font Family" 
              description="Font used in the code editor"
            >
              <select 
                value={settings.fontFamily}
                onChange={(e) => updateSetting('fontFamily', e.target.value)}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[120px]"
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Monaco">Monaco</option>
                <option value="Consolas">Consolas</option>
                <option value="Courier New">Courier New</option>
              </select>
            </SettingRow>

            <SettingRow 
              label="Font Size" 
              description="Editor font size in pixels"
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                  className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" // Styled range
                />
                <span className="text-xs w-8 text-center text-gray-300">{settings.fontSize}px</span>
              </div>
            </SettingRow>

            <SettingRow 
              label="Tab Size" 
              description="Number of spaces per tab"
            >
              <select 
                value={settings.tabSize}
                onChange={(e) => updateSetting('tabSize', parseInt(e.target.value))}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[90px]"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </SettingRow>

            <SettingRow 
              label="Show Minimap" 
              description="Display code minimap"
            >
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showMinimap}
                  onChange={(e) => updateSetting('showMinimap', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </SettingRow>

            <SettingRow 
              label="Word Wrap" 
              description="Wrap long lines"
            >
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.wordWrap}
                  onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </SettingRow>

            <SettingRow 
              label="Line Numbers" 
              description="Show line numbers"
            >
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lineNumbers}
                  onChange={(e) => updateSetting('lineNumbers', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </SettingRow>

            <SettingRow 
              label="Auto Save" 
              description="Automatically save files"
            >
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => updateSetting('autoSave', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </SettingRow>
          </SettingSection>

          {/* Terminal */}
          <SettingSection title="Terminal" icon={Monitor}>
            <SettingRow 
              label="Terminal Font Size" 
              description="Font size for terminal text"
            >
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={settings.terminalFontSize}
                  onChange={(e) => updateSetting('terminalFontSize', parseInt(e.target.value))}
                  className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" // Styled range
                />
                <span className="text-xs w-8 text-center text-gray-300">{settings.terminalFontSize}px</span>
              </div>
            </SettingRow>
          </SettingSection>

          {/* AI Assistant */}
          <SettingSection title="AI Assistant" icon={Shield}>
            <SettingRow 
              label="Default Model" 
              description="Preferred AI model for assistance"
            >
              <select 
                value={settings.aiModel}
                onChange={(e) => updateSetting('aiModel', e.target.value)}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[120px]"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {model.charAt(0).toUpperCase() + model.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </SettingRow>
          </SettingSection>

          {/* System */}
          <SettingSection title="System" icon={Globe}>
            <SettingRow 
              label="Language" 
              description="Interface language"
            >
              <select 
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="bg-gray-600 border border-gray-500 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[100px]"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </SettingRow>

            <SettingRow 
              label="Sound Effects" 
              description="Enable UI sound effects"
            >
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </SettingRow>
          </SettingSection>

          {/* Import/Export */}
          <SettingSection title="Backup & Restore" icon={Download}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={exportSettings}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm text-gray-200 transition-colors"
              >
                <Download size={14} />
                Export Settings
              </button>
              
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm text-gray-200 cursor-pointer transition-colors">
                <Upload size={14} />
                Import Settings
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={resetSettings}
                className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-md text-sm text-white transition-colors"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
            </div>
          </SettingSection>
        </div>
      </div>
    </div>
  );
}
