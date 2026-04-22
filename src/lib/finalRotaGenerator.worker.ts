// src/lib/finalRotaGenerator.worker.ts
// Web Worker entry point for rota generation.
// Receives WorkerInboundMessage, posts WorkerOutboundMessage.
// Do NOT import anything from React, the DOM, or Supabase — this runs off the main thread.

import { generateFinalRota } from './finalRotaGenerator';
import type { WorkerInboundMessage, WorkerOutboundMessage } from '@/types/finalRota';

let cancelled = false;

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (msg.type === 'start') {
    cancelled = false;
    try {
      const result = await generateFinalRota(msg.input, {
        iterations: msg.iterations,
        onProgress: (progress) => {
          const out: WorkerOutboundMessage = { type: 'progress', progress };
          self.postMessage(out);
        },
        shouldCancel: () => cancelled,
      });
      const out: WorkerOutboundMessage = { type: 'complete', result };
      self.postMessage(out);
    } catch (error) {
      const out: WorkerOutboundMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(out);
    }
  }
};
// SECTION 2 COMPLETE
