import { FirebaseApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
import { Database, DataSnapshot, DatabaseReference, get, getDatabase, onChildAdded, onDisconnect, push, ref, remove, set } from 'firebase/database';
import { IPeerContext } from '../peer-context';

const LOBBY_ROOT = 'udonarium-lobby';
const STALE_MS = 10 * 60 * 1000;
const RECONNECT_REQUESTS_PATH = `${LOBBY_ROOT}/reconnect-requests`;

interface LobbyEntry {
  peerId: string;
  timestamp: number;
}

export interface TrysteroLobbyDeps {
  auth: Auth;
  db: Database;
  ref(db: Database, path: string): DatabaseReference;
  get(ref: DatabaseReference): Promise<DataSnapshot>;
  set(ref: DatabaseReference, value: unknown): Promise<void>;
  remove(ref: DatabaseReference): Promise<void>;
  push(ref: DatabaseReference): DatabaseReference;
  onDisconnect(ref: DatabaseReference): { remove(): Promise<void> };
  onChildAdded(ref: DatabaseReference, callback: (snap: DataSnapshot) => void): () => void;
  signInAnonymously(auth: Auth): Promise<unknown>;
}

export class TrysteroLobby {
  private readonly deps: TrysteroLobbyDeps;
  private registeredPeerId: string | null = null;

  constructor(firebaseApp: FirebaseApp, depsOverride?: Partial<TrysteroLobbyDeps>) {
    const auth = depsOverride?.auth ?? getAuth(firebaseApp);
    const db = depsOverride?.db ?? getDatabase(firebaseApp);
    this.deps = {
      auth,
      db,
      ref: depsOverride?.ref ?? ((database, path) => ref(database, path)),
      get: depsOverride?.get ?? get,
      set: depsOverride?.set ?? set,
      remove: depsOverride?.remove ?? remove,
      push: depsOverride?.push ?? push,
      onDisconnect: depsOverride?.onDisconnect ?? onDisconnect,
      onChildAdded: depsOverride?.onChildAdded ?? onChildAdded,
      signInAnonymously: depsOverride?.signInAnonymously ?? signInAnonymously,
    };
  }

  async ensureSignedIn(): Promise<void> {
    // 先等待 auth 從 IndexedDB 還原完成再判斷是否已登入，
    // 避免同一瀏覽器新開的視窗重複呼叫 signInAnonymously。
    await this.deps.auth.authStateReady?.();
    if (!this.deps.auth.currentUser) {
      await this.deps.signInAnonymously(this.deps.auth);
    }
  }

  async register(peer: IPeerContext): Promise<void> {
    await this.ensureSignedIn();
    this.registeredPeerId = peer.peerId;
    const peerRef = this.deps.ref(this.deps.db, `${LOBBY_ROOT}/peers/${peer.peerId}`);
    const entry: LobbyEntry = { peerId: peer.peerId, timestamp: Date.now() };
    await this.deps.set(peerRef, entry);
    this.deps.onDisconnect(peerRef).remove();
  }

  async unregister(): Promise<void> {
    if (!this.registeredPeerId) return;
    const peerRef = this.deps.ref(this.deps.db, `${LOBBY_ROOT}/peers/${this.registeredPeerId}`);
    await this.deps.remove(peerRef);
    this.registeredPeerId = null;
  }

  async requestReconnect(targetPeerId: string): Promise<void> {
    await this.ensureSignedIn();
    const newRef = this.deps.push(this.deps.ref(this.deps.db, `${RECONNECT_REQUESTS_PATH}/${targetPeerId}`));
    await this.deps.set(newRef, { timestamp: Date.now() });
    setTimeout(() => this.deps.remove(newRef).catch(() => {}), 30_000);
  }

  listenForReconnectRequests(myPeerId: string, callback: () => void): () => void {
    const requestsRef = this.deps.ref(this.deps.db, `${RECONNECT_REQUESTS_PATH}/${myPeerId}`);
    return this.deps.onChildAdded(requestsRef, (snapshot) => {
      const data = (snapshot as any).val();
      this.deps.remove((snapshot as any).ref).catch(() => {});
      // 忽略超過 30 秒的舊請求（Firebase onChildAdded 初始化時會補發現有資料）
      if (Date.now() - (data?.timestamp ?? 0) > 30_000) return;
      callback();
    });
  }

  async listAllPeers(): Promise<string[]> {
    await this.ensureSignedIn();
    const snap = await this.deps.get(this.deps.ref(this.deps.db, `${LOBBY_ROOT}/peers`));
    if (!snap.exists()) return [];

    const now = Date.now();
    const peerIds: string[] = [];

    snap.forEach(child => {
      const entry = child.val() as LobbyEntry;
      if (entry?.peerId && now - (entry.timestamp ?? 0) < STALE_MS) {
        peerIds.push(entry.peerId);
      }
    });

    return peerIds;
  }
}
