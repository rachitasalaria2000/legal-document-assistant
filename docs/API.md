# API

Base URL: `http://localhost:3003/api`. Same-origin JSON requests, except multipart upload. Errors use `{ "error": "message" }`.

| Method | Path                    | Input / result                                                                            |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/health`               | Server status and `aiConfigured` flag                                                     |
| POST   | `/documents/upload`     | Multipart `file`: one PDF, up to 25 MB, max 150 pages. Returns `202 {id,status:"queued"}` |
| GET    | `/documents`            | Most recent 100 documents, statuses and processed chunk counts                            |
| GET    | `/documents/:id/status` | Metadata and processing error, without local file path                                    |
| POST   | `/documents/:id/retry`  | Retry failed processing; does not retry OCR-only documents                                |
| POST   | `/chat`                 | JSON `{ "documentId": 1, "question": "What notice applies?" }`                            |

Chat response:

```json
{
  "answer": "A material breach has a 15-day cure period [17].",
  "sources": [
    {
      "id": 17,
      "filename": "agreement.pdf",
      "page": 4,
      "heading": "4. TERMINATION",
      "excerpt": "Either party may terminate..."
    }
  ],
  "searches": 1
}
```

Chunk IDs are the citation labels. They are database IDs, not page numbers. Missing information has an explicit answer and an empty sources array. The server stores the question and answer together after a successful turn; the last eight messages provide follow-up context. The UI starts a fresh visible conversation when switching documents.

Statuses: `queued`, `processing`, `ready`, `failed`, `ocr_required`. Poll every two seconds until terminal. Processing errors are stored on the document. Only `ready` documents can be queried.

HTTP errors: 400 invalid input/upload, 403 invalid origin, 404 missing document, 409 document not ready or invalid retry, 429 request limit, 502 database/provider error, 503 missing API configuration, 504 answer timeout. Limit: 60 API calls/minute/IP, 5 uploads/minute and 10 questions/minute. The chat deadline is 90 seconds; individual OpenAI requests time out at 30 seconds with up to two SDK retries. Processing uses sequential batches of 16 embeddings and one document at a time.
