import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Grid3X3, FileImage, Settings } from 'lucide-react';
import jsPDF from 'jspdf';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  processed?: string;
  unprocessed?: boolean;
}

interface PDFExportModalProps {
  images: UploadedImage[];
  isOpen: boolean;
  onClose: () => void;
}

type PageSize = 'a4' | 'letter' | 'a3';
type Orientation = 'portrait' | 'landscape';
type ImagesPerPage = 1 | 2 | 4 | 6;

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ images, isOpen, onClose }) => {
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [imagesPerPage, setImagesPerPage] = useState<ImagesPerPage>(1);
  const [includeOriginals, setIncludeOriginals] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [quality, setQuality] = useState([0.8]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set(images.map(img => img.id)));
  const [exportMode, setExportMode] = useState<'single' | 'separate'>('single');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Page dimensions in mm
  const getPageDimensions = () => {
    const sizes = {
      a4: { width: 210, height: 297 },
      letter: { width: 216, height: 279 },
      a3: { width: 297, height: 420 }
    };
    
    const size = sizes[pageSize];
    return orientation === 'portrait' 
      ? { width: size.width, height: size.height }
      : { width: size.height, height: size.width };
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImages(newSelection);
  };

  const getSelectedImagesList = () => {
    return images.filter(img => selectedImages.has(img.id));
  };

  const addImageToPDF = async (doc: jsPDF, imageUrl: string, x: number, y: number, width: number, height: number, caption?: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Calculate aspect ratio and fit image
        const imgAspect = img.width / img.height;
        const boxAspect = width / height;
        
        let drawWidth = width;
        let drawHeight = height;
        let drawX = x;
        let drawY = y;
        
        if (imgAspect > boxAspect) {
          // Image is wider - fit to width
          drawHeight = width / imgAspect;
          drawY = y + (height - drawHeight) / 2;
        } else {
          // Image is taller - fit to height
          drawWidth = height * imgAspect;
          drawX = x + (width - drawWidth) / 2;
        }
        
        // Add image to PDF
        doc.addImage(img, 'JPEG', drawX, drawY, drawWidth, drawHeight, undefined, 'FAST');
        
        // Add caption if enabled
        if (caption && showCaptions) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(caption, x + width / 2, y + height + 5, { align: 'center' });
        }
        
        resolve();
      };
      img.src = imageUrl;
    });
  };

  const createSinglePDF = async () => {
    const { width, height } = getPageDimensions();
    const doc = new jsPDF({
      orientation: orientation === 'portrait' ? 'p' : 'l',
      unit: 'mm',
      format: [width, height]
    });

    const selectedImagesList = getSelectedImagesList();
    const imagesToUse = includeOriginals ? selectedImagesList : selectedImagesList.filter(img => img.processed);
    
    if (imagesToUse.length === 0) {
      toast({
        title: "No images to export",
        description: "Please select images and apply processing first.",
        variant: "destructive"
      });
      return;
    }

    const margin = 10;
    const contentWidth = width - 2 * margin;
    const contentHeight = height - 2 * margin - (pageNumbers ? 10 : 0);
    
    // Calculate grid layout based on orientation
    let cols: number, rows: number;
    if (orientation === 'landscape') {
      // Landscape: arrange images horizontally (side by side)
      if (imagesPerPage === 1) { cols = 1; rows = 1; }
      else if (imagesPerPage === 2) { cols = 2; rows = 1; }
      else if (imagesPerPage === 4) { cols = 2; rows = 2; }
      else { cols = 3; rows = 2; } // 6 images
    } else {
      // Portrait: arrange images vertically (stacked)
      if (imagesPerPage === 1) { cols = 1; rows = 1; }
      else if (imagesPerPage === 2) { cols = 1; rows = 2; }
      else if (imagesPerPage === 4) { cols = 2; rows = 2; }
      else { cols = 2; rows = 3; } // 6 images
    }
    
    const cellWidth = contentWidth / cols - (cols > 1 ? 5 : 0);
    const cellHeight = contentHeight / rows - (rows > 1 ? 5 : 0) - (showCaptions ? 10 : 0);
    
    let imageIndex = 0;
    let pageNumber = 1;
    
    while (imageIndex < imagesToUse.length) {
      if (pageNumber > 1) {
        doc.addPage();
      }
      
      // Add page number if enabled
      if (pageNumbers) {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Page ${pageNumber}`, width - margin, height - 5, { align: 'right' });
      }
      
      // Add images to current page
      const promises: Promise<void>[] = [];
      for (let i = 0; i < imagesPerPage && imageIndex < imagesToUse.length; i++) {
        const img = imagesToUse[imageIndex];
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const x = margin + col * (cellWidth + 5);
        const y = margin + row * (cellHeight + 10);
        
        const imageUrl = includeOriginals ? img.preview : (img.processed || img.preview);
        const caption = showCaptions ? img.file.name : undefined;
        
        promises.push(addImageToPDF(doc, imageUrl, x, y, cellWidth, cellHeight, caption));
        imageIndex++;
      }
      
      await Promise.all(promises);
      pageNumber++;
    }

    // Save the PDF
    const filename = `${exportMode}_images_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    toast({
      title: "PDF Exported Successfully",
      description: `Downloaded ${filename} with ${imagesToUse.length} images.`
    });
  };

  const createSeparatePDFs = async () => {
    const selectedImagesList = getSelectedImagesList();
    const imagesToUse = includeOriginals ? selectedImagesList : selectedImagesList.filter(img => img.processed);
    
    if (imagesToUse.length === 0) {
      toast({
        title: "No images to export",
        description: "Please select images and apply processing first.",
        variant: "destructive"
      });
      return;
    }

    const { width, height } = getPageDimensions();
    
    for (const img of imagesToUse) {
      const doc = new jsPDF({
        orientation: orientation === 'portrait' ? 'p' : 'l',
        unit: 'mm',
        format: [width, height]
      });

      const margin = 20;
      const contentWidth = width - 2 * margin;
      const contentHeight = height - 2 * margin - (showCaptions ? 15 : 0);
      
      const imageUrl = includeOriginals ? img.preview : (img.processed || img.preview);
      const caption = showCaptions ? img.file.name : undefined;
      
      await addImageToPDF(doc, imageUrl, margin, margin, contentWidth, contentHeight, caption);
      
      const filename = `${img.file.name.replace(/\.[^/.]+$/, '')}.pdf`;
      doc.save(filename);
    }
    
    toast({
      title: "PDFs Exported Successfully",
      description: `Downloaded ${imagesToUse.length} individual PDF files.`
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      if (exportMode === 'single') {
        await createSinglePDF();
      } else {
        await createSeparatePDFs();
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error creating the PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const processedImages = images.filter(img => img.processed);
  const selectedCount = selectedImages.size;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export to PDF
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Settings */}
          <div className="space-y-6">
            {/* Export Mode */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Export Mode
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="single"
                    checked={exportMode === 'single'}
                    onChange={() => setExportMode('single')}
                    className="text-primary"
                  />
                  <Label htmlFor="single">Single PDF (all images)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="separate"
                    checked={exportMode === 'separate'}
                    onChange={() => setExportMode('separate')}
                    className="text-primary"
                  />
                  <Label htmlFor="separate">Separate PDFs (one per image)</Label>
                </div>
              </div>
            </Card>

            {/* Page Settings */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Page Settings</h3>
              <div className="space-y-4">
                <div>
                  <Label>Page Size</Label>
                  <Select value={pageSize} onValueChange={(value: PageSize) => setPageSize(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                      <SelectItem value="a3">A3 (297 × 420 mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(value: Orientation) => setOrientation(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {exportMode === 'single' && (
                  <div>
                    <Label>Images per Page</Label>
                    <Select value={imagesPerPage.toString()} onValueChange={(value) => setImagesPerPage(parseInt(value) as ImagesPerPage)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 image per page</SelectItem>
                        <SelectItem value="2">2 images per page</SelectItem>
                        <SelectItem value="4">4 images per page</SelectItem>
                        <SelectItem value="6">6 images per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Card>

            {/* Options */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Options</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Include Captions</Label>
                  <Switch checked={showCaptions} onCheckedChange={setShowCaptions} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Page Numbers</Label>
                  <Switch checked={pageNumbers} onCheckedChange={setPageNumbers} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Use Original Images</Label>
                  <Switch checked={includeOriginals} onCheckedChange={setIncludeOriginals} />
                </div>
                <div>
                  <Label>Image Quality: {Math.round(quality[0] * 100)}%</Label>
                  <Slider
                    value={quality}
                    onValueChange={setQuality}
                    max={1}
                    min={0.1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Image Selection */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Select Images ({selectedCount}/{images.length})
                </span>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedImages(new Set(images.map(img => img.id)))}
                  >
                    All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedImages(new Set())}
                  >
                    None
                  </Button>
                </div>
              </h3>

              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`relative p-2 border rounded-lg cursor-pointer transition-all ${
                      selectedImages.has(image.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleImageSelection(image.id)}
                  >
                    <img
                      src={image.preview}
                      alt={image.file.name}
                      className="w-full h-16 object-cover rounded mb-2"
                    />
                    <p className="text-xs text-muted-foreground truncate">
                      {image.file.name}
                    </p>
                    {!includeOriginals && !image.processed && (
                      <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-muted-foreground text-center">
                          Not processed
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!includeOriginals && processedImages.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No processed images available. Please process images first or enable "Use Original Images".
                </div>
              )}
            </Card>

            {/* Export Summary */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Export Summary</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• {selectedCount} images selected</p>
                <p>• {exportMode === 'single' ? '1 PDF file' : `${selectedCount} PDF files`}</p>
                <p>• {pageSize.toUpperCase()} {orientation}</p>
                {exportMode === 'single' && <p>• {imagesPerPage} image(s) per page</p>}
                <p>• Quality: {Math.round(quality[0] * 100)}%</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} image(s) ready to export` : 'No images selected'}
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0 || isExporting}
              className="min-w-24"
            >
              {isExporting ? (
                <>Exporting...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};