import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ImageProcessor } from '@/components/ImageProcessor';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Palette, Zap } from 'lucide-react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  processed?: string;
}

const Index = () => {
  const [images, setImages] = useState<UploadedImage[]>([]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-primary">
                <Palette className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                  Image Color Inverter
                </h1>
                <p className="text-sm text-muted-foreground">
                  Client-side processing • No data leaves your device
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Zap className="h-4 w-4" />
              Fast • Secure • Browser-based
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Upload, Process & Download
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Invert colors of multiple images instantly. No uploads to servers - 
              everything happens securely in your browser.
            </p>
          </div>

          {/* File Upload Section */}
          <section>
            <FileUpload images={images} onImagesChange={setImages} />
          </section>

          {/* Image Processing Section */}
          <section>
            <ImageProcessor images={images} onImagesChange={setImages} />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span className="text-sm">Built with modern web technologies</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Privacy-first • No data collection • All processing happens locally
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;