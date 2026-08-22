// Facade-side client for the bot Web Worker. Lives in src/game (the I/O
// boundary), so unlike src/bot it may touch the DOM - here only to spawn the
// worker and pass messages. It exposes a Promise-based plan() the screen uses to
// show "bot thinking" while the worker plans off the render thread, then executes
// the returned shot through the same simulate -> rules path as the player.
//
// The `new Worker(new URL('../bot/worker.ts', import.meta.url), ...)` form is
// what makes Vite emit the worker as its own chunk (precached by the SW).

import type { BotPlan, BotPlanRequest, BotPlanResponse } from '../types/bot';

export interface BotClient {
  // Plan a shot off-thread. Resolves with the shot to play and the trail of
  // shots the search weighed on the way there.
  plan(request: Omit<BotPlanRequest, 'id'>): Promise<BotPlan>;
  // Tear the worker down (e.g. when leaving the game screen).
  terminate(): void;
}

export const createBotClient = (): BotClient => {
  const worker = new Worker(new URL('../bot/worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, (plan: BotPlan) => void>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<BotPlanResponse>): void => {
    const { id, shot, considered } = event.data;
    const resolve = pending.get(id);
    if (resolve !== undefined) {
      pending.delete(id);
      resolve({ shot, considered });
    }
  };

  return {
    plan: (request) =>
      new Promise<BotPlan>((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        worker.postMessage({ id, ...request });
      }),
    terminate: () => worker.terminate(),
  };
};
