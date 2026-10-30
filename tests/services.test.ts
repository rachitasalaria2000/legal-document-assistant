import "@angular/compiler";
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
  Injector,
  ɵINJECTOR_SCOPE,
  PLATFORM_ID,
} from "@angular/core";
import {
  provideHttpClient,
  HttpEventType,
  withNoXsrfProtection,
} from "@angular/common/http";
import {
  provideHttpClientTesting,
  HttpTestingController,
} from "@angular/common/http/testing";
import { it, expect, afterEach } from "vitest";
import { DocumentService, ChatService } from "../client/services.js";
let injector: EnvironmentInjector;
function setup() {
  injector = createEnvironmentInjector(
    [
      { provide: ɵINJECTOR_SCOPE, useValue: "root" },
      { provide: PLATFORM_ID, useValue: "server" },
      provideHttpClient(withNoXsrfProtection()),
      provideHttpClientTesting(),
      DocumentService,
      ChatService,
    ],
    Injector.NULL as EnvironmentInjector,
  );
  return {
    http: injector.get(HttpTestingController),
    docs: runInInjectionContext(injector, () => injector.get(DocumentService)),
    chat: runInInjectionContext(injector, () => injector.get(ChatService)),
  };
}
afterEach(() => injector.destroy());
it("Angular DocumentService sends multipart upload and observes progress", () => {
  const { http, docs } = setup();
  let response = false;
  docs
    .upload(new File(["%PDF-"], "x.pdf", { type: "application/pdf" }))
    .subscribe((e) => {
      if (e.type === HttpEventType.Response) response = true;
    });
  const r = http.expectOne("/api/documents/upload");
  expect(r.request.body instanceof FormData).toBe(true);
  expect(r.request.reportProgress).toBe(true);
  r.flush({ id: 1, status: "queued" });
  expect(response).toBe(true);
  http.verify();
});
it("Angular ChatService sends selected document and passes citations through", () => {
  const { http, chat } = setup();
  let page = 0;
  chat.ask(7, "What notice?").subscribe((r) => (page = r.sources[0].page));
  const r = http.expectOne("/api/chat");
  expect(r.request.body).toEqual({ documentId: 7, question: "What notice?" });
  r.flush({
    answer: "15 days [4]",
    searches: 1,
    sources: [{ id: 4, page: 9 }],
  });
  expect(page).toBe(9);
  http.verify();
});
it("Angular service propagates server failures", () => {
  const { http, docs } = setup();
  let error = "";
  docs.list().subscribe({ error: (e) => (error = e.error.error) });
  http
    .expectOne("/api/documents")
    .flush(
      { error: "Database unavailable" },
      { status: 503, statusText: "Unavailable" },
    );
  expect(error).toBe("Database unavailable");
  http.verify();
});
