# Implementation walkthrough

## Data flow

1. **Angular and Express:** Angular services send multipart uploads or JSON chat requests. Standalone Material components handle forms, loading, retry states and citations. Express serves both the compiled client and API, so no CORS configuration is needed. Interview question: why use a service? It keeps transport and polling separate from the view.
2. **MySQL:** Documents own ordered chunks and chat messages through foreign keys. Embeddings are JSON arrays and all values use parameterized SQL. Interview question: why MySQL? It meets this POC's stack requirement and keeps relational metadata and vectors together without another service.
3. **Upload:** Multer limits size/type, gives files random names, and checks the PDF signature before queuing. Invalid uploads are removed. Interview question: why not trust MIME? A client can supply any MIME value; actual parsing can still reject a file after it is queued.
4. **PDF and chunks:** PDF.js reads pages. A heading heuristic creates sections; LangChain's token splitter creates bounded, overlapping chunks. Each chunk remains on one physical page. Interview question: why overlap? A clause near a split retains context in both pieces. Layout extraction remains imperfect for complex tables.
5. **Embeddings:** OpenAI transforms text into numeric vectors describing meaning. Batches are stored transactionally with chunk metadata. Interview question: why save the embedding model? A document's question must use the same model/vector space as its stored chunks.
6. **Retrieval:** The selected document's vectors are loaded, ranked by cosine similarity, and augmented with adjacent chunks. Cosine compares vector direction: dot product divided by both lengths. Interview question: why not keyword search? Semantic retrieval can match differently worded questions; it can also retrieve irrelevant text, so the model must assess evidence.
7. **RAG:** Retrieval-Augmented Generation gives the model document excerpts before answering. References make the answer inspectable. Interview question: is a citation proof? No; the reference must actually support the statement.
8. **LangGraph:** A graph alternates a model node and a tools node. The model chooses search queries, can search again for another clause, and then answers. Calls are capped at four. Interview question: basic RAG vs agentic RAG? Basic RAG usually retrieves once in a fixed flow; this agent chooses and repeats tool calls based on evidence.
9. **Grounding:** PDF excerpts are untrusted data. A system instruction rejects embedded instructions; the only tool searches the selected document and cannot act outside it. Returned citation IDs must belong to this turn's evidence. Interview question: does this eliminate prompt injection? No; restricting capabilities and checking output reduces its impact, while evaluations remain necessary.
10. **Tests:** Unit tests verify mathematics, parsing, retrieval scope, storage behaviour, graph loops and API validation. Angular HttpClient tests exercise request/response contracts. Browser tests cover missing configuration and the answer/retry UI; MySQL tests use a real isolated database. Interview question: what is not tested without a key? Live retrieval relevance, model answers, billing access and latency.

## Two-minute explanation

“I built a local workspace for reviewing legal PDFs. The user uploads a document and sees its processing status. The server extracts text page by page, splits sections into overlapping token chunks and stores their OpenAI embeddings in MySQL. When a question arrives, a LangGraph agent can call a document-search tool several times. That tool compares the question vector with the stored vectors using cosine similarity and includes nearby clauses. This matters when termination refers to payment duties on another page. The response includes page numbers and source excerpts, and the user can expand them to check the answer. I kept the POC small: one local workspace, one processing queue, one database. I would next improve OCR, persistent jobs, retrieval evaluations and access controls.”

## Five-minute demo

- 0:00–1:00: Open localhost:3003; show the empty workspace and upload the fictional agreement.
- 1:00–2:00: Explain processing statuses, pages, chunk count and the MySQL tables.
- 2:00–3:00: Ask the invoice deadline question; expand a source and compare page 2.
- 3:00–4:00: Ask how termination affects payment. Check evidence from pages 2 and 4.
- 4:00–5:00: Ask for an arbitration venue, which is absent. Show the missing-information response and mention limits.

Requires a working OpenAI key. Without it, demonstrate the configuration message and run the automated tests instead of presenting test responses as live AI.

## More interview questions

11. **How are partial failures handled?** Completed batches stay stored, the document is marked failed, and retry rebuilds cleanly. Only ready documents are searched.
12. **How are rate limits handled?** The SDK retries transient failures twice, requests have timeouts, and a final failure is visible and retryable.
13. **Why neighbours?** Clauses often continue across chunks or pages. Neighbours supply context; they do not replace semantic ranking.
14. **What is the main scaling bottleneck?** Transferring and scanning every JSON vector for the selected document in Node.
15. **What changes for production?** Authentication, tenant isolation, a durable job queue, encrypted storage, malware scanning, OCR, deletion/retention controls, indexed retrieval, model/prompt evaluations and observability.
