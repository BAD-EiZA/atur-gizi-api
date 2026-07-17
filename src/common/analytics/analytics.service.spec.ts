import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const findUnique = jest.fn();
  const create = jest.fn();
  const service = new AnalyticsService({
    userSettings: { findUnique },
    analyticsEvent: { create },
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not store events without consent', async () => {
    findUnique.mockResolvedValue({ analyticsConsent: false });

    await service.track('user-1', 'dashboard_viewed');

    expect(create).not.toHaveBeenCalled();
  });

  it('stores only small scalar props after consent', async () => {
    findUnique.mockResolvedValue({ analyticsConsent: true });
    create.mockResolvedValue({});

    await service.track('user-1', 'dashboard_viewed', {
      surface: 'dashboard',
      calories: 400,
      nested: { health: 'sensitive' },
      title: 'private meal',
      long: 'x'.repeat(101),
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'dashboard_viewed',
        props: { surface: 'dashboard', calories: 400 },
      },
    });
  });
});
