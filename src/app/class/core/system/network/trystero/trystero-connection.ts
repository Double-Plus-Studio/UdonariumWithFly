import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import type { MessageAction, Room } from '@trystero-p2p/firebase';
import { joinRoom, selfId } from '@trystero-p2p/firebase';

import { compressAsync, decompressAsync } from '../../util/compress';
import { MessagePack } from '../../util/message-pack';
import { setZeroTimeout } from '../../util/zero-timeout';
import { Connection, ConnectionCallback } from '../connection';
import { IPeerContext, PeerContext } from '../peer-context';
import { PeerSessionGrade } from '../peer-session-state';
import { IRoomInfo, RoomInfo } from '../room-info';
import { TrysteroLobby } from './trystero-lobby';

interface DataContainer {
  data: Uint8Array;
  ttl: number;
  isCompressed?: boolean;
}

interface HelloPayload {
  peerId: string;
  userId: string;
}

type TrysteroPeerId = string;

export class TrysteroConnection implements Connection {
  get peerId(): string { return this._peer?.peerId ?? ''; }
  get peerIds(): string[] { return Array.from(this.trysteroToContext.keys()); }
  get peer(): PeerContext { return this._peer; }
  get peers(): PeerContext[] { return Array.from(this.trysteroToContext.values()); }

  readonly callback: ConnectionCallback = new ConnectionCallback();
  bandwidthUsage: number = 0;

  private _peer: PeerContext;
  private room: Room | null = null;
  private firebaseApp: FirebaseApp | null = null;
  private lobby: TrysteroLobby | null = null;
  private config: any = {};

  // Trystero peer ID → Udonarium PeerContext
  private trysteroToContext: Map<TrysteroPeerId, PeerContext> = new Map();
  // Udonarium peerId → Trystero peer ID
  private udonariumToTrystero: Map<string, TrysteroPeerId> = new Map();

  private gameAction: MessageAction<ArrayBuffer> | null = null;
  private helloAction: MessageAction<HelloPayload> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private unlistenReconnect: (() => void) | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastReconnectTime = 0;
  private reconnectRequestedPeers = new Map<string, number>();

  private outboundQueue: Promise<void> = Promise.resolve();
  private inboundQueue: Promise<void> = Promise.resolve();

  configure(config: any) {
    this.config = config;
  }

  open(userId?: string): void;
  open(userId: string, roomId: string, roomName: string, password: string): void;
  open(...args: any[]): void {
    let peer: PeerContext;
    if (args.length === 0) {
      peer = PeerContext.create(PeerContext.generateId());
    } else if (args.length === 1) {
      peer = PeerContext.create(args[0]);
    } else {
      peer = PeerContext.create(args[0], args[1], args[2], args[3]);
    }
    this._peer = peer;
    this.openAsync(peer);
  }

