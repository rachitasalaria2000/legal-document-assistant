import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { Subscription } from "rxjs";
import { ChatService, DocumentItem, Answer } from "./services.js";
import { SourceReferencesComponent } from "./source-references.component.js";
import { LoadingComponent } from "./loading.component.js";
@Component({
  selector: "app-chat",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    SourceReferencesComponent,
    LoadingComponent,
  ],
  template: ` <section class="chat-panel">
    <header class="chat-header">
      <span class="eyebrow">DOCUMENT REVIEW</span>
      <h2>{{ document?.filename ?? "Ask about your document" }}</h2>
      <p>Answers are linked to clauses in the selected PDF.</p>
    </header>
    <div class="conversation" aria-live="polite">
      @if (!document) {
        <div class="chat-empty">
          <span aria-hidden="true">§</span>
          <h3>Start with a PDF</h3>
          <p>Upload a legal document, then ask about its terms.</p>
        </div>
      } @else if (document.status !== "ready") {
        <div class="chat-empty">
          <h3>
            {{
              document.status === "queued" || document.status === "processing"
                ? "Preparing your document"
                : "Document needs attention"
            }}
          </h3>
          <p>
            {{
              document.error_message ??
                "Extracting clauses and creating searchable embeddings. Status updates automatically."
            }}
          </p>
        </div>
      } @else if (!messages().length) {
        <div class="chat-empty">
          <span aria-hidden="true">§</span>
          <h3>What would you like to check?</h3>
          <p>
            Try a specific question, or connect terms from different sections.
          </p>
          <button mat-stroked-button (click)="question.setValue(example)">
            {{ example }}
          </button>
        </div>
      }
      @for (message of messages(); track $index) {
        <div class="question-bubble">{{ message.question }}</div>
        <mat-card class="answer-card"
          ><mat-card-content
            ><span class="eyebrow">DOCUMENT ANSWER</span>
            <p class="answer-text">{{ message.result.answer }}</p>
            <app-source-references [sources]="message.result.sources" /><small
              >{{ message.result.searches }} document searches</small
            ></mat-card-content
          ></mat-card
        >
      }
      @if (busy()) {
        <app-loading label="Searching clauses and checking references…" />
      }
      @if (error()) {
        <p class="error" role="alert">
          {{ error() }} Your question is kept below; you can retry.
        </p>
      }
    </div>
    <form class="composer" [formGroup]="form" (ngSubmit)="ask()">
      <mat-form-field appearance="outline"
        ><mat-label>Ask a question</mat-label
        ><textarea
          matInput
          [formControl]="question"
          rows="2"
          maxlength="2000"
        ></textarea></mat-form-field
      ><button
        mat-flat-button
        type="submit"
        [disabled]="document?.status !== 'ready' || busy() || question.invalid"
      >
        Ask question</button
      ><small>Check source clauses before relying on an answer.</small>
    </form>
  </section>`,
})
export class ChatComponent implements OnChanges, OnDestroy {
  @Input() document: DocumentItem | null = null;
  private service = inject(ChatService);
  private subscription?: Subscription;
  private selectedId: number | null = null;
  question = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  form = new FormGroup({ question: this.question });
  busy = signal(false);
  error = signal("");
  messages = signal<{ question: string; result: Answer }[]>([]);
  example = "How does termination affect outstanding payments?";
  ngOnChanges() {
    if (this.document?.id !== this.selectedId) {
      this.subscription?.unsubscribe();
      this.selectedId = this.document?.id ?? null;
      this.messages.set([]);
      this.error.set("");
      this.busy.set(false);
      this.question.reset();
    }
  }
  ask() {
    const question = this.question.value.trim();
    if (
      !question ||
      !this.document ||
      this.document.status !== "ready" ||
      this.busy()
    )
      return;
    this.busy.set(true);
    this.error.set("");
    this.subscription = this.service.ask(this.document.id, question).subscribe({
      next: (result) => {
        this.messages.update((m) => [...m, { question, result }]);
        this.question.reset();
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.error ?? "Could not get an answer.");
        this.busy.set(false);
      },
    });
  }
  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
