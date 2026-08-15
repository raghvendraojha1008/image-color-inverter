import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, RotateCcw, Palette, CheckCircle, RotateCw, FlipHorizontal, FlipVertical, Sun, Contrast, FileText, Maximize2, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { PDFExportModal } from './PDFExportModal';
import { FullscreenPreview } from './FullscreenPreview';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  processed?: string;
  unprocessed?: boolean; // Mark as unprocessed to export original
  selected?: boolean; // For batch selection
}

// Categorized operation types
type ColorFilter = 'invert' | 'grayscale' | 'sepia';
type Transform = 'rotate90' | 'rotate180' | 'rotate270' | 'flipH' | 'flipV';
type Adjustment = 'brightness' | 'contrast' | 'saturation';

interface ProcessingOptions {
  colorFilters: ColorFilter[];
  transforms: Transform[];
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
}

interface ImageProcessorProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export const ImageProcessor: React.FC<ImageProcessorProps> = ({ images, onImagesChange }) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<UploadedImage | null>(null);
  const { toast } = useToast();
  const downloadRef = useRef<HTMLAnchorElement>(null);
  
  // Separate state for each operation category
  const [selectedColorFilters, setSelectedColorFilters] = useState<ColorFilter[]>([]);
  const [selectedTransforms, setSelectedTransforms] = useState<Transform[]>([]);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  
  // Output quality settings
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [outputQuality, setOutputQuality] = useState(0.92); // 0-1 for JPEG/WebP

  const applyAllOperations = async (imageFile: File, options: ProcessingOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Determine canvas size based on transforms
        const hasRotate90or270 = options.transforms.some(t => t === 'rotate90' || t === 'rotate270');
        canvas.width = hasRotate90or270 ? img.height : img.width;
        canvas.height = hasRotate90or270 ? img.width : img.height;
        
        ctx!.save();
        
        // Apply transforms (rotation and flip)
        let rotation = 0;
        let flipH = 1;
        let flipV = 1;
        
        options.transforms.forEach(transform => {
          switch (transform) {
            case 'rotate90':
              rotation += Math.PI / 2;
              break;
            case 'rotate180':
              rotation += Math.PI;
              break;
            case 'rotate270':
              rotation += -Math.PI / 2;
              break;
            case 'flipH':
              flipH = -1;
              break;
            case 'flipV':
              flipV = -1;
              break;
          }
        });
        
        // Apply all transforms at once
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (rotation !== 0) ctx!.rotate(rotation);
        ctx!.scale(flipH, flipV);
        
        if (hasRotate90or270) {
          ctx!.drawImage(img, -img.width / 2, -img.height / 2);
        } else {
          ctx!.drawImage(img, -canvas.width / 2, -canvas.height / 2);
        }
        
        ctx!.restore();
        
        // Apply color filters and adjustments
        if (options.colorFilters.length > 0 || options.adjustments.brightness !== 0 || 
            options.adjustments.contrast !== 0 || options.adjustments.saturation !== 0) {
          const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply color filters in sequence
            options.colorFilters.forEach(filter => {
              switch (filter) {
                case 'invert':
                  r = 255 - r;
                  g = 255 - g;
                  b = 255 - b;
                  break;
                case 'grayscale':
                  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                  r = gray;
                  g = gray;
                  b = gray;
                  break;
                case 'sepia':
                  const tr = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                  const tg = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                  const tb = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                  r = tr; g = tg; b = tb;
                  break;
              }
            });
            
            // Apply brightness adjustment
            if (options.adjustments.brightness !== 0) {
              r = Math.max(0, Math.min(255, r + options.adjustments.brightness));
              g = Math.max(0, Math.min(255, g + options.adjustments.brightness));
              b = Math.max(0, Math.min(255, b + options.adjustments.brightness));
            }
            
            // Apply contrast adjustment
            if (options.adjustments.contrast !== 0) {
              const factor = (259 * (options.adjustments.contrast + 255)) / (255 * (259 - options.adjustments.contrast));
              r = Math.max(0, Math.min(255, factor * (r - 128) + 128));
              g = Math.max(0, Math.min(255, factor * (g - 128) + 128));
              b = Math.max(0, Math.min(255, factor * (b - 128) + 128));
            }
            
            // Apply saturation adjustment
            if (options.adjustments.saturation !== 0) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              const satFactor = (options.adjustments.saturation + 100) / 100;
              r = Math.max(0, Math.min(255, gray + (r - gray) * satFactor));
              g = Math.max(0, Math.min(255, gray + (g - gray) * satFactor));
              b = Math.max(0, Math.min(255, gray + (b - gray) * satFactor));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
          
          ctx!.putImageData(imageData, 0, 0);
        }
        
        // Convert to blob URL with selected format and quality
        const mimeType = outputFormat === 'png' ? 'image/png' : 
                        outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp';
        const quality = outputFormat === 'png' ? undefined : outputQuality;
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, mimeType, quality);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  };

  const toggleUnprocessed = (imageId: string) => {
    const updatedImages = images.map(img => {
      if (img.id === imageId) {
        const isNowUnprocessed = !img.unprocessed;
        // If marking as unprocessed, set processed to preview (original image)
        // If unmarking, clear processed so it can be reprocessed
        return { 
          ...img, 
          unprocessed: isNowUnprocessed,
          processed: isNowUnprocessed ? img.preview : undefined
        };
      }
      return img;
    });
    onImagesChange(updatedImages);
    
    const markedImage = updatedImages.find(img => img.id === imageId);
    toast({
      title: markedImage?.unprocessed ? "Marked as Unprocessed" : "Marked for Processing",
      description: markedImage?.unprocessed 
        ? "Original image will be used for export" 
        : "Image will be processed with selected operations",
    });
  };

  const deleteImage = (imageId: string) => {
    const imageToDelete = images.find(img => img.id === imageId);
    if (imageToDelete) {
      // Clean up object URLs to prevent memory leaks
      URL.revokeObjectURL(imageToDelete.preview);
      if (imageToDelete.processed) {
        URL.revokeObjectURL(imageToDelete.processed);
      }
    }
    
    const updatedImages = images.filter(img => img.id !== imageId);
    onImagesChange(updatedImages);
    
    toast({
      title: "Image Removed",
      description: "The image has been deleted from the list.",
    });
  };

  const processAllImages = async () => {
    if (images.length === 0) return;
    
    const hasOperations = selectedColorFilters.length > 0 || 
                         selectedTransforms.length > 0 || 
                         brightness !== 0 || 
                         contrast !== 0 || 
                         saturation !== 0;
    
    if (!hasOperations) {
      toast({
        title: "No operations selected",
        description: "Please select at least one filter, transform, or adjustment.",
        variant: "destructive",
      });
      return;
    }

    // Filter images to process (selected ones, or all if none selected)
    const selectedImages = images.filter(img => img.selected);
    const imagesToProcess = selectedImages.length > 0 ? selectedImages : images;

    setProcessing(true);
    setProgress(0);

    try {
      const processedImages = [...images];
      const options: ProcessingOptions = {
        colorFilters: selectedColorFilters,
        transforms: selectedTransforms,
        adjustments: {
          brightness,
          contrast,
          saturation,
        }
      };
      
      let processedCount = 0;
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        // Only process if image should be processed
        if (imagesToProcess.some(img => img.id === image.id)) {
          // Skip processing if marked as unprocessed
          if (image.unprocessed) {
            processedImages[i] = { ...image, processed: image.preview };
          } else {
            const processed = await applyAllOperations(image.file, options);
            processedImages[i] = { ...image, processed };
          }
          processedCount++;
        }
        
        setProgress(((i + 1) / images.length) * 100);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      onImagesChange(processedImages);
      
      const operationCount = selectedColorFilters.length + selectedTransforms.length + 
                            (brightness !== 0 ? 1 : 0) + (contrast !== 0 ? 1 : 0) + (saturation !== 0 ? 1 : 0);
      
      toast({
        title: "Success!",
        description: `${processedCount} image(s) processed with ${operationCount} operation(s).`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    if (!downloadRef.current) return;
    
    const operationsName = [
      ...selectedColorFilters,
      ...selectedTransforms,
      brightness !== 0 ? 'bright' : '',
      contrast !== 0 ? 'contrast' : '',
      saturation !== 0 ? 'sat' : ''
    ].filter(Boolean).join('_');
    
    const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    
    downloadRef.current.href = imageUrl;
    downloadRef.current.download = `${operationsName || 'processed'}_${baseName}.${extension}`;
    downloadRef.current.click();
  };

  const downloadAllAsZip = async () => {
    const processedImages = images.filter(img => img.processed);
    if (processedImages.length === 0) return;

    try {
      const zip = new JSZip();
      
      const operationsName = [
        ...selectedColorFilters,
        ...selectedTransforms,
        brightness !== 0 ? 'bright' : '',
        contrast !== 0 ? 'contrast' : '',
        saturation !== 0 ? 'sat' : ''
      ].filter(Boolean).join('_');
      
      const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
      
      for (const image of processedImages) {
        const response = await fetch(image.processed!);
        const blob = await response.blob();
        const baseName = image.file.name.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}_${operationsName || 'processed'}.${extension}`;
        zip.file(filename, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      if (downloadRef.current) {
        downloadRef.current.href = zipUrl;
        downloadRef.current.download = `${operationsName || 'processed'}_images.zip`;
        downloadRef.current.click();
      }

      toast({
        title: "Download Started",
        description: `Downloading ${processedImages.length} processed images as ZIP.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create ZIP file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetProcessing = () => {
    const resetImages = images.map(img => {
      if (img.processed) {
        URL.revokeObjectURL(img.processed);
      }
      return { ...img, processed: undefined };
    });
    onImagesChange(resetImages);
  };

  const resetAllSettings = () => {
    setSelectedColorFilters([]);
    setSelectedTransforms([]);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    resetProcessing();
  };

  const toggleColorFilter = (filter: ColorFilter) => {
    setSelectedColorFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const toggleTransform = (transform: Transform) => {
    setSelectedTransforms(prev => 
      prev.includes(transform) ? prev.filter(t => t !== transform) : [...prev, transform]
    );
  };

  const toggleImageSelection = (imageId: string) => {
    const updatedImages = images.map(img => 
      img.id === imageId ? { ...img, selected: !img.selected } : img
    );
    onImagesChange(updatedImages);
  };

  const selectAllImages = () => {
    const updatedImages = images.map(img => ({ ...img, selected: true }));
    onImagesChange(updatedImages);
  };

  const deselectAllImages = () => {
    const updatedImages = images.map(img => ({ ...img, selected: false }));
    onImagesChange(updatedImages);
  };

  const hasProcessedImages = images.some(img => img.processed);
  const allProcessed = images.length > 0 && images.every(img => img.processed);
  const hasActiveOperations = selectedColorFilters.length > 0 || selectedTransforms.length > 0 || 
                              brightness !== 0 || contrast !== 0 || saturation !== 0;
  const selectedCount = images.filter(img => img.selected).length;

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Processing Controls */}
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Multi-Operation Processing</h3>
              <p className="text-muted-foreground text-sm">
                {allProcessed 
                  ? 'All images have been processed!' 
                  : 'Select multiple operations to apply simultaneously'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {hasActiveOperations && (
                <Button variant="outline" onClick={resetAllSettings}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
              {hasProcessedImages && (
                <Button variant="outline" onClick={resetProcessing}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Images
                </Button>
              )}
              
              <Button 
                variant="gradient" 
                onClick={processAllImages}
                disabled={processing || !hasActiveOperations}
              >
                {processing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Palette className="h-4 w-4 mr-2" />
                    Apply {hasActiveOperations ? 'Operations' : 'Filter'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Active Operations Summary */}
          {hasActiveOperations && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Active:</span>
              {selectedColorFilters.map(filter => (
                <Badge key={filter} variant="secondary">{filter}</Badge>
              ))}
              {selectedTransforms.map(transform => (
                <Badge key={transform} variant="secondary">{transform}</Badge>
              ))}
              {brightness !== 0 && <Badge variant="secondary">brightness: {brightness > 0 ? '+' : ''}{brightness}</Badge>}
              {contrast !== 0 && <Badge variant="secondary">contrast: {contrast > 0 ? '+' : ''}{contrast}</Badge>}
              {saturation !== 0 && <Badge variant="secondary">saturation: {saturation > 0 ? '+' : ''}{saturation}</Badge>}
            </div>
          )}

          <Separator />

          {/* Color Filters */}
          <div>
            <h4 className="text-sm font-medium mb-3">Color Filters (select multiple)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Button
                variant={selectedColorFilters.includes('invert') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleColorFilter('invert')}
                className="text-xs"
              >
                <Palette className="h-3 w-3 mr-1" />
                Invert Colors
              </Button>
              <Button
                variant={selectedColorFilters.includes('grayscale') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleColorFilter('grayscale')}
                className="text-xs"
              >
                <Contrast className="h-3 w-3 mr-1" />
                Grayscale
              </Button>
              <Button
                variant={selectedColorFilters.includes('sepia') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleColorFilter('sepia')}
                className="text-xs"
              >
                📷 Sepia
              </Button>
            </div>
          </div>

          <Separator />

          {/* Transforms */}
          <div>
            <h4 className="text-sm font-medium mb-3">Transforms (select multiple)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Button
                variant={selectedTransforms.includes('rotate90') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTransform('rotate90')}
                className="text-xs"
              >
                <RotateCw className="h-3 w-3 mr-1" />
                Rotate 90°
              </Button>
              <Button
                variant={selectedTransforms.includes('rotate180') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTransform('rotate180')}
                className="text-xs"
              >
                🔄 Rotate 180°
              </Button>
              <Button
                variant={selectedTransforms.includes('rotate270') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTransform('rotate270')}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Rotate 270°
              </Button>
              <Button
                variant={selectedTransforms.includes('flipH') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTransform('flipH')}
                className="text-xs"
              >
                <FlipHorizontal className="h-3 w-3 mr-1" />
                Flip H
              </Button>
              <Button
                variant={selectedTransforms.includes('flipV') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTransform('flipV')}
                className="text-xs"
              >
                <FlipVertical className="h-3 w-3 mr-1" />
                Flip V
              </Button>
            </div>
          </div>

          <Separator />

          {/* Adjustments */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Adjustments</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="brightness" className="text-xs">Brightness</Label>
                <span className="text-xs text-muted-foreground">{brightness > 0 ? '+' : ''}{brightness}</span>
              </div>
              <Slider
                id="brightness"
                min={-100}
                max={100}
                step={1}
                value={[brightness]}
                onValueChange={(value) => setBrightness(value[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="contrast" className="text-xs">Contrast</Label>
                <span className="text-xs text-muted-foreground">{contrast > 0 ? '+' : ''}{contrast}</span>
              </div>
              <Slider
                id="contrast"
                min={-100}
                max={100}
                step={1}
                value={[contrast]}
                onValueChange={(value) => setContrast(value[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="saturation" className="text-xs">Saturation</Label>
                <span className="text-xs text-muted-foreground">{saturation > 0 ? '+' : ''}{saturation}</span>
              </div>
              <Slider
                id="saturation"
                min={-100}
                max={100}
                step={1}
                value={[saturation]}
                onValueChange={(value) => setSaturation(value[0])}
              />
            </div>
          </div>

          <Separator />

          {/* Output Quality Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Output Settings</h4>
            
            <div className="space-y-2">
              <Label htmlFor="format" className="text-xs">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={outputFormat === 'png' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutputFormat('png')}
                  className="text-xs"
                >
                  PNG
                </Button>
                <Button
                  variant={outputFormat === 'jpeg' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutputFormat('jpeg')}
                  className="text-xs"
                >
                  JPEG
                </Button>
                <Button
                  variant={outputFormat === 'webp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOutputFormat('webp')}
                  className="text-xs"
                >
                  WebP
                </Button>
              </div>
            </div>

            {(outputFormat === 'jpeg' || outputFormat === 'webp') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="quality" className="text-xs">Quality</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(outputQuality * 100)}%</span>
                </div>
                <Slider
                  id="quality"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={[outputQuality]}
                  onValueChange={(value) => setOutputQuality(value[0])}
                />
              </div>
            )}
          </div>

          {processing && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Processing {Math.round(progress)}%...
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Download Controls */}
      {hasProcessedImages && (
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Download Options</h3>
              <p className="text-muted-foreground text-sm">
                Export processed images individually, as ZIP, or PDF
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsPDFModalOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="success" onClick={downloadAllAsZip}>
                <Download className="h-4 w-4 mr-2" />
                Download All (ZIP)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Batch Selection Controls */}
      {images.length > 1 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Batch Selection</h4>
              {selectedCount > 0 && (
                <Badge variant="secondary">{selectedCount} selected</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllImages}>
                <Check className="h-3 w-3 mr-1" />
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllImages}>
                <X className="h-3 w-3 mr-1" />
                Deselect All
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {selectedCount > 0 
              ? `Processing will apply only to ${selectedCount} selected image(s)`
              : 'No images selected - processing will apply to all images'}
          </p>
        </Card>
      )}

      {/* Before/After Comparison */}
      <div className="grid gap-6">
        {images.map((image) => (
          <Card key={image.id} className="p-6 relative">
            {/* Checkbox for batch selection */}
            {images.length > 1 && (
              <div 
                className="absolute top-4 left-4 z-10 cursor-pointer bg-background/80 backdrop-blur-sm rounded-md p-2 hover:bg-background/95 transition-colors border border-border"
                onClick={() => toggleImageSelection(image.id)}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  image.selected 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground/50'
                }`}>
                  {image.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => deleteImage(image.id)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Original Image */}
              <div className="flex-1">
                <h4 className="font-medium mb-3 text-center">Original</h4>
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={image.preview}
                    alt={`Original ${image.file.name}`}
                    className="w-full h-64 object-contain"
                  />
                </div>
              </div>

              {/* Processed Image */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-center flex-1">Processed</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenImage(image)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    {image.processed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadImage(image.processed!, image.file.name)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  {image.processed ? (
                    <img
                      src={image.processed}
                      alt={`Processed ${image.file.name}`}
                      className="w-full h-64 object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Not processed yet</p>
                        <p className="text-xs mt-1">Select operations and click Apply</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {image.file.name} • {(image.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <Button
                variant={image.unprocessed ? "default" : "outline"}
                size="sm"
                onClick={() => toggleUnprocessed(image.id)}
              >
                {image.unprocessed ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Marked Unprocessed
                  </>
                ) : (
                  'Mark as Unprocessed'
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modals */}
      <PDFExportModal
        images={images}
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
      />
      
      <FullscreenPreview
        image={fullscreenImage}
        isOpen={!!fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        onDownload={downloadImage}
      />

      {/* Hidden download link */}
      <a ref={downloadRef} style={{ display: 'none' }} />
    </div>
  );
};