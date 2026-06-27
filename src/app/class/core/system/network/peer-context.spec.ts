import { PeerContext } from './peer-context';

describe('PeerContext', () => {
  describe('create() - 無房間', () => {
    it('應產生有效的 digestUserId', () => {
      const peer = PeerContext.create('user1');
      expect(peer.digestUserId.length).toBeGreaterThan(0);
    });

    it('isRoom 應為 false', () => {
      const peer = PeerContext.create('user1');
      expect(peer.isRoom).toBeFalse();
    });

    it('hasPassword 應為 false', () => {
      const peer = PeerContext.create('user1');
      expect(peer.hasPassword).toBeFalse();
    });

    it('userId 應與輸入相符', () => {
      const peer = PeerContext.create('alice');
      expect(peer.userId).toBe('alice');
    });

    it('空 userId 不應 throw', () => {
      expect(() => PeerContext.create('')).not.toThrow();
    });
  });

  describe('create() - 有房間，無密碼', () => {
    let peer: PeerContext;

    beforeEach(() => {
      peer = PeerContext.create('user1', 'abc', 'TestRoom', '');
    });

    it('isRoom 應為 true', () => {
      expect(peer.isRoom).toBeTrue();
    });

    it('hasPassword 應為 false', () => {
      expect(peer.hasPassword).toBeFalse();
    });

    it('roomId 應與輸入相符', () => {
      expect(peer.roomId).toBe('abc');
    });

    it('roomName 應與輸入相符', () => {
      expect(peer.roomName).toBe('TestRoom');
    });

    it('peerId 應包含正確格式', () => {
      // 格式: digestUserId(6) + roomId(3) + lzbase62(roomName) + '-' + digestPassword
      expect(peer.peerId).toMatch(/^\w{9}/);
      expect(peer.peerId).toContain('-');
    });
  });

  describe('create() - 有房間，有密碼', () => {
    let peer: PeerContext;

    beforeEach(() => {
      peer = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
    });

    it('isRoom 應為 true', () => {
      expect(peer.isRoom).toBeTrue();
    });

    it('hasPassword 應為 true', () => {
      expect(peer.hasPassword).toBeTrue();
    });

    it('roomName 應與輸入相符', () => {
      expect(peer.roomName).toBe('TestRoom');
    });

    it('password 應與輸入相符', () => {
      expect(peer.password).toBe('secret');
    });

    it('verifyPassword(正確密碼) 應回傳 true', () => {
      expect(peer.verifyPassword('secret')).toBeTrue();
    });

    it('verifyPassword(錯誤密碼) 應回傳 false', () => {
      expect(peer.verifyPassword('wrong')).toBeFalse();
    });

    it('verifyPassword(空字串) 應回傳 false', () => {
      expect(peer.verifyPassword('')).toBeFalse();
    });
  });

  describe('parse()', () => {
    it('parse 無房間的 peerId 應還原正確屬性', () => {
      const original = PeerContext.create('user1');
      const parsed = PeerContext.parse(original.peerId);

      expect(parsed.digestUserId).toBe(original.digestUserId);
      expect(parsed.isRoom).toBeFalse();
    });

    it('parse 有房間無密碼的 peerId 應還原正確屬性', () => {
      const original = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const parsed = PeerContext.parse(original.peerId);

      expect(parsed.roomId).toBe(original.roomId);
      expect(parsed.roomName).toBe('TestRoom');
      expect(parsed.isRoom).toBeTrue();
      expect(parsed.hasPassword).toBeFalse();
    });

    it('parse 有房間有密碼的 peerId 應還原正確屬性', () => {
      const original = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const parsed = PeerContext.parse(original.peerId);

      expect(parsed.roomId).toBe(original.roomId);
      expect(parsed.roomName).toBe('TestRoom');
      expect(parsed.hasPassword).toBeTrue();
    });

    it('parse 後 verifyPassword 應正確運作', () => {
      const original = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const parsed = PeerContext.parse(original.peerId);

      expect(parsed.verifyPassword('secret')).toBeTrue();
      expect(parsed.verifyPassword('wrong')).toBeFalse();
    });

    it('parse 無效字串不應 throw，isRoom 應為 false', () => {
      expect(() => PeerContext.parse('invalid')).not.toThrow();
      const parsed = PeerContext.parse('invalid');
      expect(parsed.isRoom).toBeFalse();
    });

    it('parse 空字串不應 throw', () => {
      expect(() => PeerContext.parse('')).not.toThrow();
    });
  });

  describe('verifyPeer()', () => {
    it('同房間同密碼的 peer 應通過驗證', () => {
      const host = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const guest = PeerContext.create('user2', 'abc', 'TestRoom', 'secret');

      expect(host.verifyPeer(guest.peerId)).toBeTrue();
    });

    it('同房間無密碼的 peer 應通過驗證', () => {
      const host = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const guest = PeerContext.create('user2', 'abc', 'TestRoom', '');

      expect(host.verifyPeer(guest.peerId)).toBeTrue();
    });

    it('不同房間的 peer 應失敗', () => {
      const host = PeerContext.create('user1', 'abc', 'Room1', '');
      const other = PeerContext.create('user2', 'xyz', 'Room2', '');

      expect(host.verifyPeer(other.peerId)).toBeFalse();
    });

    it('密碼不符的 peer 應失敗', () => {
      const host = PeerContext.create('user1', 'abc', 'TestRoom', 'correct');
      const other = PeerContext.create('user2', 'abc', 'TestRoom', 'wrong');

      expect(host.verifyPeer(other.peerId)).toBeFalse();
    });

    it('有密碼的 host 驗證無密碼的 peer 應失敗（hasPassword 不符）', () => {
      const host = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const noPassGuest = PeerContext.create('user2', 'abc', 'TestRoom', '');

      expect(host.verifyPeer(noPassGuest.peerId)).toBeFalse();
    });

    it('host 未持有密碼時 verifyPeer 應回傳 false', () => {
      const guestWithPass = PeerContext.create('user2', 'abc', 'TestRoom', 'secret');
      // host 只有 parse，沒有 password
      const hostParsed = PeerContext.parse(guestWithPass.peerId);

      expect(hostParsed.verifyPeer(guestWithPass.peerId)).toBeFalse();
    });
  });

  describe('generateId()', () => {
    it('預設格式應產生 8 字元字串', () => {
      const id = PeerContext.generateId();
      expect(id.length).toBe(8);
    });

    it('應只包含 base62 字元', () => {
      const id = PeerContext.generateId();
      expect(id).toMatch(/^[0-9a-zA-Z]+$/);
    });

    it('自訂格式應遵循格式（保留非 * 字元）', () => {
      const id = PeerContext.generateId('***-***');
      expect(id).toMatch(/^[0-9a-zA-Z]{3}-[0-9a-zA-Z]{3}$/);
    });

    it('無 * 格式應原樣回傳', () => {
      const id = PeerContext.generateId('fixed');
      expect(id).toBe('fixed');
    });

    it('多次呼叫結果應不同（機率性）', () => {
      const ids = new Set(Array.from({ length: 10 }, () => PeerContext.generateId()));
      expect(ids.size).toBeGreaterThan(1);
    });
  });
});
