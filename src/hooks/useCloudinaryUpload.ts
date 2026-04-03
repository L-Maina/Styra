'use client';

import { useState, useCallback } from 'react';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  result: {
    url: string;
    publicId: string;
    width: number;
    height: number;
  } | null;
}

interface UseCloudinaryUploadOptions {
  type?: 'avatar' | 'logo' | 'portfolio' | 'cover' | 'service';
  onSuccess?: (result: UploadState['result']) => void;
  onError?: (error: string) => void;
}

export function useCloudinaryUpload(options: UseCloudinaryUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const upload = useCallback(async (file: File) => {
    setState({
      isUploading: true,
      progress: 0,
      error: null,
      result: null,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', options.type || 'general');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setState({
        isUploading: false,
        progress: 100,
        error: null,
        result: data.data,
      });

      options.onSuccess?.(data.data);
      return data.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        result: null,
      });
      options.onError?.(errorMessage);
      throw error;
    }
  }, [options.type, options.onSuccess, options.onError]);

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
}

// Hook for multiple file uploads
export function useMultipleUploads(options: UseCloudinaryUploadOptions = {}) {
  const [uploads, setUploads] = useState<Map<string, UploadState>>(new Map());

  const uploadFile = useCallback(async (file: File, id?: string) => {
    const fileId = id || file.name;

    setUploads(prev => new Map(prev).set(fileId, {
      isUploading: true,
      progress: 0,
      error: null,
      result: null,
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', options.type || 'general');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploads(prev => new Map(prev).set(fileId, {
        isUploading: false,
        progress: 100,
        error: null,
        result: data.data,
      }));

      options.onSuccess?.(data.data);
      return { id: fileId, result: data.data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploads(prev => new Map(prev).set(fileId, {
        isUploading: false,
        progress: 0,
        error: errorMessage,
        result: null,
      }));
      options.onError?.(errorMessage);
      throw error;
    }
  }, [options]);

  const uploadMultiple = useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(file => uploadFile(file)));
    return results;
  }, [uploadFile]);

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  const isAnyUploading = Array.from(uploads.values()).some(u => u.isUploading);
  const allResults = Array.from(uploads.entries())
    .filter(([, state]) => state.result)
    .map(([id, state]) => ({ id, ...state.result! }));

  return {
    uploads,
    uploadFile,
    uploadMultiple,
    clearUploads,
    isAnyUploading,
    allResults,
  };
}
