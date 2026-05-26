'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AudioLines, Upload, X } from 'lucide-react';

interface DropzoneProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  accept?: string;
  maxSize?: number; // in bytes
  placeholder?: string;
  showImagePreview?: boolean;
}

const AUDIO_EXTENSION_PATTERN = /\.(aac|aif|aiff|flac|m4a|mp3|ogg|wav)$/i;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAudioFormat = (file: File) => {
  const extension = file.name.split('.').pop()?.toUpperCase();
  const mimeSubtype = file.type.split('/')[1]?.toUpperCase();
  const format = extension || mimeSubtype || 'AUDIO';

  if (format === 'MPEG') return 'MP3';
  if (format === 'MP4') return extension === 'M4A' ? 'M4A' : 'MP4';

  return format;
};

const isAudioFile = (file: File, accept?: string) =>
  file.type.startsWith('audio/') ||
  AUDIO_EXTENSION_PATTERN.test(file.name) ||
  accept?.split(',').some(type => type.trim().startsWith('audio/'));

export function Dropzone({
  onFileSelect,
  selectedFile,
  accept,
  maxSize,
  placeholder = 'Drag and drop your file here',
  showImagePreview = false,
  id,
  className,
  disabled,
  ...props
}: DropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatedInputId = React.useId();
  const inputId = id ?? generatedInputId;
  const isImagePreview = showImagePreview && selectedFile?.type.startsWith('image/');
  const isAudioSelected = selectedFile && !isImagePreview && isAudioFile(selectedFile, accept);

  React.useEffect(() => {
    if (!isImagePreview || !selectedFile) {
      setPreviewUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setIsPreviewLoading(true);

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(() => {
      setIsPreviewLoading(false);
      previewTimeoutRef.current = null;
    }, 900);

    return () => {
      URL.revokeObjectURL(objectUrl);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    };
  }, [isImagePreview, selectedFile]);

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
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

  const selectFile = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      selectFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      selectFile(file);
    } else {
      onFileSelect(null);
      setError(null);
    }
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onFileSelect(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      id={inputId}
      type='file'
      className='sr-only'
      accept={accept}
      disabled={disabled}
      onChange={handleFileInput}
      {...props}
    />
  );

  if (isImagePreview && selectedFile) {
    return (
      <div
        className={cn(
          'relative grid size-40 max-w-full place-items-center overflow-hidden bg-muted',
          isDragging && 'bg-primary/5',
          disabled && 'opacity-60',
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fileInput}
        {previewUrl && (
          <img src={previewUrl} alt='Selected image preview' className='size-full object-contain' />
        )}
        {isPreviewLoading && (
          <svg
            className='absolute inset-0 size-full text-primary motion-reduce:hidden'
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            aria-hidden='true'
          >
            <rect
              x='0.8'
              y='0.8'
              width='98.4'
              height='98.4'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.6'
              pathLength='1'
              className='origin-center -rotate-90 animate-[dropzone-border-progress_900ms_ease-out_forwards]'
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
            />
          </svg>
        )}
        <button
          type='button'
          onClick={handleRemove}
          className='absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/85 text-foreground shadow-2xs backdrop-blur-xs transition hover:bg-background focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring'
          aria-label='Remove selected image'
        >
          <X className='size-4' />
        </button>
      </div>
    );
  }

  if (isAudioSelected && selectedFile) {
    return (
      <div
        className={cn(
          'relative w-full overflow-hidden border transition-colors',
          isDragging
            ? 'border-almostblack bg-almostblack text-white dark:border-white dark:bg-white dark:text-almostblack'
            : 'border-almostblack bg-white text-almostblack hover:bg-almostblack/[0.03] dark:border-white dark:bg-almostblack dark:text-white dark:hover:bg-white/[0.08]',
          disabled && 'opacity-60',
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fileInput}
        <div className='flex min-h-32 items-stretch'>
          <label
            htmlFor={inputId}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer items-center gap-4 p-4 text-left transition-colors sm:p-5',
              disabled && 'cursor-not-allowed'
            )}
            aria-label={`Selected audio file: ${selectedFile.name}. Click to replace.`}
          >
            <span
              className={cn(
                'grid size-14 shrink-0 place-items-center rounded-full border',
                isDragging
                  ? 'border-white/45 bg-white text-almostblack dark:border-almostblack/35 dark:bg-almostblack dark:text-white'
                  : 'border-almostblack bg-almostblack text-white dark:border-white dark:bg-white dark:text-almostblack'
              )}
              aria-hidden='true'
            >
              <AudioLines className='size-6' />
            </span>
            <span className='min-w-0 flex-1 space-y-2'>
              <span className='block font-mono text-[11px] uppercase tracking-[0.18em] opacity-70'>
                Audio attached
              </span>
              <span className='block truncate font-display text-h8 uppercase leading-none'>
                {selectedFile.name}
              </span>
              <span className='flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] opacity-75'>
                <span>{getAudioFormat(selectedFile)}</span>
                <span aria-hidden='true'>/</span>
                <span>{formatFileSize(selectedFile.size)}</span>
                <span aria-hidden='true'>/</span>
                <span>{isDragging ? 'Drop to replace' : 'Click to replace'}</span>
              </span>
            </span>
          </label>
          <div className='flex items-start p-3 sm:p-4'>
            <button
              type='button'
              onClick={handleRemove}
              className='grid size-9 place-items-center rounded-full border border-current bg-transparent transition-colors hover:bg-almostblack hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white dark:hover:text-almostblack'
              aria-label='Remove selected audio'
              disabled={disabled}
            >
              <X className='size-4' />
            </button>
          </div>
        </div>
        {error && <p className='px-4 pb-3 font-mono text-xs uppercase text-destructive'>{error}</p>}
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'relative flex h-32 w-full cursor-pointer flex-col items-center justify-center overflow-hidden border border-dashed transition-colors',
        isDragging
          ? 'border-border bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {fileInput}
      <div className='flex flex-col items-center justify-center text-center'>
        <Upload
          className={cn('mb-2 size-8', isDragging ? 'text-primary' : 'text-muted-foreground')}
        />
        {selectedFile ? (
          <div className='space-y-1'>
            <div className={cn('text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
              Selected: {selectedFile.name}
            </div>
            <div className='text-xs text-muted-foreground'>
              {selectedFile.size < 1024
                ? `${selectedFile.size} B`
                : selectedFile.size < 1024 * 1024
                  ? `${(selectedFile.size / 1024).toFixed(0)} KB`
                  : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
            </div>
          </div>
        ) : (
          <>
            <p className='text-sm font-medium'>{placeholder}</p>
            <p className='mt-1 text-xs text-muted-foreground'>or click to browse</p>
          </>
        )}
        {error && <p className='mt-1 text-xs text-destructive'>{error}</p>}
      </div>
    </label>
  );
}
