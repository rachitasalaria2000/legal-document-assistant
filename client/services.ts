import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpEvent } from "@angular/common/http";
import { Observable, timer, switchMap, takeWhile } from "rxjs";
export interface DocumentItem {
  id: number;
  filename: string;
  status: "queued" | "processing" | "ready" | "failed" | "ocr_required";
  total_pages: number;
  total_chunks: number;
  error_message: string | null;
}
export interface Source {
  id: number;
  filename: string;
  page: number;
  heading: string;
  excerpt: string;
}
export interface Answer {
  answer: string;
  sources: Source[];
  searches: number;
}
@Injectable({ providedIn: "root" })
export class DocumentService {
  private http = inject(HttpClient);
  list() {
    return this.http.get<DocumentItem[]>("/api/documents");
  }
  status(id: number) {
    return this.http.get<DocumentItem>(`/api/documents/${id}/status`);
  }
  poll(id: number) {
    return timer(0, 2000).pipe(
      switchMap(() => this.status(id)),
      takeWhile(
        (doc) => doc.status === "queued" || doc.status === "processing",
        true,
      ),
    );
  }
  upload(file: File): Observable<HttpEvent<{ id: number; status: string }>> {
    const form = new FormData();
    form.append("file", file);
    return this.http.post<{ id: number; status: string }>(
      "/api/documents/upload",
      form,
      { observe: "events", reportProgress: true },
    );
  }
  retry(id: number) {
    return this.http.post(`/api/documents/${id}/retry`, {});
  }
  health() {
    return this.http.get<{ aiConfigured: boolean }>("/api/health");
  }
}
@Injectable({ providedIn: "root" })
export class ChatService {
  private http = inject(HttpClient);
  ask(documentId: number, question: string) {
    return this.http.post<Answer>("/api/chat", { documentId, question });
  }
}
