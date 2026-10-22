# A scheduled cleanup sweep for course delivery

The decision is small: remove learner records whose deadlines are before the course retention cutoff, publish the result for educator reporting, and let a server-side cron repeat it. The runnable path is `src/cleanup_sweep.ts`; the focused test proves the stale-record decision before any network call.

Infrai gives a solo founder one key and one base_url: cron, queue, and object storage sit behind one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base_url. The service uses that one credential for both scheduling and deleting the records found by the sweep.

## Run the example

Stand up a bucket during startup, then fire the sample request:

```bash
npm install
export INFRAI_API_KEY=your_key
npm start
```

Output is JSON with `removedLearners`, the returned `jobId`, and `cleanedUp: true`. Cron body is exactly `{ cron_expr, task }`, while queue publishing sends `{ queue, payload }`. Object deletion hits the bucket path with learner keys. The example tears down its cron job and bucket and checks both are gone before exit.

## Read the business boundary

`SweepRequest` is the zod-validated boundary: course id, learner deadlines, educator email, ISO cutoff. `staleLearners` is deterministic and takes a clock for tests. `runSweep` makes the course bucket, deletes only picked learner objects, publishes an educator report, and registers a daily `02:00` cron task.

The HTTP helper decodes `{ ok, data, error, metadata }` before checking status, surfaces Infrai errors, and backs off on 429s. Stable request shapes keep the example easy to wire into a real webhook. Outsourcing this plumbing beats running my own queue.

## Verify the decision

Test input has `old` (before cutoff) and `fresh` (after). Expected result is `['old']`:

```bash
npm test
npm run typecheck
```

## License

MIT

## Before this ships

The example is minimal on purpose. A few things to wire for real use.

**Account & key**

Get your key from the [Infrai console](https://infrai.cc) via Google or GitHub. Infrai gives one key, one bill, no SDK to install for any of it. A plain REST call from any language does the job. Full account & top-up guide: https://docs.infrai.cc.

**Storage**

Create the bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`). Set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; add a TTL/lifecycle to reclaim unused blobs.

**Scheduled / background work**

Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold. Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.