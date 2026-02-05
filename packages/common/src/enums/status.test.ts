import { NotificationStatus } from './status';

describe('NotificationStatus Enum', () => {
  it('should have correct status values', () => {
    expect(NotificationStatus.PENDING).toBe('pending');
    expect(NotificationStatus.SENT).toBe('sent');
    expect(NotificationStatus.FAILED).toBe('failed');
    expect(NotificationStatus.BOUNCED).toBe('bounced');
  });

  it('should have all required statuses', () => {
    const statuses = Object.values(NotificationStatus);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('sent');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('bounced');
    expect(statuses.length).toBe(4);
  });

  it('should support status transitions', () => {
    const validTransitions: Record<NotificationStatus, NotificationStatus[]> = {
      [NotificationStatus.PENDING]: [NotificationStatus.SENT, NotificationStatus.FAILED],
      [NotificationStatus.SENT]: [NotificationStatus.BOUNCED],
      [NotificationStatus.FAILED]: [NotificationStatus.PENDING],
      [NotificationStatus.BOUNCED]: [],
    };

    Object.entries(validTransitions).forEach(([from, tos]) => {
      tos.forEach(to => {
        expect([...Object.values(NotificationStatus)]).toContain(to);
      });
    });
  });
});
