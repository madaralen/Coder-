'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, Loader, Send, Trash2, UploadCloud } from 'lucide-react'; // Added UploadCloud
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface UploadedImage {
  id: string;
  file: File;
  localUrl: string;
  hostedUrl?: string;
  analysis?: string;
  isAnalyzing: boolean;
  isUploading: boolean;
  name: string;
  size: number;
}

interface MultiImageUploaderProps {
  onImagesAnalyzed: (images: UploadedImage[], combinedAnalysis: string) => void;
  maxImages?: number;
}

export default function MultiImageUploader({ onImagesAnalyzed, maxImages = 5 }: MultiImageUploaderProps) { // Reduced default maxImages for sidebar
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // This state is for the final "Send & Analyze" step
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToTemporaryHosting = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "your-imgbb-api-key-placeholder";
      if (apiKey === "your-imgbb-api-key-placeholder") {
          console.warn("ImgBB API Key is a placeholder for MultiImageUploader. Image upload will likely fail or use local URL.");
          return URL.createObjectURL(file);
      }
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('ImgBB upload failed');
      const data = await response.json();
      if (data && data.data && data.data.url) return data.data.url;
      throw new Error('ImgBB response malformed');
    } catch (error) {
      console.error('ImgBB upload failed, using local URL:', error);
      return URL.createObjectURL(file);
    }
  }, []);


  const analyzeSingleImageAI = useCallback(async (imageUrl: string): Promise<string> => {
    try {
      const pollinationsApiUrl = process.env.NEXT_PUBLIC_POLLINATIONS_API_URL || 'https://text.pollinations.ai/openai';
      const response = await fetch(pollinationsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai-large',
          messages: [
            { role: 'system', content: 'You are an expert image analyzer. Provide detailed analysis of images including content, style, technical details, and potential implementation ideas.' },
            { role: 'user', content: [{ type: 'text', text: 'Analyze this image in detail.' }, { type: 'image_url', image_url: { url: imageUrl } }] }
          ],
          max_tokens: 500 // Reduced for individual analysis in multi-upload
        })
      });
      if (!response.ok) throw new Error(`Analysis failed: ${response.status}`);
      const responseText = await response.text();
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.choices?.[0]?.message?.content) return jsonResponse.choices[0].message.content;
      } catch { /* Fall through to use raw text */ }
      return responseText;
    } catch (error) {
      console.error('Image analysis failed:', error);
      return `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }, []);

  const processSingleImage = useCallback(async (imageId: string) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, isUploading: true, isAnalyzing: false } : img));
    
    const imageToProcess = images.find(img => img.id === imageId);
    if (!imageToProcess) return;

    try {
      const hostedUrl = await uploadToTemporaryHosting(imageToProcess.file);
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, hostedUrl, isUploading: false, isAnalyzing: true } : img));
      
      const analysis = await analyzeSingleImageAI(hostedUrl);
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, analysis, isAnalyzing: false } : img));
    } catch (error) {
      console.error('Error processing image:', imageId, error);
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, isUploading: false, isAnalyzing: false, analysis: "Processing failed." } : img));
    }
  }, [images, uploadToTemporaryHosting, analyzeSingleImageAI]); // Added images to dependency array

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const currentImageCount = images.length;
    const filesArray = Array.from(selectedFiles).slice(0, maxImages - currentImageCount);
    
    const newImageEntries: UploadedImage[] = filesArray
      .filter(file => file.type.startsWith('image/'))
      .map(file => {
        const imageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return {
          id: imageId,
          file,
          localUrl: URL.createObjectURL(file),
          isAnalyzing: false,
          isUploading: false,
          name: file.name,
          size: file.size,
        };
      });

    if (newImageEntries.length > 0) {
      setImages(prev => [...prev, ...newImageEntries]);
      // Process each newly added image
      newImageEntries.forEach(imgEntry => processSingleImage(imgEntry.id));
    }
  }, [images.length, maxImages, processSingleImage]);

  const removeImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) URL.revokeObjectURL(image.localUrl);
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSendAndAnalyzeAll = () => {
    if (images.length === 0 || images.some(img => img.isUploading || img.isAnalyzing)) return;

    setIsProcessing(true);
    const combinedAnalyses = images
      .map((img, index) => `Image ${index + 1} (${img.name}):\n${img.analysis || 'No analysis available.'}`)
      .join('\n\n---\n\n');
    
    const fullPrompt = `I've uploaded ${images.length} image(s). Here are their individual analyses:\n\n${combinedAnalyses}\n\nBased on all these images and their analyses, please provide a comprehensive summary, identify common themes or elements, and suggest potential project ideas or technical implementations that could be derived from them collectively.`;

    onImagesAnalyzed(images, fullPrompt);
    
    // Optionally clear images after sending
    // images.forEach(img => URL.revokeObjectURL(img.localUrl));
    // setImages([]);
    setIsProcessing(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const allIndividualAnalysesDone = images.length > 0 && images.every(img => !img.isUploading && !img.isAnalyzing && img.analysis);

  return (
    <div className="w-full space-y-3 p-1"> {/* Added padding */}
      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200
            ${dragOver 
              ? 'border-blue-500 bg-blue-500/10 scale-105' 
              : 'border-gray-600 hover:border-gray-500 bg-gray-700/30 hover:bg-gray-700/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-1">
            <UploadCloud size={28} className="text-gray-400" />
            <p className="text-sm text-gray-300">
              Drop images or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:text-blue-300 underline font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500">
              {images.length}/{maxImages} images selected
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {/* Image Grid */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3" // Adjusted grid for sidebar
          >
            {images.map((image) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-gray-700/50 rounded-md overflow-hidden border border-gray-600/70 shadow-sm"
              >
                <div className="aspect-square relative">
                  <Image src={image.localUrl} alt={image.name} fill className="object-cover" />
                  {(image.isUploading || image.isAnalyzing) && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-1">
                      <Loader size={18} className="animate-spin text-white" />
                      <p className="text-xs text-white mt-1 text-center">
                        {image.isUploading ? 'Uploading...' : 'Analyzing...'}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => removeImage(image.id)}
                    className="absolute top-1 right-1 p-0.5 bg-red-600/80 hover:bg-red-500 rounded-full text-white"
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                  {image.analysis && !image.isAnalyzing && (
                     <div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 rounded-full" title="Analyzed"></div>
                  )}
                   {image.analysis === "Processing failed." && !image.isAnalyzing && (
                     <div className="absolute bottom-1 left-1 w-2 h-2 bg-red-400 rounded-full" title="Analysis Failed"></div>
                  )}
                </div>
                <div className="p-1.5 text-xs">
                  <p className="text-gray-300 truncate" title={image.name}>{image.name}</p>
                  <p className="text-gray-500">{formatFileSize(image.size)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Button Area */}
      {images.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-2.5 bg-gray-700/50 rounded-lg border border-gray-600/70 mt-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ImageIcon size={16} />
            <span>{images.length} image{images.length > 1 ? 's' : ''}</span>
            {!allIndividualAnalysesDone && images.some(im => im.isUploading || im.isAnalyzing) && <Loader size={14} className="animate-spin" />}
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                images.forEach(img => URL.revokeObjectURL(img.localUrl));
                setImages([]);
              }}
              className="p-1.5 text-gray-400 hover:text-red-400 rounded-md transition-colors"
              title="Clear all images"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={handleSendAndAnalyzeAll}
              disabled={!allIndividualAnalysesDone || isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            >
              <Send size={14} />
              Send All
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
