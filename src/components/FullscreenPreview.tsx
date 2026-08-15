import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut } from 'lucide-react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  processed?: string;
}

interface FullscreenPreviewProps {
  image: UploadedImage | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (imageUrl: string, filename: string) => void;
}

export const FullscreenPreview: React.FC<FullscreenPreviewProps> = ({
  image,
  isOpen,
  onClose,
  onDownload
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);

  if (!image) return null;

  const currentImageUrl = showOriginal ? image.preview : (image.processed || image.preview);
  const hasProcessed = !!image.processed;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(currentImageUrl, image.file.name);
    }
  };

  const resetZoom = () => setZoom(1);
  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold truncate">{image.file.name}</h3>
              <p className="text-sm text-muted-foreground">
                {(image.file.size / 1024 / 1024).toFixed(1)} MB • 
                {showOriginal ? ' Original' : hasProcessed ? ' Processed' : ' Original'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-background/50 rounded-md p-1">
                <Button variant="ghost" size="sm" onClick={zoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs min-w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="ghost" size="sm" onClick={zoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={resetZoom}>
                  Reset
                </Button>
              </div>

              {/* View Toggle */}
              {hasProcessed && (
                <Button
                  variant={showOriginal ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOriginal(!showOriginal)}
                >
                  {showOriginal ? 'Show Processed' : 'Show Original'}
                </Button>
              )}

              {/* Download */}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>

              {/* Close */}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Image Container */}
        <div className="pt-20 h-full flex items-center justify-center bg-muted/20 overflow-auto">
          <div 
            className="relative max-w-full max-h-full transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={currentImageUrl}
              alt={image.file.name}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(95vh - 120px)' }}
            />
          </div>
        </div>

        {/* Footer - Comparison */}
        {hasProcessed && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t p-4">
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <div className="relative h-16 bg-muted rounded overflow-hidden mb-2">
                  <img
                    src={image.preview}
                    alt="Original"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Original</p>
              </div>
              <div className="text-center">
                <div className="relative h-16 bg-muted rounded overflow-hidden mb-2">
                  <img
                    src={image.processed}
                    alt="Processed"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};