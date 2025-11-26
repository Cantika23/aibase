import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UploadedFile {
  originalName: string;
  fileName: string;
  size: number;
  type: string;
  path: string;
}

export interface UploadResponse {
  success: boolean;
  files?: UploadedFile[];
  error?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export interface FileListResponse {
  success: boolean;
  files?: FileInfo[];
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileUploadService {
  private baseUrl: string;

  constructor(private http: HttpClient) {
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      return `${protocol}//${host}`;
    }
    return 'http://localhost:5040';
  }

  /**
   * Upload files for a specific client
   */
  uploadFiles(clientId: string, files: File[]): Observable<UploadResponse> {
    const formData = new FormData();

    // Add files to form data
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const url = `${this.baseUrl}/upload?clientId=${encodeURIComponent(clientId)}`;

    return this.http.post<UploadResponse>(url, formData);
  }

  /**
   * Upload a single file as base64 (for WebSocket messages)
   */
  uploadFileAsBase64(file: File): Observable<{ name: string; size: number; type: string; data: string }> {
    return from(this.readFileAsBase64(file)).pipe(
      map(base64Data => ({
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data
      }))
    );
  }

  /**
   * List files for a client
   */
  listFiles(clientId: string): Observable<FileListResponse> {
    const url = `${this.baseUrl}/files?clientId=${encodeURIComponent(clientId)}`;
    return this.http.get<FileListResponse>(url);
  }

  /**
   * Download a file
   */
  downloadFile(clientId: string, fileName: string): Observable<Blob> {
    const url = `${this.baseUrl}/files/${encodeURIComponent(fileName)}?clientId=${encodeURIComponent(clientId)}`;
    return this.http.get(url, { responseType: 'blob' });
  }

  /**
   * Read file as base64
   */
  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = result.split(',')[1] || result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if file is an image
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Check if file is a text file
   */
  isTextFile(file: File): boolean {
    const textTypes = [
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'text/markdown',
      'application/json',
      'application/xml'
    ];
    return textTypes.includes(file.type) || file.name.match(/\.(txt|md|json|js|ts|html|css|xml|yaml|yml)$/i) !== null;
  }

  /**
   * Get file extension
   */
  getFileExtension(file: File): string {
    const name = file.name.toLowerCase();
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }
}