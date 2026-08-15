import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  processed?: string;
}

interface FileUploadProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ images, onImagesChange }) => {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages: UploadedImage[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file)
    }));
    
    onImagesChange([...images, ...newImages]);
  }, [images, onImagesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    maxFiles: 10,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const removeImage = (id: string) => {
    const updatedImages = images.filter(img => img.id !== id);
    onImagesChange(updatedImages);
  };

  const clearAll = () => {
    images.forEach(img => {
      URL.revokeObjectURL(img.preview);
      if (img.processed) URL.revokeObjectURL(img.processed);
    });
    onImagesChange([]);
  };

  return (
    <div className="space-y-6">
      <Card 
        {...getRootProps()}
        className={`border-2 border-dashed cursor-pointer transition-all duration-300 p-8 ${
          isDragActive || dragActive 
            ? 'border-primary bg-primary/5 shadow-medium' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={`p-4 rounded-full bg-gradient-primary/10 transition-colors ${
            isDragActive ? 'bg-gradient-primary/20' : ''
          }`}>
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? 'Drop images here' : 'Upload Images'}
            </h3>
            <p className="text-muted-foreground">
              Drag & drop images here, or <span className="text-primary font-medium">click to browse</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Supports JPG, PNG, GIF, WebP • Max 10 files
            </p>
          </div>
        </div>
      </Card>

      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Uploaded Images ({images.length})
            </h3>
            <Button variant="outline" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <Card key={image.id} className="p-3 group relative overflow-hidden">
                <div className="relative">
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full h-24 object-cover rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground truncate" title={image.file.name}>
                    {image.file.name}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <File className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {(image.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};