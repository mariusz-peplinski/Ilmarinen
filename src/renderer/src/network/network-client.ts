import {
  NETWORK_PROTOCOL_VERSION,
  type MapId,
  type ClientMessage,
  type ClientPlayerSnapshotMessage,
  type NetworkAttackEvent,
  type NetworkInteractionEvent,
  type ServerMessage
} from '../../../shared/network-protocol';

type NetworkStatus = 'offline' | 'connecting' | 'connected' | 'error';

interface NetworkClientHandlers {
  onStatusChange: (status: NetworkStatus, detail: string) => void;
  onMessage: (message: ServerMessage) => void;
}

export class NetworkClient {
  private socket: WebSocket | null = null;
  private readonly handlers: NetworkClientHandlers;
  public playerId: string | null = null;

  public constructor(handlers: NetworkClientHandlers) {
    this.handlers = handlers;
  }

  public get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public get active(): boolean {
    return (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    );
  }

  public connect(url: string, displayName: string): void {
    this.disconnect();
    this.handlers.onStatusChange('connecting', `Connecting to ${url}`);

    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.send({
        type: 'hello',
        name: displayName,
        protocolVersion: NETWORK_PROTOCOL_VERSION
      });
      this.handlers.onStatusChange('connected', `Connected to ${url}`);
    });

    socket.addEventListener('message', (event) => {
      const message = this.parseServerMessage(event.data);
      if (!message) {
        return;
      }

      if (message.type === 'welcome') {
        this.playerId = message.playerId;
      }

      this.handlers.onMessage(message);
    });

    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.playerId = null;
      }
      this.handlers.onStatusChange('offline', 'Disconnected');
    });

    socket.addEventListener('error', () => {
      this.handlers.onStatusChange('error', 'Connection error');
    });
  }

  public disconnect(): void {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    this.playerId = null;
    socket.close();
    this.handlers.onStatusChange('offline', 'Disconnected');
  }

  public sendPlayerSnapshot(snapshot: ClientPlayerSnapshotMessage): void {
    this.send(snapshot);
  }

  public sendAttack(event: Omit<NetworkAttackEvent, 'seq' | 'clientTime'>): void {
    this.send({
      type: 'attack',
      seq: this.nextSeq(),
      clientTime: performance.now(),
      ...event
    });
  }

  public sendInteract(event: Omit<NetworkInteractionEvent, 'seq' | 'clientTime'>): void {
    this.send({
      type: 'interact',
      seq: this.nextSeq(),
      clientTime: performance.now(),
      ...event
    });
  }

  public sendActorTouched(actorId: string, actorKind: 'npc' | 'flower' | 'trigger'): void {
    this.send({
      type: 'actorTouched',
      clientTime: performance.now(),
      actorId,
      actorKind
    });
  }

  public sendCrystalPickedUp(actorId: string): void {
    this.send({
      type: 'crystalPickedUp',
      clientTime: performance.now(),
      actorId
    });
  }

  public sendTeleport(targetMapId: MapId, targetX: number, targetY: number): void {
    this.send({
      type: 'teleport',
      clientTime: performance.now(),
      targetMapId,
      targetX,
      targetY
    });
  }

  public sendRegenerateOverworld(): void {
    this.send({
      type: 'regenerateOverworld',
      clientTime: performance.now()
    });
  }

  private send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private nextSeq(): number {
    return Math.floor(performance.now() * 1000);
  }

  private parseServerMessage(data: unknown): ServerMessage | null {
    if (typeof data !== 'string') {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(data);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'type' in parsed &&
        typeof (parsed as { type: unknown }).type === 'string'
      ) {
        return parsed as ServerMessage;
      }
    } catch {
      return null;
    }

    return null;
  }
}
