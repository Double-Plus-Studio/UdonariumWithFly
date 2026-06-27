import { TestBed, inject } from '@angular/core/testing';

import { ChatMessageService } from './chat-message.service';

describe('ChatMessageService', () => {
  let service: ChatMessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatMessageService]
    });
    service = TestBed.inject(ChatMessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTime()', () => {
    it('應回傳接近 Date.now() 的時間戳（誤差 2 秒內）', () => {
      const before = Date.now();
      const time = service.getTime();
      const after = Date.now();

      expect(time).toBeGreaterThanOrEqual(before - 2000);
      expect(time).toBeLessThanOrEqual(after + 2000);
    });

    it('應回傳整數', () => {
      const time = service.getTime();
      expect(Number.isInteger(time)).toBeTrue();
    });

    it('連續呼叫時間應遞增或相等', () => {
      const t1 = service.getTime();
      const t2 = service.getTime();
      expect(t2).toBeGreaterThanOrEqual(t1);
    });
  });

  describe('gameType', () => {
    it('預設值應為空字串', () => {
      expect(service.gameType).toBe('');
    });

    it('可以設定新的 gameType', () => {
      service.gameType = 'CoC7';
      expect(service.gameType).toBe('CoC7');
    });
  });
});
