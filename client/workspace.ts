import { Component, OnInit, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subscription } from "rxjs";
import { DocumentService, DocumentItem } from "./services.js";
import { DocumentUploadComponent } from "./document-upload.component.js";
import { DocumentListComponent } from "./document-list.component.js";
import { ChatComponent } from "./chat.component.js";
@Component({
  selector: "app-workspace",
  standalone: true,
  imports: [DocumentUploadComponent, DocumentListComponent, ChatComponent],
  template: ` <header class="topbar">
      <a href="/" class="brand"
        ><span>§</span> Clause<span class="brand-light">desk</span></a
      ><span class="workspace-label">Legal document assistant</span
      ><span class="poc-label">Local workspace</span>
    </header>
    <main>
      <div class="page-heading">
        <div>
          <span class="eyebrow">YOUR WORKSPACE</span>
          <h1>Read the terms. Find the connections.</h1>
          <p>
            Upload a PDF and explore its clauses with page-level references.
          </p>
        </div>
      </div>
      @if (keyMissing()) {
        <p class="notice" role="status">
          OpenAI is not configured. Add your API key to the server .env file and
          restart to process documents and ask questions.
        </p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="workspace">
        <aside>
          <app-document-upload
            (uploaded)="uploaded($event)"
          /><app-document-list
            [documents]="documents()"
            [selectedId]="selected()?.id ?? null"
            [loading]="loading()"
            (selected)="selected.set($event)"
            (refresh)="load()"
            (retry)="retry($event)"
          />
        </aside>
        <app-chat [document]="selected()" />
      </div>
      <footer>
        Angular · Express · MySQL
        <span>Document-based answers, with the source in view.</span>
      </footer>
    </main>`,
})
export class WorkspaceComponent implements OnInit {
  private service = inject(DocumentService);
  private destroy = inject(DestroyRef);
  private polls = new Map<number, Subscription>();
  documents = signal<DocumentItem[]>([]);
  selected = signal<DocumentItem | null>(null);
  loading = signal(false);
  error = signal("");
  keyMissing = signal(false);
  ngOnInit() {
    this.load();
    this.service
      .health()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => this.keyMissing.set(!r.aiConfigured),
        error: () => {},
      });
    this.destroy.onDestroy(() => this.polls.forEach((s) => s.unsubscribe()));
  }
  load() {
    this.loading.set(true);
    this.error.set("");
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (docs) => {
          this.documents.set(docs);
          this.loading.set(false);
          for (const doc of docs) {
            if (doc.id === this.selected()?.id) this.selected.set(doc);
            if (doc.status === "queued" || doc.status === "processing")
              this.watch(doc.id);
          }
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(
            e.error?.error ?? "Could not load documents. Use Refresh to retry.",
          );
        },
      });
  }
  uploaded(id: number) {
    this.service
      .status(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (doc) => {
          this.documents.update((d) => [doc, ...d.filter((x) => x.id !== id)]);
          this.selected.set(doc);
          this.watch(id);
        },
        error: () => this.load(),
      });
  }
  retry(id: number) {
    this.service
      .retry(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.polls.get(id)?.unsubscribe();
          this.polls.delete(id);
          this.watch(id);
        },
        error: (e) => this.error.set(e.error?.error ?? "Retry failed."),
      });
  }
  private watch(id: number) {
    if (this.polls.has(id)) return;
    const sub = this.service.poll(id).subscribe({
      next: (doc) => {
        this.documents.update((items) =>
          items.map((d) => (d.id === id ? doc : d)),
        );
        if (this.selected()?.id === id) this.selected.set(doc);
      },
      error: () => {
        this.polls.delete(id);
        this.error.set("Status updates paused. Use Refresh to reconnect.");
      },
      complete: () => this.polls.delete(id),
    });
    this.polls.set(id, sub);
  }
}
