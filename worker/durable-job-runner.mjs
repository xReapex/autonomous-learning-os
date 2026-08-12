const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDurableJobRunner({ store, execute, validateOutput, idleDelayMs = 250, cancellationPollMs = 250, onError = () => undefined }) {
  const controllers = new Map();
  const active = new Set();
  let started = false;
  let loopPromise = null;

  async function processOne() {
    const job = await store.claimNext();
    if (!job) return false;
    const controller = new AbortController();
    controllers.set(job.id, controller);
    const cancellationTimer = setInterval(() => {
      void store.getById(job.id).then((current) => {
        if (!current || current.status !== "running") controller.abort();
      }, () => undefined);
    }, cancellationPollMs);
    try {
      const output = await execute(job.payload, controller.signal);
      if (controller.signal.aborted) return true;
      const current = await store.getById(job.id);
      if (!current || current.status !== "running") return true;
      if (!validateOutput(output)) {
        await store.fail(job.id, "invalid_output");
        return true;
      }
      if (!controller.signal.aborted) await store.succeed(job.id, output);
    } catch (error) {
      if (!controller.signal.aborted) {
        await store.fail(job.id, "execution_failed");
        onError(error instanceof Error ? error.message : "worker");
      }
    } finally {
      clearInterval(cancellationTimer);
      controllers.delete(job.id);
    }
    return true;
  }

  async function runOnce() {
    const operation = processOne();
    active.add(operation);
    try { return await operation; }
    finally { active.delete(operation); }
  }

  async function loop() {
    while (started) {
      const didWork = await runOnce();
      if (!didWork && started) await sleep(idleDelayMs);
    }
  }

  return {
    async start({ background = false } = {}) {
      if (started) return;
      await store.recoverInterrupted();
      started = true;
      if (background) loopPromise = loop();
    },
    runOnce,
    cancel(jobId) { controllers.get(jobId)?.abort(); },
    async stop() {
      started = false;
      for (const controller of controllers.values()) controller.abort();
      await Promise.allSettled([...active]);
      if (loopPromise) await loopPromise;
      loopPromise = null;
    },
  };
}
