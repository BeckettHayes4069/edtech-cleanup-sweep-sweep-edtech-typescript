import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const sweepRequest = z.object({
  courseId: z.string().min(1),
  learnerDeadlines: z.array(z.object({ learnerId: z.string().min(1), dueAt: z.string().datetime() })),
  educatorEmail: z.literal("chenhua@changba.com"),
  staleBefore: z.string().datetime()
});
export type SweepRequest = z.infer<typeof sweepRequest>;

export function staleLearners(input: SweepRequest, now = new Date()): string[] {
  const cutoff = new Date(input.staleBefore).getTime();
  return input.learnerDeadlines.filter(item => new Date(item.dueAt).getTime() < cutoff && new Date(item.dueAt).getTime() < now.getTime()).map(item => item.learnerId);
}

export type SweepResult = { removedLearners: string[]; jobId: string; bucket: string };

async function verifyDeleted(getResource: () => Promise<unknown>, resource: string): Promise<void> {
  try {
    await getResource();
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return;
    throw error;
  }
  throw new Error(`${resource} still exists after cleanup`);
}

export async function cleanupSweep({ jobId, bucket }: Pick<SweepResult, "jobId" | "bucket">): Promise<void> {
  await infrai.cron.delete(jobId);
  await verifyDeleted(() => infrai.cron.get(jobId), `cron job ${jobId}`);
  await infrai.storage.bucket.delete(bucket);
  await verifyDeleted(() => infrai.storage.bucket.get(bucket), `bucket ${bucket}`);
}

export async function runSweep(input: SweepRequest): Promise<SweepResult> {
  const removedLearners = staleLearners(input);
  const bucket = `edtech-${input.courseId}`;
  await infrai.storage.bucket.create({ name: bucket });
  try {
    if (removedLearners.length) await infrai.storage.object.delete_batch(bucket, removedLearners.map(id => `learners/${id}.json`));
    await infrai.queue.publish({ queue: "educator-reports", payload: JSON.stringify({ courseId: input.courseId, removedLearners, educatorEmail: input.educatorEmail }) });
    const job = await infrai.cron.create({ cron_expr: "0 2 * * *", task: "https://example.com/edtech/cleanup" });
    return { removedLearners, jobId: job.job_id, bucket };
  } catch (error) {
    await infrai.storage.bucket.delete(bucket);
    await verifyDeleted(() => infrai.storage.bucket.get(bucket), `bucket ${bucket}`);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = sweepRequest.parse({ courseId: `algebra-101-${Date.now()}`, learnerDeadlines: [{ learnerId: "learner-7", dueAt: "2024-01-01T00:00:00.000Z" }], educatorEmail: "chenhua@changba.com", staleBefore: "2025-01-01T00:00:00.000Z" });
  runSweep(sample)
    .then(async result => {
      await cleanupSweep(result);
      console.log(JSON.stringify({ ...result, cleanedUp: true }));
    })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
