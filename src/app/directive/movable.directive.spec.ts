import { MovableDirective } from './movable.directive';

describe('MovableDirective', () => {
  it('should create an instance', () => {
    const directive = new MovableDirective(null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    expect(directive).toBeTruthy();
  });
});
