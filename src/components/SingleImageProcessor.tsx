'use client';

import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader, Download, UploadCloud } from 'lucide-react'; // Added UploadCloud
import Image from 'next/image';
// Removed motion and AnimatePresence as it's no longer a modal

interface SingleImageProcessorProps {
  onImageAnalyzed: (analysis: string, imageUrl: string) => void;
  // Removed onClose and isOpen as it's embedded
}

interface UploadedImage {
  file: File;
  url: string;
  name: string;
  size: number;
}

export default function SingleImageProcessor({ onImageAnalyzed }: SingleImageProcessorProps) {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file'); // Consider a more integrated notification system later
      return;
    }

    const url = URL.createObjectURL(file);
    setUploadedImage({
      file,
      url,
      name: file.name,
      size: file.size
    });
    setAnalysisResult(''); // Clear previous analysis
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const uploadToTemporaryHosting = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      // Using imgbb as a temporary hosting solution - REPLACE with actual key or service
      // IMPORTANT: This API key is a placeholder and will not work.
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "your-imgbb-api-key-placeholder";
      if (apiKey === "your-imgbb-api-key-placeholder") {
          console.warn("ImgBB API Key is a placeholder. Image upload will likely fail or use local URL.");
          // Fallback to local URL if no real API key is provided
          return URL.createObjectURL(file);
      }
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('ImgBB upload failed:', response.status, errorData);
        throw new Error(`Failed to upload image to ImgBB: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.data && data.data.url) {
        return data.data.url;
      } else {
        throw new Error('ImgBB response did not contain image URL.');
      }
    } catch (error) {
      console.error('Image upload failed, using local URL as fallback:', error);
      return URL.createObjectURL(file); // Fallback to local URL
    }
  };

  const analyzeImage = async () => {
    if (!uploadedImage) return;

    setIsAnalyzing(true);
    setAnalysisResult(''); // Clear previous results
    try {
      const imageUrl = await uploadToTemporaryHosting(uploadedImage.file);

      const payload = {
        model: "openai-large", // Consider making this configurable via settings
        messages: [
          {
            role: "system",
            content: "You are an expert image analyzer. Describe the image in detail including subject, style, composition, colors, lighting, and any notable elements. Provide a comprehensive analysis that will be used as context for further conversation about code generation or technical implementation."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image thoroughly and provide a detailed description. Include all visual elements, style, composition, colors, objects, people, text, and any other notable features. Describe the image in high details and tell me what could be implemented or coded based on this image."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000, // Reduced max_tokens for faster response in sidebar context
        token: process.env.NEXT_PUBLIC_POLLINATIONS_TOKEN || "L0jejdsYQOrz1lFp", // Placeholder
        referrer: process.env.NEXT_PUBLIC_POLLINATIONS_REFERRER || "L0jejdsYQOrz1lFp" // Placeholder
      };
      
      const pollinationsApiUrl = process.env.NEXT_PUBLIC_POLLINATIONS_API_URL || 'https://text.pollinations.ai/openai';

      const response = await fetch(pollinationsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Referer and token might be specific to Pollinations; ensure they are correctly set if required
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pollinations API Error:", response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
      }

      const responseText = await response.text();
      let analysis = responseText;
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.choices && jsonResponse.choices[0] && jsonResponse.choices[0].message) {
          analysis = jsonResponse.choices[0].message.content;
        }
      } catch (parseError) {
        console.warn('Could not parse AI response as JSON, using raw text:', parseError);
      }

      setAnalysisResult(analysis);
      onImageAnalyzed(analysis, imageUrl); // Callback with analysis and hosted/local URL

    } catch (error) {
      console.error('Error analyzing image:', error);
      setAnalysisResult(`Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage.url);
    }
    setUploadedImage(null);
    setAnalysisResult('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Main component render - no longer a modal
  return (
    <div className="space-y-4 p-1"> {/* Added padding and spacing for embedded view */}
      {!uploadedImage ? (
        // Upload Area
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${dragOver 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-gray-600 hover:border-gray-500 bg-gray-700/30 hover:bg-gray-700/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadCloud size={40} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-md font-medium mb-1 text-gray-200">Upload Image for Analysis</h3>
          <p className="text-xs text-gray-400 mb-3">
            Drag & drop an image here, or click to select.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
          >
            Select Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-3">
            Supports: PNG, JPG, GIF, WebP
          </p>
        </div>
      ) : (
        // Image Preview and Analysis
        <div className="space-y-4">
          {/* Image Info and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-700/50 p-3 rounded-lg border border-gray-600/70">
            <div className="min-w-0">
              <h3 className="font-medium text-gray-100 truncate" title={uploadedImage.name}>{uploadedImage.name}</h3>
              <p className="text-xs text-gray-400">
                {formatFileSize(uploadedImage.size)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={analyzeImage}
                disabled={isAnalyzing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
              <button
                onClick={clearImage}
                className="p-2 hover:bg-gray-600 rounded-md text-red-400 hover:text-red-300 transition-colors"
                title="Remove Image"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Image Preview */}
          <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
            <h4 className="font-medium text-gray-300 mb-2 text-sm">Preview</h4>
            <div className="bg-gray-900/50 rounded-md p-2 flex justify-center items-center max-h-60 overflow-hidden">
              <Image
                src={uploadedImage.url}
                alt={`Preview of ${uploadedImage.name}`}
                width={200} // Adjusted for sidebar view
                height={200} // Adjusted for sidebar view
                className="max-w-full max-h-56 object-contain rounded"
              />
            </div>
          </div>

          {/* Analysis Result */}
          {(isAnalyzing || analysisResult) && (
            <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/50">
              <h4 className="font-medium text-gray-300 mb-2 text-sm">Analysis Result</h4>
              <div className="bg-gray-900/50 rounded-md p-3 max-h-60 overflow-y-auto custom-scrollbar text-xs">
                {isAnalyzing && !analysisResult ? ( // Show loader only if no previous result
                  <div className="flex flex-col items-center justify-center h-20">
                    <Loader size={24} className="animate-spin text-gray-400" />
                    <p className="text-gray-400 mt-2">Analyzing image...</p>
                  </div>
                ) : analysisResult ? (
                  <pre className="whitespace-pre-wrap text-gray-300">{analysisResult}</pre>
                ) : null}
              </div>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => navigator.clipboard.writeText(analysisResult)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded-md text-sm transition-colors"
              >
                <Download size={14} />
                Copy Analysis
              </button>
              {/* "Use in Chat" button is implicitly handled by onImageAnalyzed callback now */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
