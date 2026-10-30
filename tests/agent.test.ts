import { it, expect, vi } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { answerQuestion, type AgentModel } from "../server/agent.js";
import { chunk } from "./helpers.js";
const call = (id: string, document_id = 1) =>
  new AIMessage({
    content: "",
    tool_calls: [
      { id, name: "search_document", args: { query: id, document_id } },
    ],
  });
function model(replies: AIMessage[]): AgentModel {
  const invoke = vi.fn(
    async () =>
      replies.shift() ?? new AIMessage('{"answer":"missing","citationIds":[]}'),
  );
  return { invoke, bindTools: () => ({ invoke }) };
}
it("runs actual LangGraph tool loops and combines cross-page evidence", async () => {
  const search = vi.fn(async (q: string) =>
    q === "payments" ? [chunk(1, 2)] : [chunk(2, 4)],
  );
  const m = model([
    call("payments"),
    call("termination"),
    new AIMessage(
      JSON.stringify({
        answer: "Pay amounts due [1]. Termination preserves them [2].",
        citationIds: [1, 2],
      }),
    ),
  ]);
  const result = await answerQuestion(
    m,
    search,
    1,
    "contract.pdf",
    "How are payments and termination linked?",
  );
  expect(search).toHaveBeenCalledTimes(2);
  expect(result.searches).toBe(2);
  expect(result.sources.map((s) => s.page)).toEqual([2, 4]);
});
it("returns missing information when model does not retrieve", async () => {
  const r = await answerQuestion(
    model([new AIMessage('{"answer":"invented","citationIds":[1]}')]),
    async () => [],
    1,
    "x",
    "x",
  );
  expect(r.sources).toEqual([]);
  expect(r.answer).toContain("could not find");
});
it("rejects invented citations", async () => {
  const r = await answerQuestion(
    model([
      call("x"),
      new AIMessage('{"answer":"Claim [99]","citationIds":[99]}'),
    ]),
    async () => [chunk(1)],
    1,
    "x",
    "x",
  );
  expect(r.sources).toEqual([]);
});
it("blocks document switching inside a tool call", async () => {
  const search = vi.fn(async () => [chunk(1)]);
  await answerQuestion(
    model([
      call("x", 2),
      new AIMessage('{"answer":"missing","citationIds":[]}'),
    ]),
    search,
    1,
    "x",
    "x",
  );
  expect(search).not.toHaveBeenCalled();
});
it("limits tool executions to four and terminates", async () => {
  const search = vi.fn(async () => [chunk(1)]);
  const m = model([
    ...Array.from({ length: 5 }, (_, i) => call(String(i))),
    new AIMessage('{"answer":"Amount due [1]","citationIds":[1]}'),
  ]);
  const r = await answerQuestion(m, search, 1, "x", "x");
  expect(search).toHaveBeenCalledTimes(4);
  expect(r.searches).toBe(4);
});
it("does not surface malformed model output as an answer", async () => {
  const r = await answerQuestion(
    model([call("x"), new AIMessage("unstructured output")]),
    async () => [chunk(1)],
    1,
    "x",
    "x",
  );
  expect(r.answer).toContain("could not find");
});
