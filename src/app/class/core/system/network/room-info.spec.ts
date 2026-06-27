import { PeerContext } from './peer-context';
import { RoomInfo } from './room-info';

describe('RoomInfo', () => {
  describe('listFrom()', () => {
    it('空陣列應回傳空陣列', () => {
      expect(RoomInfo.listFrom([])).toEqual([]);
    });

    it('非房間 peer 應被過濾掉', () => {
      const noRoomPeer = PeerContext.create('user1');
      const rooms = RoomInfo.listFrom([noRoomPeer.peerId]);
      expect(rooms).toEqual([]);
    });

    it('有效房間 peer 應建立一個 RoomInfo', () => {
      const peer = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const rooms = RoomInfo.listFrom([peer.peerId]);
      expect(rooms.length).toBe(1);
      expect(rooms[0].name).toBe('TestRoom');
    });

    it('相同 roomId+roomName 的多個 peer 應合併為同一房間', () => {
      const peer1 = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const peer2 = PeerContext.create('user2', 'abc', 'TestRoom', '');
      const peer3 = PeerContext.create('user3', 'abc', 'TestRoom', '');

      const rooms = RoomInfo.listFrom([peer1.peerId, peer2.peerId, peer3.peerId]);
      expect(rooms.length).toBe(1);
      expect(rooms[0].peers.length).toBe(3);
    });

    it('不同房間的 peer 應建立各自獨立的 RoomInfo', () => {
      const peer1 = PeerContext.create('user1', 'abc', 'Room1', '');
      const peer2 = PeerContext.create('user2', 'xyz', 'Room2', '');

      const rooms = RoomInfo.listFrom([peer1.peerId, peer2.peerId]);
      expect(rooms.length).toBe(2);
    });

    it('應忽略混在其中的非房間 peer', () => {
      const noRoom = PeerContext.create('userX');
      const roomPeer = PeerContext.create('user1', 'abc', 'TestRoom', '');

      const rooms = RoomInfo.listFrom([noRoom.peerId, roomPeer.peerId]);
      expect(rooms.length).toBe(1);
    });

    it('不同 roomName 相同 roomId 應視為不同房間', () => {
      const peer1 = PeerContext.create('user1', 'abc', 'RoomA', '');
      const peer2 = PeerContext.create('user2', 'abc', 'RoomB', '');

      const rooms = RoomInfo.listFrom([peer1.peerId, peer2.peerId]);
      expect(rooms.length).toBe(2);
    });

    it('應按 id+name 排序', () => {
      const peerZ = PeerContext.create('user1', 'zzz', 'ZRoom', '');
      const peerA = PeerContext.create('user2', 'aaa', 'ARoom', '');

      const rooms = RoomInfo.listFrom([peerZ.peerId, peerA.peerId]);
      expect(rooms[0].id).toBe('aaa');
      expect(rooms[1].id).toBe('zzz');
    });
  });

  describe('hasPassword', () => {
    it('包含有密碼 peer 的房間 hasPassword 應為 true', () => {
      const peer = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const rooms = RoomInfo.listFrom([peer.peerId]);
      expect(rooms[0].hasPassword).toBeTrue();
    });

    it('全部無密碼的房間 hasPassword 應為 false', () => {
      const peer = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const rooms = RoomInfo.listFrom([peer.peerId]);
      expect(rooms[0].hasPassword).toBeFalse();
    });

    it('直接建構 RoomInfo 預設 hasPassword 為 false', () => {
      const room = new RoomInfo('abc', 'TestRoom');
      expect(room.hasPassword).toBeFalse();
    });
  });

  describe('filterByPassword()', () => {
    it('正確密碼應回傳符合的 peers', () => {
      const peer1 = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const peer2 = PeerContext.create('user2', 'abc', 'TestRoom', 'secret');
      const rooms = RoomInfo.listFrom([peer1.peerId, peer2.peerId]);

      const filtered = rooms[0].filterByPassword('secret');
      expect(filtered.length).toBe(2);
    });

    it('錯誤密碼應回傳空陣列', () => {
      const peer = PeerContext.create('user1', 'abc', 'TestRoom', 'secret');
      const rooms = RoomInfo.listFrom([peer.peerId]);

      const filtered = rooms[0].filterByPassword('wrong');
      expect(filtered.length).toBe(0);
    });

    it('無密碼房間使用任意字串過濾應回傳空陣列', () => {
      const peer = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const rooms = RoomInfo.listFrom([peer.peerId]);

      const filtered = rooms[0].filterByPassword('anypassword');
      expect(filtered.length).toBe(0);
    });

    it('無密碼房間使用空字串過濾應回傳全部 peers', () => {
      const peer1 = PeerContext.create('user1', 'abc', 'TestRoom', '');
      const peer2 = PeerContext.create('user2', 'abc', 'TestRoom', '');
      const rooms = RoomInfo.listFrom([peer1.peerId, peer2.peerId]);

      const filtered = rooms[0].filterByPassword('');
      expect(filtered.length).toBe(2);
    });
  });

  describe('RoomInfo 建構子', () => {
    it('應正確設定 id 和 name', () => {
      const room = new RoomInfo('r01', 'MyRoom');
      expect(room.id).toBe('r01');
      expect(room.name).toBe('MyRoom');
    });

    it('無引數建構不應 throw', () => {
      expect(() => new RoomInfo()).not.toThrow();
    });
  });
});
