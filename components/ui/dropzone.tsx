'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';

interface DropzoneProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  accept?: string;
  maxSize?: number; // in bytes
  placeholder?: string;
}

export function Dropzone({
  onFileSelect,
  selectedFile,
  accept,
  maxSize,
  placeholder = 'Drag and drop your file here',
  className,
  ...props
}: DropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const validateFile = (file: File): boolean => {
    if (accept) {
      // Split accept string by comma and check if file type matches any of them
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const isValidType = acceptedTypes.some(acceptedType => {
        // Handle wildcard patterns like "audio/*"
        if (acceptedType.endsWith('/*')) {
          const category = acceptedType.slice(0, -2);
          return file.type.startsWith(category + '/');
        }
        // Handle exact MIME type matches
        return file.type === acceptedType;
      });

      if (!isValidType) {
        // More user-friendly error messages
        if (acceptedTypes.some(type => type.startsWith('audio'))) {
          setError(`Please select an audio file (MP3, WAV, M4A, AAC, or FLAC)`);
        } else if (acceptedTypes.some(type => type.startsWith('image'))) {
          setError(`Please select an image file (JPG, PNG, or WebP)`);
        } else {
          setError(`File type not supported. Please upload: ${acceptedTypes.join(', ')}`);
        }
        return false;
      }
    }

    if (maxSize && file.size > maxSize) {
      setError(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateFile(file); // This sets error state if invalid
      onFileSelect(file); // Always select the file
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      onFileSelect(file);
    } else {
      onFileSelect(null);
      setError(null);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={cn(
        'cursor-pointer relative flex flex-col items-center justify-center w-full h-32 border border-dashed transition-colors',
        isDragging
          ? 'border-border bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type='file'
        className='hidden'
        accept={accept}
        onChange={handleFileInput}
        {...props}
      />
      <div className='flex flex-col items-center justify-center text-center'>
        <Upload
          className={cn('h-8 w-8 mb-2', isDragging ? 'text-primary' : 'text-muted-foreground')}
        />
        {selectedFile ? (
          <div className='space-y-1'>
            <div className={cn('text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
              Selected: {selectedFile.name}
            </div>
            <div className='text-xs text-muted-foreground'>
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
            </div>
          </div>
        ) : (
          <>
            <p className='text-sm font-medium'>{placeholder}</p>
            <p className='text-xs text-muted-foreground mt-1'>or click to browse</p>
          </>
        )}
        {error && <p className='text-xs text-destructive mt-1'>{error}</p>}
      </div>
    </div>
  );
}
