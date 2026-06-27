import { FirebaseApp } from 'firebase/app';
import { TrysteroLobby, TrysteroLobbyDeps } from './trystero-lobby';

function makeDeps(overrides: Partial<TrysteroLobbyDeps> = {}): TrysteroLobbyDeps {
  return {
    auth: { currentUser: null } as any,
    db: {} as any,
    ref: jasmine.createSpy('ref').and.returnValue({} as any),
    get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ exists: () => false, forEach: () => {} })),
    set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
    remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
    push: jasmine.createSpy('push').and.returnValue({} as any),
    onDisconnect: jasmine.createSpy('onDisconnect').and.returnValue({ remove: jasmine.createSpy('onDisconnectRemove') }),
    onChildAdded: jasmine.createSpy('onChildAdded').and.returnValue(() => {}),
    signInAnonymously: jasmine.createSpy('signInAnonymously').and.returnValue(Promise.resolve()),
    ...overrides,
  };
}

describe('TrysteroLobby', () => {
  describe('ensureSignedIn()', () => {
    it('currentUser 為 null 時應呼叫 signInAnonymously', async () => {
      const deps = makeDeps({ auth: { currentUser: null } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.ensureSignedIn();

      expect(deps.signInAnonymously).toHaveBeenCalledWith(deps.auth);
    });

    it('已登入時不應重複呼叫 signInAnonymously', async () => {
      const deps = makeDeps({ auth: { currentUser: { uid: 'u1' } } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.ensureSignedIn();

      expect(deps.signInAnonymously).not.toHaveBeenCalled();
    });
  });

  describe('register()', () => {
    it('應在正確路徑寫入 peerId 和 timestamp', async () => {
      const deps = makeDeps({ auth: { currentUser: { uid: 'u1' } } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.register({ peerId: 'peer-abc' } as any);

      expect(deps.ref).toHaveBeenCalledWith(deps.db, 'udonarium-lobby/peers/peer-abc');
      expect(deps.set).toHaveBeenCalledWith(
        jasmine.any(Object),
        jasmine.objectContaining({ peerId: 'peer-abc', timestamp: jasmine.any(Number) })
      );
    });

    it('應設定 onDisconnect 自動清除', async () => {
      const mockDisconnect = { remove: jasmine.createSpy('remove') };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        onDisconnect: jasmine.createSpy('onDisconnect').and.returnValue(mockDisconnect),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.register({ peerId: 'peer-abc' } as any);

      expect(deps.onDisconnect).toHaveBeenCalled();
      expect(mockDisconnect.remove).toHaveBeenCalled();
    });
  });

  describe('unregister()', () => {
    it('未登記時不應呼叫 remove', async () => {
      const deps = makeDeps();
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.unregister();

      expect(deps.remove).not.toHaveBeenCalled();
    });

    it('已登記時應呼叫 remove', async () => {
      const deps = makeDeps({ auth: { currentUser: { uid: 'u1' } } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.register({ peerId: 'peer-xyz' } as any);
      await lobby.unregister();

      expect(deps.remove).toHaveBeenCalledTimes(1);
    });

    it('unregister 後再次 unregister 不應重複呼叫 remove', async () => {
      const deps = makeDeps({ auth: { currentUser: { uid: 'u1' } } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.register({ peerId: 'peer-xyz' } as any);
      await lobby.unregister();
      await lobby.unregister();

      expect(deps.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('listAllPeers()', () => {
    it('Firebase 快照不存在時應回傳空陣列', async () => {
      const emptySnap = { exists: () => false, forEach: () => {} };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve(emptySnap)),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      const peers = await lobby.listAllPeers();
      expect(peers).toEqual([]);
    });

    it('應回傳未過期的新鮮 peer', async () => {
      const now = Date.now();
      const entries = [{ peerId: 'fresh-peer', timestamp: now - 60_000 }];
      const snap = {
        exists: () => true,
        forEach: (cb: (child: any) => void) => entries.forEach(e => cb({ val: () => e })),
      };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve(snap)),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      const peers = await lobby.listAllPeers();
      expect(peers).toContain('fresh-peer');
    });

    it('應過濾掉超過 10 分鐘的過期 peer', async () => {
      const now = Date.now();
      const entries = [{ peerId: 'stale-peer', timestamp: now - 11 * 60 * 1000 }];
      const snap = {
        exists: () => true,
        forEach: (cb: (child: any) => void) => entries.forEach(e => cb({ val: () => e })),
      };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve(snap)),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      const peers = await lobby.listAllPeers();
      expect(peers).not.toContain('stale-peer');
    });

    it('應只回傳新鮮的 peer，過濾掉過期的', async () => {
      const now = Date.now();
      const entries = [
        { peerId: 'fresh-1', timestamp: now - 60_000 },
        { peerId: 'stale-1', timestamp: now - 11 * 60_000 },
        { peerId: 'fresh-2', timestamp: now - 5 * 60_000 },
      ];
      const snap = {
        exists: () => true,
        forEach: (cb: (child: any) => void) => entries.forEach(e => cb({ val: () => e })),
      };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve(snap)),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      const peers = await lobby.listAllPeers();
      expect(peers).toContain('fresh-1');
      expect(peers).toContain('fresh-2');
      expect(peers).not.toContain('stale-1');
    });

    it('entry 沒有 peerId 欄位時應忽略', async () => {
      const snap = {
        exists: () => true,
        forEach: (cb: (child: any) => void) => cb({ val: () => ({ timestamp: Date.now() }) }),
      };
      const deps = makeDeps({
        auth: { currentUser: { uid: 'u1' } } as any,
        get: jasmine.createSpy('get').and.returnValue(Promise.resolve(snap)),
      });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      const peers = await lobby.listAllPeers();
      expect(peers).toEqual([]);
    });
  });

  describe('listenForReconnectRequests()', () => {
    let capturedCallback: (snapshot: any) => void;
    let deps: TrysteroLobbyDeps;
    let lobby: TrysteroLobby;

    beforeEach(() => {
      deps = makeDeps({
        onChildAdded: jasmine.createSpy('onChildAdded').and.callFake((_ref: any, cb: any) => {
          capturedCallback = cb;
          return () => {};
        }),
      });
      lobby = new TrysteroLobby({} as FirebaseApp, deps);
    });

    it('應回傳取消訂閱函式', () => {
      const unsubscribe = lobby.listenForReconnectRequests('my-peer', () => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('30 秒內的新請求應觸發 callback', () => {
      const callback = jasmine.createSpy('callback');
      lobby.listenForReconnectRequests('my-peer', callback);

      capturedCallback({ val: () => ({ timestamp: Date.now() - 5000 }), ref: {} });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('超過 30 秒的舊請求應被忽略', () => {
      const callback = jasmine.createSpy('callback');
      lobby.listenForReconnectRequests('my-peer', callback);

      capturedCallback({ val: () => ({ timestamp: Date.now() - 31_000 }), ref: {} });

      expect(callback).not.toHaveBeenCalled();
    });

    it('timestamp 為 0 的請求應被忽略', () => {
      const callback = jasmine.createSpy('callback');
      lobby.listenForReconnectRequests('my-peer', callback);

      capturedCallback({ val: () => ({ timestamp: 0 }), ref: {} });

      expect(callback).not.toHaveBeenCalled();
    });

    it('每個請求都應呼叫 remove 清除快照', () => {
      lobby.listenForReconnectRequests('my-peer', () => {});
      capturedCallback({ val: () => ({ timestamp: Date.now() }), ref: {} });

      expect(deps.remove).toHaveBeenCalledTimes(1);
    });

    it('應監聽正確的 reconnect-requests 路徑', () => {
      lobby.listenForReconnectRequests('my-peer-id', () => {});

      expect(deps.ref).toHaveBeenCalledWith(
        deps.db,
        'udonarium-lobby/reconnect-requests/my-peer-id'
      );
    });
  });

  describe('requestReconnect()', () => {
    it('應向目標 peer 的路徑推送 timestamp', async () => {
      const deps = makeDeps({ auth: { currentUser: { uid: 'u1' } } as any });
      const lobby = new TrysteroLobby({} as FirebaseApp, deps);

      await lobby.requestReconnect('target-peer');

      expect(deps.ref).toHaveBeenCalledWith(
        deps.db,
        'udonarium-lobby/reconnect-requests/target-peer'
      );
      expect(deps.set).toHaveBeenCalledWith(
        jasmine.any(Object),
        jasmine.objectContaining({ timestamp: jasmine.any(Number) })
      );
    });
  });
});
