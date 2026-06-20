import { FirebaseApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
import { Database, get, getDatabase, onChildAdded, onDisconnect, push, ref, remove, set } from 'firebase/database';
import { IPeerContext } from '../peer-context';

const LOBBY_ROOT = 'udonarium-lobby';
const STALE_MS = 10 * 60 * 1000;
const RECONNECT_REQUESTS_PATH = `${LOBBY_ROOT}/reconnect-requests`;

interface LobbyEntry {
  peerId: string;
  timestamp: number;
}

export class TrysteroLobby {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Database;
  private registeredPeerId: string | null = null;

  constructor(firebaseApp: FirebaseApp) {
    this.app = firebaseApp;
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app);
  }

  async ensureSignedIn(): Promise<void> {
    if (!this.auth.currentUser) {
      await signInAnonymously(this.auth);
    }
  }

  async register(peer: IPeerContext): Promise<void> {
    await this.ensureSignedIn();
    this.registeredPeerId = peer.peerId;
    const peerRef = ref(this.db, `${LOBBY_ROOT}/peers/${peer.peerId}`);
    const entry: LobbyEntry = { peerId: peer.peerId, timestamp: Date.now() };
    await set(peerRef, entry);
    onDisconnect(peerRef).remove();
  }

  async unregister(): Promise<void> {
    if (!this.registeredPeerId) return;
    const peerRef = ref(this.db, `${LOBBY_ROOT}/peers/${this.registeredPeerId}`);
    await remove(peerRef);
    this.registeredPeerId = null;
  }

  async requestReconnect(targetPeerId: string): Promise<void> {
    await this.ensureSignedIn();
    const newRef = push(ref(this.db, `${RECONNECT_REQUESTS_PATH}/${targetPeerId}`));
    await set(newRef, { timestamp: Date.now() });
    setTimeout(() => remove(newRef).catch(() => {}), 30_000);
  }

  listenForReconnectRequests(myPeerId: string, callback: () => void): () => void {
    const requestsRef = ref(this.db, `${RECONNECT_REQUESTS_PATH}/${myPeerId}`);
    return onChildAdded(requestsRef, (snapshot) => {
      const data = snapshot.val();
      remove(snapshot.ref).catch(() => {});
      // 忽略超過 30 秒的舊請求（Firebase onChildAdded 初始化時會補發現有資料）
      if (Date.now() - (data?.timestamp ?? 0) > 30_000) return;
      callback();
    });
  }

  async listAllPeers(): Promise<string[]> {
    await this.ensureSignedIn();
    const snap = await get(ref(this.db, `${LOBBY_ROOT}/peers`));
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
