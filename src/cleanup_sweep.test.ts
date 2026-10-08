import test from "node:test";
import assert from "node:assert/strict";
import { staleLearners, sweepRequest } from "./cleanup_sweep.js";

test("sweep selects deadlines older than the retention cutoff", () => {
  const input = sweepRequest.parse({ courseId: "math", learnerDeadlines: [{ learnerId: "old", dueAt: "2024-01-01T00:00:00.000Z" }, { learnerId: "fresh", dueAt: "2025-06-01T00:00:00.000Z" }], educatorEmail: "chenhua@changba.com", staleBefore: "2025-01-01T00:00:00.000Z" });
  assert.deepEqual(staleLearners(input, new Date("2025-07-01T00:00:00.000Z")), ["old"]);
});
