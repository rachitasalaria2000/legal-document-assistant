# Verification

Checked locally on 30 October 2026 with Node 22.22.3, MySQL 8.0.43 and Microsoft Edge. Test doubles for OpenAI exist only in tests; the running application requires a real key.

| Check                                          | Result    |
| ---------------------------------------------- | --------- |
| Unit, backend API and Angular HttpClient tests | 26 passed |
| Real MySQL integration tests                   | 2 passed  |
| Browser tests                                  | 3 passed  |
| TypeScript and Angular template type checks    | Passed    |
| Production server and Angular bundle           | Passed    |
| Formatting                                     | Passed    |

The 100-page fixture was extracted with PDF.js, chunked, and processed into real MySQL with deterministic embedding test doubles. A forced failure after the first 16 chunks left a failed status and partial progress; retry produced all 100 chunks without duplicates. This verifies the pipeline and recovery, not live semantic relevance. The graph tests run actual LangGraph nodes with scripted model messages and verify multi-search behaviour, a four-call limit, document isolation and citation checks. The browser tests verify configuration errors, mobile layout, and chat/citation/retry rendering with explicitly controlled chat responses. The real running app was checked for browser page errors: none observed.

`npm audit` reports **9 findings: 4 high, 4 moderate, 1 low; no critical findings**. Eight are Angular 19 packages, which remain at the requested major version (19.2.25 core; Material 19.2.19). One low finding is a transitive Babel 7 dependency in the Angular compiler toolchain. Angular 19 is outside support. Some advisories concern SSR features this client-rendered POC does not use, but the version findings are not waived. Do not treat the dependency set as production-cleared.

Live OpenAI embeddings, answer quality, account access, billing, model availability and latency were **not tested** because no API key was supplied.

## Live-key checklist

- Put an OpenAI API key in the ignored `.env` and restart.
- Upload the sample and confirm `ready`, five pages and non-zero chunks.
- Check that MySQL stores non-empty JSON numeric embedding arrays.
- Ask the cross-page payment/termination question; verify source pages against the PDF.
- Ask for a clause that is not present; confirm the answer says so.
- Upload a searchable PDF around 100 pages and inspect latency and references.
- Try an image-only PDF and check the OCR message.
- Confirm rate-limit/quota errors remain visible and can be retried.

Model quality, actual OpenAI credentials/billing and provider latency require this checklist. Prompt-injection resistance is not guaranteed by a system prompt alone.
