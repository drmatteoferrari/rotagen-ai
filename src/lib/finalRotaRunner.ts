// src/lib/finalRotaRunner.ts
// Main-thread wrapper for the rota generation Web Worker.
// FinalRota.tsx creates one instance per generation run.

import type { FinalRotaInput } from '@/lib/rotaGenInput';
import type {
  FinalRotaResult,
  GenerationProgress,
  WorkerInboundMessage,
} from '@/types/finalRota';

// ─── Configuration constants ───────────────────────────────────
// Exported so FinalRota.tsx can import them instead of defining inline.
export const DEFAULT_ITERATIONS = 1000;
export const MIN_ITERATIONS = 100;
export const MAX_ITERATIONS = 50000;
export const WARN_ABOVE_ITERATIONS = 10000;
export const PROGRESS_UPDATE_EVERY_ITERATIONS = 50;
export const CANCEL_CHECK_EVERY_ITERATIONS = 10;

// ─── FinalRotaRunner ───────────────────────────────────────────

type ProgressCb = (progress: GenerationProgress) => void;
type CompleteCb = (result: FinalRotaResult) => void;
type ErrorCb = (message: string) => void;

export class FinalRotaRunner {
  private worker: Worker | null = null;
  private progressCbs: ProgressCb[] = [];
  private completeCbs: CompleteCb[] = [];
  private errorCbs: ErrorCb[] = [];

  start(input: FinalRotaInput, iterations: number): void {
    // Terminate any previous worker before starting a new one
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.worker = new Worker(
      new URL('./finalRotaGenerator.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        this.progressCbs.forEach((cb) => cb(msg.progress));
      } else if (msg.type === 'complete') {
        this.completeCbs.forEach((cb) => cb(msg.result));
      } else if (msg.type === 'error') {
        this.errorCbs.forEach((cb) => cb(msg.message));
      }
    };

    this.worker.onerror = (e: ErrorEvent) => {
      this.errorCbs.forEach((cb) =>
        cb(e.message || 'Worker encountered an unexpected error')
      );
    };

    const startMsg: WorkerInboundMessage = { type: 'start', input, iterations };
    this.worker.postMessage(startMsg);
  }

  cancel(): void {
    if (!this.worker) return;
    const cancelMsg: WorkerInboundMessage = { type: 'cancel' };
    this.worker.postMessage(cancelMsg);
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.progressCbs = [];
    this.completeCbs = [];
    this.errorCbs = [];
  }

  onProgress(cb: ProgressCb): () => void {
    this.progressCbs.push(cb);
    return () => { this.progressCbs = this.progressCbs.filter((c) => c !== cb); };
  }

  onComplete(cb: CompleteCb): () => void {
    this.completeCbs.push(cb);
    return () => { this.completeCbs = this.completeCbs.filter((c) => c !== cb); };
  }

  onError(cb: ErrorCb): () => void {
    this.errorCbs.push(cb);
    return () => { this.errorCbs = this.errorCbs.filter((c) => c !== cb); };
  }
}
// SECTION 3 COMPLETE
