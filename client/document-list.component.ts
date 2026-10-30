import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { DocumentItem } from "./services.js";
import { LoadingComponent } from "./loading.component.js";
@Component({
  selector: "app-document-list",
  standalone: true,
  imports: [MatButtonModule, LoadingComponent],
  template: ` <div class="section-label">
      <h2>
        Documents <span>{{ documents.length }}</span>
      </h2>
      <button mat-button (click)="refresh.emit()">Refresh</button>
    </div>
    @if (loading) {
      <app-loading label="Loading documents…" />
    }
    @if (!documents.length && !loading) {
      <p class="empty-note">Your uploaded PDFs will appear here.</p>
    }
    <div class="document-list">
      @for (doc of documents; track doc.id) {
        <div class="document-row" [class.selected]="selectedId === doc.id">
          <button class="document-select" (click)="selected.emit(doc)">
            <span class="pdf-badge">PDF</span
            ><span
              ><strong>{{ doc.filename }}</strong
              ><small
                >{{ doc.total_pages }} pages ·
                {{ doc.total_chunks }} chunks</small
              ></span
            >
          </button>
          <span class="status" [class.ready]="doc.status === 'ready'">{{
            doc.status.replace("_", " ")
          }}</span>
          @if (doc.error_message) {
            <p class="error">{{ doc.error_message }}</p>
          }
          @if (doc.status === "failed") {
            <button mat-button (click)="retry.emit(doc.id)">
              Retry processing
            </button>
          }
        </div>
      }
    </div>`,
})
export class DocumentListComponent {
  @Input() documents: DocumentItem[] = [];
  @Input() selectedId: number | null = null;
  @Input() loading = false;
  @Output() selected = new EventEmitter<DocumentItem>();
  @Output() refresh = new EventEmitter<void>();
  @Output() retry = new EventEmitter<number>();
}
