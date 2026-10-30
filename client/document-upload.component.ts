import { Component, EventEmitter, Output, inject, signal } from "@angular/core";
import { HttpEventType, HttpErrorResponse } from "@angular/common/http";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { DocumentService } from "./services.js";
@Component({
  selector: "app-document-upload",
  standalone: true,
  imports: [MatButtonModule, MatProgressBarModule],
  template: ` <div class="upload-box">
    <span class="file-symbol" aria-hidden="true">↑</span>
    <h2>Add a document</h2>
    <p>Searchable PDF · up to 25 MB · 150 pages</p>
    <input
      #picker
      type="file"
      accept="application/pdf,.pdf"
      (change)="select($event)"
      [disabled]="busy()"
      aria-label="Select PDF file"
    />
    <button mat-flat-button (click)="picker.click()" [disabled]="busy()">
      {{ busy() ? "Uploading…" : "Choose PDF" }}
    </button>
    @if (busy()) {
      <mat-progress-bar
        mode="determinate"
        [value]="progress()"
        aria-label="Upload progress"
      />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
  </div>`,
})
export class DocumentUploadComponent {
  private service = inject(DocumentService);
  busy = signal(false);
  progress = signal(0);
  error = signal("");
  @Output() uploaded = new EventEmitter<number>();
  select(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set("");
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 25 * 1024 * 1024
    ) {
      this.error.set("Choose a PDF smaller than 25 MB.");
      input.value = "";
      return;
    }
    this.busy.set(true);
    this.progress.set(0);
    this.service.upload(file).subscribe({
      next: (e) => {
        if (e.type === HttpEventType.UploadProgress)
          this.progress.set(
            Math.round((100 * e.loaded) / (e.total ?? file.size)),
          );
        if (e.type === HttpEventType.Response) {
          this.busy.set(false);
          input.value = "";
          if (e.body) this.uploaded.emit(e.body.id);
        }
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        input.value = "";
        this.error.set(e.error?.error ?? "Upload failed. Please retry.");
      },
    });
  }
}
