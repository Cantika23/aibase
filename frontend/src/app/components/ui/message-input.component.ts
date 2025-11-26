import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MessageInputFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  data?: string; // Base64 encoded file data
}

export interface MessageInputVoiceRecording {
  isRecording: boolean;
  duration: number;
  blob?: Blob;
  url?: string;
  transcription?: string;
}

export interface MessageInputOptions {
  submitOnEnter?: boolean;
  enableInterrupt?: boolean;
  allowAttachments?: boolean;
  allowVoiceInput?: boolean;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxRows?: number;
}

@Component({
  selector: 'zard-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="message-input-container"
      [class.drag-over]="isDragOver"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <!-- File Upload Overlay -->
      @if (options?.allowAttachments && isDragOver) {
        <div class="file-upload-overlay">
          <svg class="overlay-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 6v11.5a4 4 0 01-8 0V5a2.5 2.5 0 015 0v10.5a1 1 0 01-2 0V6H10v9.5a2.5 2.5 0 005 0V5a4 4 0 00-8 0v12.5a5.5 5.5 0 0011 0V6h-1.5z"/>
          </svg>
          <span>Drop your files here to attach them.</span>
        </div>
      }

      <!-- Recording Controls Overlay -->
      @if (voiceRecording?.isRecording || isTranscribing) {
        <div class="recording-controls-overlay">
          @if (voiceRecording?.isRecording) {
            <div class="recording-visualizer" (click)="stopRecording()">
              <div class="recording-indicator">
                <div class="recording-pulse"></div>
                <span>Recording... {{ formatDuration(voiceRecording?.duration || 0) }}</span>
              </div>
              <div class="audio-waves">
                <div class="wave-bar" style="animation-delay: 0s"></div>
                <div class="wave-bar" style="animation-delay: 0.1s"></div>
                <div class="wave-bar" style="animation-delay: 0.2s"></div>
                <div class="wave-bar" style="animation-delay: 0.3s"></div>
                <div class="wave-bar" style="animation-delay: 0.4s"></div>
              </div>
            </div>
          } @else if (isTranscribing) {
            <div class="transcribing-overlay">
              <div class="transcribing-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-pulse"></div>
              </div>
              <p>Transcribing audio...</p>
            </div>
          }
        </div>
      }

      <!-- Main Input Container -->
      <div class="message-input-wrapper">
        <!-- Text Area with File Attachments -->
        <div class="textarea-container">
          <textarea
            #textarea
            [(ngModel)]="value"
            (ngModelChange)="onValueChange($event)"
            (keydown)="onKeyDown($event)"
            (input)="autoResize()"
            (focus)="onFocus()"
            (blur)="onBlur()"
            (paste)="onPaste($event)"
            [placeholder]="options?.placeholder || 'Ask AI...'"
            [disabled]="disabled || (options?.disabled || false) || (voiceRecording?.isRecording || false)"
            [rows]="options?.rows || 1"
            class="message-textarea"
            [class.has-attachments]="options?.allowAttachments && files.length > 0"
            [class.voice-input-active]="voiceRecording?.isRecording"
            [attr.max-rows]="options?.maxRows || 5"
            [attr.aria-label]="'Write your prompt here'"
          ></textarea>

          <!-- File Attachments Preview -->
          @if (options?.allowAttachments && files.length > 0) {
            <div class="file-attachments-preview">
              @for (file of files; track file.id) {
                <div class="file-attachment-item">
                  @if (file.preview) {
                    <img [src]="file.preview" [alt]="file.name" class="file-preview" />
                  } @else {
                    <div class="file-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                  }
                  <div class="file-details">
                    <span class="file-name" [title]="file.name">{{ file.name }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                  <button
                    type="button"
                    class="file-remove"
                    (click)="removeFile(file.id)"
                    [attr.aria-label]="'Remove ' + file.name"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <!-- Attachment Button -->
          @if (options?.allowAttachments && !voiceRecording?.isRecording) {
            <button
              type="button"
              class="action-button attachment-button"
              (click)="triggerFileInput()"
              [attr.aria-label]="'Attach a file'"
              [disabled]="disabled || options?.disabled || false"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5a4 4 0 01-8 0V5a2.5 2.5 0 015 0v10.5a1 1 0 01-2 0V6H10v9.5a2.5 2.5 0 005 0V5a4 4 0 00-8 0v12.5a5.5 5.5 0 0011 0V6h-1.5z"/>
              </svg>
            </button>
          }

          <!-- Voice Input Button -->
          @if (options?.allowVoiceInput && !isGenerating && !hasValidContent) {
            <button
              type="button"
              [class]="voiceRecording?.isRecording ? 'action-button voice-button-active' : 'action-button voice-button'"
              (click)="toggleVoiceRecording()"
              [attr.aria-label]="voiceRecording?.isRecording ? 'Stop recording' : 'Voice input'"
              [disabled]="disabled || options?.disabled || false"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          }

          <!-- Stop Generation Button -->
          @if (isGenerating) {
            <button
              type="button"
              class="action-button stop-button"
              (click)="onStopGeneration()"
              [attr.aria-label]="'Stop generating'"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
          } @else {
            <!-- Send Button -->
            <button
              type="button"
              class="action-button send-button"
              (click)="onSubmit()"
              [attr.aria-label]="'Send message'"
              [disabled]="disabled || (options?.disabled || false) || (!hasValidContent && !(options?.allowVoiceInput || false))"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          }
        </div>

        <!-- Hidden File Input -->
        @if (options?.allowAttachments) {
          <input
            #fileInput
            type="file"
            [multiple]="true"
            [accept]="acceptedFileTypes"
            (change)="onFileSelect($event)"
            class="file-input"
            [attr.aria-label]="'File upload'"
          />
        }
      </div>

      <!-- Character Counter -->
      @if (showCharacterCount && maxLength) {
        <div class="character-counter">
          <span [class.character-warning]="value.length > maxLength * 0.9">
            {{ value.length }}/{{ maxLength }}
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .message-input-container {
      position: relative;
      width: 100%;
      background-color: white;
      border-radius: 0.75rem;
      border: 1px solid rgb(229 231 235);
      transition: all 0.2s;
    }

    .message-input-container:hover {
      border-color: rgb(209 213 219);
    }

    .message-input-container:focus-within {
      border-color: rgb(59 130 246);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .message-input-container.drag-over {
      border-color: rgb(59 130 246);
      background-color: rgba(59, 130, 246, 0.05);
    }

    /* File Upload Overlay */
    .file-upload-overlay {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background-color: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(8px);
      border: 2px dashed rgb(59 130 246);
      border-radius: 0.75rem;
      color: rgb(107 114 128);
      font-size: 0.875rem;
      pointer-events: none;
    }

    .overlay-icon {
      width: 1rem;
      height: 1rem;
    }

    /* Recording Controls Overlay */
    .recording-controls-overlay {
      position: absolute;
      inset: 1px;
      z-index: 50;
      overflow: hidden;
      border-radius: 0.75rem;
    }

    .recording-visualizer {
      width: 100%;
      height: 100%;
      background-color: rgb(239 68 68);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .recording-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }

    .recording-pulse {
      width: 0.75rem;
      height: 0.75rem;
      background-color: white;
      border-radius: 50%;
      animation: recording-pulse 1.5s infinite;
    }

    @keyframes recording-pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.2);
      }
    }

    .audio-waves {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 1rem;
    }

    .wave-bar {
      width: 0.25rem;
      height: 1rem;
      background-color: rgba(255, 255, 255, 0.7);
      border-radius: 0.125rem;
      animation: wave-animation 1s ease-in-out infinite;
    }

    @keyframes wave-animation {
      0%, 100% {
        height: 0.5rem;
      }
      50% {
        height: 1.5rem;
      }
    }

    .transcribing-overlay {
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgb(107 114 128);
    }

    .transcribing-spinner {
      position: relative;
      margin-bottom: 1rem;
    }

    .spinner-ring {
      width: 2rem;
      height: 2rem;
      border: 2px solid rgb(209 213 219);
      border-top-color: rgb(59 130 246);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .spinner-pulse {
      position: absolute;
      inset: 0;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background-color: rgba(59, 130, 246, 0.2);
      animation: spinner-pulse 1s ease-in-out infinite;
    }

    @keyframes spinner-pulse {
      0% {
        transform: scale(0.8);
        opacity: 0;
      }
      50% {
        transform: scale(1.2);
        opacity: 1;
      }
      100% {
        transform: scale(0.8);
        opacity: 0;
      }
    }

    /* Main Input Wrapper */
    .message-input-wrapper {
      display: flex;
      width: 100%;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .textarea-container {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .message-textarea {
      width: 100%;
      border: 1px solid transparent;
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.5;
      resize: none;
      overflow: hidden;
      background-color: transparent;
      min-height: 2.5rem;
      max-height: 12rem;
      transition: all 0.2s;
    }

    .message-textarea:focus {
      outline: none;
      border-color: transparent;
      box-shadow: none;
    }

    .message-textarea:disabled {
      color: rgb(107 114 128);
      cursor: not-allowed;
    }

    .message-textarea.has-attachments {
      padding-bottom: 4rem;
    }

    .message-textarea.voice-input-active {
      background-color: rgba(254, 242, 242, 0.3);
      color: rgb(185 28 28);
    }

    .message-textarea::placeholder {
      color: rgb(107 114 128);
    }

    /* File Attachments Preview */
    .file-attachments-preview {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.75rem;
      overflow-x: auto;
      display: flex;
      gap: 0.5rem;
    }

    .file-attachment-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background-color: rgb(249 250 251);
      border: 1px solid rgb(229 231 235);
      border-radius: 0.5rem;
      font-size: 0.75rem;
      min-width: 0;
      flex-shrink: 0;
    }

    .file-preview {
      width: 1.5rem;
      height: 1.5rem;
      object-fit: cover;
      border-radius: 0.25rem;
    }

    .file-icon {
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgb(107 114 128);
      flex-shrink: 0;
    }

    .file-icon svg {
      width: 0.875rem;
      height: 0.875rem;
    }

    .file-details {
      min-width: 0;
      flex: 1;
    }

    .file-name {
      display: block;
      font-weight: 500;
      color: rgb(17 24 39);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      display: block;
      color: rgb(107 114 128);
    }

    .file-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
      padding: 0;
      border: none;
      background: transparent;
      color: rgb(107 114 128);
      border-radius: 0.25rem;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .file-remove:hover {
      background-color: rgb(239 68 68);
      color: white;
    }

    .file-remove svg {
      width: 0.625rem;
      height: 0.625rem;
    }

    /* Action Buttons */
    .action-buttons {
      display: flex;
      gap: 0.25rem;
      align-items: flex-start;
      padding-top: 0.25rem;
    }

    .action-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 1px solid rgb(229 231 235);
      background: white;
      color: rgb(107 114 128);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .action-button:hover:not(:disabled) {
      background-color: rgb(243 244 246);
      color: rgb(55 65 81);
    }

    .action-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-button svg {
      width: 0.875rem;
      height: 0.875rem;
    }

    .attachment-button:hover:not(:disabled) {
      color: rgb(59 130 246);
      border-color: rgb(59 130 246);
    }

    .voice-button:hover:not(:disabled) {
      color: rgb(34 197 94);
      border-color: rgb(34 197 94);
    }

    .voice-button-active {
      background-color: rgb(34 197 94);
      color: white;
      border-color: rgb(34 197 94);
      animation: voice-button-pulse 1.5s infinite;
    }

    @keyframes voice-button-pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }

    .stop-button {
      background-color: rgb(239 68 68);
      color: white;
      border-color: rgb(239 68 68);
    }

    .stop-button:hover:not(:disabled) {
      background-color: rgb(220 38 38);
      border-color: rgb(220 38 38);
    }

    .send-button {
      background-color: rgb(59 130 246);
      color: white;
      border-color: rgb(59 130 246);
    }

    .send-button:hover:not(:disabled) {
      background-color: rgb(37 99 235);
      border-color: rgb(37 99 235);
    }

    /* Hidden File Input */
    .file-input {
      display: none;
    }

    /* Character Counter */
    .character-counter {
      position: absolute;
      bottom: -1.5rem;
      right: 0;
      font-size: 0.75rem;
      color: rgb(107 114 128);
      z-index: 10;
    }

    .character-warning {
      color: rgb(239 68 68);
      font-weight: 500;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZardMessageInputComponent {
  @Input() value: string = '';
  @Input() files: MessageInputFile[] = [];
  @Input() voiceRecording?: MessageInputVoiceRecording;
  @Input() isGenerating: boolean = false;
  @Input() options?: MessageInputOptions;
  @Input() maxLength?: number;
  @Input() showCharacterCount: boolean = false;
  @Input() disabled: boolean = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() filesChange = new EventEmitter<MessageInputFile[]>();
  @Output() voiceRecordingChange = new EventEmitter<MessageInputVoiceRecording | undefined>();
  @Output() submit = new EventEmitter<{ message: string; files: MessageInputFile[] }>();
  @Output() stop = new EventEmitter<void>();
  @Output() fileSelect = new EventEmitter<File[]>();
  @Output() transcribeAudio = new EventEmitter<Blob>();

  @ViewChild('textarea') textarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragOver = false;
  isTranscribing = false;
  private mediaRecorder?: MediaRecorder;
  private recordingStartTime = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  get hasValidContent(): boolean {
    return this.value.trim().length > 0 || this.files.length > 0;
  }

  get submitButtonClass(): string {
    const classes = ['submit-button'];

    if (this.isGenerating) {
      classes.push('stop-button');
    } else if (this.voiceRecording?.isRecording) {
      classes.push('stop-button');
    } else if (this.options?.allowVoiceInput && !this.hasValidContent) {
      classes.push('voice-button');
    }

    return classes.join(' ');
  }

  get acceptedFileTypes(): string {
    return 'image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
  }

  onValueChange(value: string): void {
    this.value = value;
    this.valueChange.emit(value);
    this.cdr.markForCheck();
  }

  onKeyDown(event: KeyboardEvent): void {
    const submitOnEnter = this.options?.submitOnEnter !== false;
    const enableInterrupt = this.options?.enableInterrupt !== false;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (this.isGenerating && enableInterrupt) {
        this.stop.emit();
      } else if (submitOnEnter && this.hasValidContent) {
        this.handleSubmit();
      }
    }

    // Double-enter interrupt
    if (enableInterrupt && this.isGenerating && event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      this.stop.emit();
    }
  }

  onButtonClick(): void {
    if (this.isGenerating) {
      this.stop.emit();
    } else if (this.voiceRecording?.isRecording) {
      this.stopRecording();
    } else if (this.options?.allowVoiceInput && !this.hasValidContent) {
      this.toggleVoiceRecording();
    } else {
      this.handleSubmit();
    }
  }

  private handleSubmit(): void {
    if (this.hasValidContent) {
      this.submit.emit({
        message: this.value.trim(),
        files: [...this.files]
      });

      // Reset form
      this.value = '';
      this.files = [];
      this.valueChange.emit('');
      this.filesChange.emit([]);
    }
  }

  // File handling
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files || []);

    if (selectedFiles.length > 0) {
      this.handleFiles(selectedFiles);
    }

    // Reset input
    input.value = '';
  }

  
  private handleFiles(files: File[]): void {
    const maxFiles = this.options?.maxFiles || 5;
    const maxFileSize = this.options?.maxFileSize || 10 * 1024 * 1024; // 10MB

    const validFiles = files
      .slice(0, maxFiles - this.files.length)
      .filter(file => file.size <= maxFileSize);

    const newFiles: MessageInputFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: this.createPreview(file)
    }));

    const updatedFiles = [...this.files, ...newFiles];
    this.files = updatedFiles;
    this.filesChange.emit(updatedFiles);
    this.fileSelect.emit(validFiles);
    this.cdr.markForCheck();
  }

  private createPreview(file: File): string | undefined {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return undefined;
  }

  removeFile(fileId: string): void {
    const updatedFiles = this.files.filter(file => file.id !== fileId);
    this.files = updatedFiles;
    this.filesChange.emit(updatedFiles);
    this.cdr.markForCheck();
  }

  // Voice recording
  async toggleVoiceRecording(): Promise<void> {
    if (this.voiceRecording?.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.recordingStartTime = Date.now();

      const chunks: Blob[] = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);

        const recording: MessageInputVoiceRecording = {
          isRecording: false,
          duration,
          blob,
          url
        };

        this.voiceRecording = recording;
        this.voiceRecordingChange.emit(recording);
        this.transcribeAudio.emit(blob);

        // Cleanup
        stream.getTracks().forEach(track => track.stop());

        // Reset transcribing state after a delay
        setTimeout(() => {
          this.isTranscribing = false;
          this.cdr.detectChanges();
        }, 1000);

        this.cdr.markForCheck();
      };

      this.mediaRecorder.start();

      this.voiceRecording = {
        isRecording: true,
        duration: 0
      };

      // Update duration every second
      const updateDuration = setInterval(() => {
        if (this.voiceRecording?.isRecording) {
          this.voiceRecording.duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
          this.cdr.markForCheck();
        } else {
          clearInterval(updateDuration);
        }
      }, 1000);

      this.voiceRecordingChange.emit(this.voiceRecording);
      this.cdr.markForCheck();

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.isTranscribing = true;
      this.cdr.detectChanges();
    }

    if (this.voiceRecording) {
      this.voiceRecording.isRecording = false;
      this.voiceRecordingChange.emit(this.voiceRecording);
    }
  }

  // Auto-resize textarea
  autoResize(): void {
    const textarea = this.textarea.nativeElement;
    const maxRows = this.options?.maxRows || 5;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height based on content
    const lineHeight = 24; // Approximate line height in pixels
    const singleRowHeight = 40; // Height of single row (padding + line)
    const maxHeight = singleRowHeight + (lineHeight * (maxRows - 1));

    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  onFocus(): void {
    this.autoResize();
  }

  onBlur(): void {
    // Optional: cleanup when focus is lost
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getButtonAriaLabel(): string {
    if (this.isGenerating) {
      return 'Stop generation';
    } else if (this.voiceRecording?.isRecording) {
      return 'Stop recording';
    } else if (this.options?.allowVoiceInput && !this.hasValidContent) {
      return 'Start voice recording';
    } else {
      return 'Send message';
    }
  }

  // Additional methods for the enhanced template
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.options?.allowAttachments) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    const text = event.clipboardData?.getData('text');
    if (text && text.length > 500 && this.options?.allowAttachments) {
      event.preventDefault();
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], 'Pasted text', {
        type: 'text/plain',
        lastModified: Date.now(),
      });
      this.handleFiles([file]);
      return;
    }

    const files = Array.from(items)
      .map((item) => item.getAsFile())
      .filter((file) => file !== null);

    if (this.options?.allowAttachments && files.length > 0) {
      event.preventDefault();
      this.handleFiles(files);
    }
  }

  onSubmit(): void {
    this.handleSubmit();
  }

  onStopGeneration(): void {
    this.stop.emit();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    if (this.options?.allowAttachments && event.dataTransfer?.files) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      this.handleFiles(droppedFiles);
    }

    this.cdr.markForCheck();
  }

  // Cleanup
  ngOnDestroy(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}