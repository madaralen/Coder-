'use client';

import { useState } from 'react';
import { Image as ImageIconLucide, Images } from 'lucide-react';
import SingleImageProcessor from './SingleImageProcessor';
import MultiImageUploader from './MultiImageUploader'; // Using the refactored component

// Define a more specific type for UploadedImage if it's passed up
// This should match or be compatible with the one in MultiImageUploader.tsx
interface UploadedImageInfo {
  id: string;
  name: string;
  size: number;
  localUrl: string;
  hostedUrl?: string;
  analysis?: string;
}

interface ImageToolsViewProps {
  onSingleImageAnalyzed: (analysis: string, imageUrl: string) => void;
  onMultiImagesAnalyzed: (images: UploadedImageInfo[], combinedAnalysis: string) => void;
}

type ImageToolMode = 'single' | 'multi';

export default function ImageToolsView({ 
  onSingleImageAnalyzed, 
  onMultiImagesAnalyzed 
}: ImageToolsViewProps) {
  const [mode, setMode] = useState<ImageToolMode>('single');

  return (
    <div className="flex flex-col h-full bg-gray-800 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex-shrink-0 pb-3 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Image Tools</h2>
        <p className="text-sm text-gray-400 mt-0.5">Analyze images to assist with code generation.</p>
      </div>

      {/* Mode Switcher */}
      <div className="flex-shrink-0 flex gap-2">
        <button
          onClick={() => setMode('single')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors
            ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
        >
          <ImageIconLucide size={16} className="inline mr-1.5 -mt-0.5" />
          Single Image
        </button>
        <button
          onClick={() => setMode('multi')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors
            ${mode === 'multi' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
        >
          <Images size={16} className="inline mr-1.5 -mt-0.5" />
          Multi-Image
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {mode === 'single' && (
          <SingleImageProcessor onImageAnalyzed={onSingleImageAnalyzed} />
        )}
        {mode === 'multi' && (
          <MultiImageUploader onImagesAnalyzed={onMultiImagesAnalyzed} maxImages={5} />
        )}
      </div>
    </div>
  );
}
