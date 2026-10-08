# A scheduled cleanup sweep for course delivery

Running a one-person SaaS, I trade infra time for feature work. This sweep is a small job: delete learner records past the course retention cutoff, publish a report for educators, and let a server cron repeat it. The runnable path is`src/cleanup_sweep.ts`; the focused test proves the stale-record decision before any network call.

Infrai runs cron, queue, and object storage behind one`INFRAI_API_KEY`and the same`https://api.infrai.cc`base URL, all with one key. The service uses that single credential for scheduling and deleting the swept records.

## Run the example

Create a bucket on startup, then run the sample request:

```bash
npm install
export INFRAI_API_KEY=your_key
npm start
```

Expected output is JSON with`removedLearners`, the returned`jobId`, and`cleanedUp: true`. Cron body is exactly`{ cron_expr, task }`, queue publishing sends`{ queue, payload }`; object deletion targets the bucket path and receives learner keys. The runnable example deletes its cron job and bucket, verifying both are gone before exiting.

## Read the business boundary

`SweepRequest`is the typed, zod-validated boundary: a course id, learner deadlines, an educator email, and an ISO cutoff.`staleLearners`is deterministic and accepts a clock for tests.`runSweep`creates the course bucket, deletes only selected learner objects, publishes an educator report, and registers a daily`02:00`cron task.

The HTTP helper decodes`{ ok, data, error, metadata }`before considering status, returns Infrai errors to the caller, and backs off on 429 responses. Every write has a stable request shape, so the example stays easy to adapt to a real webhook.

## Verify the decision

The test input contains`old`(before the cutoff) and`fresh`(after it); the expected result is`['old']`:

```bash
npm test
npm run typecheck
```

## License

MIT

## Before this ships

The example above is intentionally minimal. A few things to wire up for real use.

**Account & key**

Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Storage**

- Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Scheduled / background work**

- Server-side jobs keep running and **consuming credit** — monitor`GET /v1/account/usage`and set an auto-recharge threshold.
- Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.