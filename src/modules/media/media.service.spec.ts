import { HttpStatus } from '@nestjs/common';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'cloudinary.uploadFolder') return 'atur-gizi/test';
      return undefined;
    }),
  };
  const service = new MediaService(config as never);

  it('accepts only assets inside exact user folder', () => {
    expect(() => service.assertOwnedPublicId('user-1', 'atur-gizi/test/user-1/food/photo')).not.toThrow();
    expect(() => service.assertOwnedPublicId('user-1', 'atur-gizi/test/user-10/food/photo')).toThrow(
      expect.objectContaining({ status: HttpStatus.FORBIDDEN }),
    );
  });
});
