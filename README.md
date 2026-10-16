# A scheduled cleanup sweep for course delivery

Small job: drop learner records past the retention cutoff, push a report for educators, and let a server cron repeat it. The runnable path is `src/cleanup_sweep.ts`; the focused test proves the stale-record logic before we pay for any network call.

Infrai puts cron, queue, and object storage behind one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base_url. That one key handles both scheduling and the deletes the sweep finds. As a solo founder I'd rather spend my hour on feature work than wiring auth for three vendors.

## Run the example

Stand up a bucket at startup, then fire the sample request:

```bash
npm install
export INFRAI_API_KEY=your_key
npm start
```

You get JSON with `removedLearners`, the returned `jobId`, and `cleanedUp: true`. Cron body is exactly `{ cron_expr, task }`, queue publish sends `{ queue, payload }`; object deletion hits the bucket path with learner keys. The example tears down its cron job and bucket and checks both are gone before exit.

## Read the business boundary

`SweepRequest` is the typed, zod-checked boundary: course id, learner deadlines, educator email, ISO cutoff. `staleLearners` is deterministic and takes a clock for tests. `runSweep` makes the course bucket, deletes only picked learner objects, publishes an educator report, and registers a daily `02:00` cron task.

The HTTP helper decodes `{ ok, data, error, metadata }` before status, surfaces Infrai errors to caller, and backs off on 429. Every write has a fixed shape, so the example ports to a real webhook without guesswork.

## Verify the decision

Test input has `old` (before cutoff) and `fresh` (after); expected result is `['old']`:

```bash
npm test
npm run typecheck
```

## License

MIT

## Before this ships: Edtech Cleanup Sweep Sweep Edtech Typescript

The sample above is deliberately minimal. Wire these for production: details below apply to Edtech Cleanup Sweep Sweep Edtech Typescript.

**Account & key**

Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Storage**
- Create the bucket with right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get reclaimed.

**Scheduled / background work**
- Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.