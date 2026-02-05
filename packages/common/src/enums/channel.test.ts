import { Channel } from './channel';

describe('Channel Enum', () => {
  it('should have correct channel values', () => {
    expect(Channel.EMAIL).toBe('email');
    expect(Channel.SMS).toBe('sms');
    expect(Channel.INAPP).toBe('inapp');
  });

  it('should have all required channels', () => {
    const channels = Object.values(Channel);
    expect(channels).toContain('email');
    expect(channels).toContain('sms');
    expect(channels).toContain('inapp');
    expect(channels.length).toBe(3);
  });
});
