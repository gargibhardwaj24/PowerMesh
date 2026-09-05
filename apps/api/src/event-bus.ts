import { EventEmitter } from "node:events";

export interface PublishedJobEvent {
  jobId: string;
  sequence: number;
}

export type JobEventListener = (event: PublishedJobEvent) => void;

export class JobEventBus {
  readonly #emitter = new EventEmitter();

  constructor() {
    this.#emitter.setMaxListeners(500);
  }

  publish(event: PublishedJobEvent): void {
    this.#emitter.emit(event.jobId, event);
  }

  subscribe(jobId: string, listener: JobEventListener): () => void {
    this.#emitter.on(jobId, listener);
    return () => this.#emitter.off(jobId, listener);
  }

  listenerCount(jobId: string): number {
    return this.#emitter.listenerCount(jobId);
  }
}
