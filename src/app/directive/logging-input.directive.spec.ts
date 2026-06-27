import { LoggingInputDirective } from './logging-input.directive';

describe('LoggingInputDirective', () => {
  it('should create an instance', () => {
    const directive = new LoggingInputDirective(null as any, null as any);
    expect(directive).toBeTruthy();
  });
});