  close(): void {
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.unlistenReconnect) { this.unlistenReconnect(); this.unlistenReconnect = null; }
    if (this.reconnectTimeoutId) { clearTimeout(this.reconnectTimeoutId); this.reconnectTimeoutId = null; }
    this.lobby?.unregister();
    this.room?.leave();
    this.room = null;
    this.gameAction = null;
    this.helloAction = null;
    this.trysteroToContext.clear();
    this.udonariumToTrystero.clear();
    if (this._peer?.isOpen) {
      this._peer.isOpen = false;
      if (this.callback.onClose) this.callback.onClose(this._peer);
    }
  }

  connect(peer: IPeerContext): boolean {
    // Already connected
    if (this.udonariumToTrystero.has(peer.peerId)) return true;
    // Valid room peer — Trystero will connect automatically;
    // return true so the lobby waits for the CONNECT_PEER event
    // instead of treating it as an immediate failure.
    if (this._peer?.isRoom && this._peer.verifyPeer(peer.peerId)) return true;
    return false;
  }

  disconnect(peer: IPeerContext): boolean {
    const trysteroId = this.udonariumToTrystero.get(peer.peerId);
    if (!trysteroId) return false;
    this.removePeer(trysteroId);
    return true;
  }

  disconnectAll(): void {
    for (const context of this.trysteroToContext.values()) {
      if (this.callback.onDisconnect) this.callback.onDisconnect(context);
    }
    this.trysteroToContext.clear();
    this.udonariumToTrystero.clear();
  }

  send(data: any, sendTo?: string): void {
    if (this.trysteroToContext.size < 1) return;

    const container: DataContainer = {
      data: MessagePack.encode(data),
      ttl: 0,
    };

    const byteLength = container.data.byteLength;
    this.bandwidthUsage += byteLength;

    this.outboundQueue = this.outboundQueue.then(() => new Promise<void>(resolve => {
      setZeroTimeout(async () => {
        if (1024 < container.data.byteLength && Array.isArray(data) && 1 < data.length) {
          const compressed = await compressAsync(container.data);
          if (compressed.byteLength < container.data.byteLength) {
            container.data = compressed;
            container.isCompressed = true;
          }
        }

        const encoded = MessagePack.encode(container).buffer as ArrayBuffer;

        if (sendTo) {
          const trysteroId = this.udonariumToTrystero.get(sendTo);
          if (trysteroId && this.gameAction) {
            this.gameAction.send(encoded, { target: [trysteroId] });
          }
        } else if (this.gameAction) {
          this.gameAction.send(encoded);
        }

        this.bandwidthUsage -= byteLength;
        resolve();
      });
    }));
  }

  async listAllPeers(): Promise<string[]> {
    return this.lobby?.listAllPeers() ?? [];
  }

  async listAllRooms(): Promise<IRoomInfo[]> {
    const peerIds = await this.listAllPeers();
    return RoomInfo.listFrom(peerIds);
  }

  async reregisterLobby(): Promise<void> {
    if (this._peer?.isRoom) await this.lobby?.register(this._peer);
  }

  private async openAsync(peer: PeerContext): Promise<void> {
    const firebaseConfig = this.config?.trystero?.firebase;
    if (!firebaseConfig?.databaseURL) {
      const msg = 'Trystero：尚未設定 Firebase databaseURL，請確認 config.yaml。';
      console.error(msg);
      if (this.callback.onError) this.callback.onError(peer, 'trystero-config', msg, {});
      return;
    }

    try {
      const appName = 'trystero-main';
      const existing = getApps().find(a => a.name === appName);
      this.firebaseApp = existing ?? initializeApp(firebaseConfig, appName);

      this.lobby = new TrysteroLobby(this.firebaseApp);
      await this.lobby.ensureSignedIn();
      if (peer.isRoom) {
        await this.lobby.register(peer);
        this.unlistenReconnect = this.lobby.listenForReconnectRequests(peer.peerId, () => this.handleReconnectRequest());
      }

      const trysteroRoomId = this.calcTrysteroRoomId(peer);
      this.room = joinRoom(
        {
          appId: firebaseConfig.databaseURL,
          relayConfig: { firebaseApp: this.firebaseApp },
        },
        trysteroRoomId
      );

      const gameAction = this.room.makeAction<ArrayBuffer>('game');
      const helloAction = this.room.makeAction<HelloPayload>('hello');
      this.gameAction = gameAction;
      this.helloAction = helloAction;

      gameAction.onMessage = (buffer: ArrayBuffer, { peerId: trysteroId }) => {
        this.onGameData(trysteroId, buffer);
      };

      helloAction.onMessage = (payload: HelloPayload, { peerId: trysteroId }) => {
        this.onHello(trysteroId, payload);
      };

      this.room.onPeerJoin = async (trysteroId: TrysteroPeerId) => {
        console.log('Trystero: peer joined', trysteroId);
        // 送出 hello 後若對方沒有回應（trysteroToContext 未新增該 peer），
        // 代表 hello 可能在 data channel 剛建立時遺失，每秒重試一次直到收到對方的 hello。
        for (let attempt = 0; attempt <= 5; attempt++) {
          if (this.trysteroToContext.has(trysteroId) || !this.room) break;
          this.helloAction?.send(
            { peerId: this._peer.peerId, userId: this._peer.userId },
            { target: [trysteroId] }
          );
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };

      this.room.onPeerLeave = (trysteroId: TrysteroPeerId) => {
        console.log('Trystero: peer left', trysteroId);
        this.removePeer(trysteroId);
      };

      // 無論是否有初始連線，進房間後就啟動 sync，確保 Trystero 完全沒連上任何人時也能觸發重連
      if (peer.isRoom && !this.syncInterval) {
        this.syncInterval = setInterval(() => this.syncRoomPeersAsync(), 60000);
      }

      this._peer.isOpen = true;
      if (this.callback.onOpen) this.callback.onOpen(this._peer);

    } catch (error) {
      console.error('Trystero open error:', error);
      if (this.callback.onError) {
        this.callback.onError(peer, 'trystero-open', String(error), error);
      }
    }
  }

  // Derive Trystero room ID from Udonarium room params.
  // peerId format: digestUserId(6) + checksumedRoomId(3) + lzbase62(roomName) + '-' + digestPassword
  // digestPassword incorporates userId so it differs per user — exclude it.
  // Use only checksumedRoomId + lzbase62(roomName), which is the same for everyone in the room.
  private calcTrysteroRoomId(peer: PeerContext): string {
    if (!peer.isRoom) return `private-${peer.digestUserId}`;
    const withoutUserId = peer.peerId.slice(6);
    const dashIndex = withoutUserId.lastIndexOf('-');
    const roomPart = dashIndex >= 0 ? withoutUserId.slice(0, dashIndex) : withoutUserId;
    return `room-${roomPart}`;
  }

  private onHello(trysteroId: TrysteroPeerId, payload: HelloPayload): void {
    // 已處理過同一個 peer 的 hello，不重複觸發 onConnect，避免 SYNCHRONIZE_GAME_OBJECT 多次執行產生 race condition
    if (this.trysteroToContext.has(trysteroId)) return;

    const context = PeerContext.parse(payload.peerId);
    context.userId = payload.userId;

    if (this._peer.isRoom && !this._peer.verifyPeer(payload.peerId)) {
      console.warn('Trystero: invalid peer rejected', payload.peerId);
      return;
    }

    context.isOpen = true;
    context.session.health = 1.0;
    context.session.grade = PeerSessionGrade.HIGH;
    context.session.speed = 1.0;
    context.session.description = 'WebRTC (Trystero)';

    this.trysteroToContext.set(trysteroId, context);
    this.udonariumToTrystero.set(payload.peerId, trysteroId);

    if (this.callback.onConnect) this.callback.onConnect(context);

    // Start periodic ping if not already running
    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => this.updatePingAll(), 30000);
    }
  }

  private async updatePingAll(): Promise<void> {
    if (!this.room) return;
    for (const [trysteroId, context] of this.trysteroToContext) {
      try {
        const pingMs = await this.room.ping(trysteroId);
        context.session.ping = pingMs;
        // ping → health: <50ms=1.0, <100ms=0.98, <200ms=0.96, >=200ms=0.94
        context.session.health = pingMs < 50 ? 1.0 : pingMs < 100 ? 0.98 : pingMs < 200 ? 0.96 : 0.94;
      } catch {
        // peer might have disconnected
      }
    }
  }

  private removePeer(trysteroId: TrysteroPeerId): void {
    const context = this.trysteroToContext.get(trysteroId);
    this.trysteroToContext.delete(trysteroId);
    if (context) {
      this.udonariumToTrystero.delete(context.peerId);
      context.isOpen = false;
      if (this.callback.onDisconnect) this.callback.onDisconnect(context);
    }
  }

  async requestReconnect(targetPeerId: string): Promise<void> {
    await this.lobby?.requestReconnect(targetPeerId);
  }

  private handleReconnectRequest(): void {
    if (!this._peer?.isRoom) return;
    const now = Date.now();
    if (now - this.lastReconnectTime < 30_000) return;
    this.lastReconnectTime = now;

    const userId = this._peer.userId;
    const roomId = this._peer.roomId;
    const roomName = this._peer.roomName;
    const password = this._peer.password;
    // setTimeout 避免在 Firebase callback 內同步呼叫 close()
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      console.log('Trystero: reconnect requested, rejoining room');
      this.close();
      this.open(userId, roomId, roomName, password);
    }, 0);
  }

  private async syncRoomPeersAsync(): Promise<void> {
    if (!this._peer?.isRoom) return;
    try {
      const rooms = await this.listAllRooms();
      const currentRoom = rooms.find(r => r.id === this._peer.roomId && r.name === this._peer.roomName);
      if (!currentRoom) return;

      const connectedIds = new Set(this.udonariumToTrystero.keys());
      const targetPeers = this._peer.hasPassword
        ? currentRoom.filterByPassword(this._peer.password)
        : currentRoom.peers;

      const now = Date.now();
      for (const peer of targetPeers) {
        if (connectedIds.has(peer.peerId)) continue;
        const lastRequest = this.reconnectRequestedPeers.get(peer.peerId) ?? 0;
        if (now - lastRequest < 60_000) continue;
        this.reconnectRequestedPeers.set(peer.peerId, now);
        console.log('Trystero: requesting reconnect from peer', peer.peerId);
        this.lobby?.requestReconnect(peer.peerId);
      }
    } catch (e) {
      console.warn('Trystero: room peer sync failed:', e);
    }
  }

  private onGameData(trysteroId: TrysteroPeerId, buffer: ArrayBuffer): void {
    const peer = this.trysteroToContext.get(trysteroId);
    if (!peer) {
      console.warn('Trystero: data from unknown peer', trysteroId);
      return;
    }

    const byteLength = buffer.byteLength;
    this.bandwidthUsage += byteLength;

    this.inboundQueue = this.inboundQueue.then(() => new Promise<void>(resolve => {
      setZeroTimeout(async () => {
        if (!this.callback.onData) { resolve(); return; }

        const container = MessagePack.decode(new Uint8Array(buffer)) as DataContainer;
        const raw = container.isCompressed
          ? await decompressAsync(container.data)
          : container.data;

        this.callback.onData(peer, MessagePack.decode(raw));
        this.bandwidthUsage -= byteLength;
        resolve();
      });
    }));
  }
}
