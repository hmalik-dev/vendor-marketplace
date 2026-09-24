/**
 * A `BroadcastChannel` for jsdom, which has none. It keeps the one property
 * the sign-out sync depends on: a message reaches every *other* object on the
 * same channel name, never the one that posted it.
 */
export class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  readonly name: string;
  readonly posted: unknown[] = [];
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown): void {
    this.posted.push(data);

    for (const peer of FakeBroadcastChannel.instances) {
      if (peer !== this && peer.name === this.name) {
        peer.deliver(data);
      }
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    this.listeners.clear();
    FakeBroadcastChannel.instances = FakeBroadcastChannel.instances.filter(
      (instance) => instance !== this,
    );
  }

  private deliver(data: unknown): void {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent<unknown>);
    }
  }
}
