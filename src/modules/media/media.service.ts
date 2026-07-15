import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { AppException } from '../../common/errors/app.exception';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('cloudinary.cloudName'),
      api_key: this.config.get<string>('cloudinary.apiKey'),
      api_secret: this.config.get<string>('cloudinary.apiSecret'),
      secure: true,
    });
  }

  private folder(userId: string) {
    const base = this.config.get<string>('cloudinary.uploadFolder') ?? 'ai-fitness/development';
    return `${base}/${userId}/food`;
  }

  isConfigured() {
    return Boolean(
      this.config.get('cloudinary.cloudName') &&
        this.config.get('cloudinary.apiKey') &&
        this.config.get('cloudinary.apiSecret'),
    );
  }

  createUploadSignature(userId: string) {
    if (!this.isConfigured()) {
      // Dev mock signature when Cloudinary not set
      if (this.config.get('auth.devBypass')) {
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = this.folder(userId);
        return {
          cloud_name: 'dev',
          api_key: 'dev',
          timestamp,
          folder,
          public_id_prefix: folder,
          delivery_type: 'authenticated',
          signature: 'dev-signature',
          mock: true,
        };
      }
      throw new AppException(
        'MEDIA_NOT_CONFIGURED',
        'Cloudinary belum dikonfigurasi.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = this.folder(userId);
    const deliveryType = this.config.get<string>('cloudinary.deliveryType') ?? 'authenticated';
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
      type: deliveryType,
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.config.get<string>('cloudinary.apiSecret')!,
    );

    return {
      cloud_name: this.config.get<string>('cloudinary.cloudName'),
      api_key: this.config.get<string>('cloudinary.apiKey'),
      timestamp,
      folder,
      public_id_prefix: folder,
      delivery_type: deliveryType,
      signature,
      mock: false,
    };
  }

  assertOwnedPublicId(userId: string, publicId: string) {
    const prefix = this.folder(userId);
    if (!publicId.startsWith(prefix)) {
      throw new AppException(
        'MEDIA_OWNERSHIP_DENIED',
        'Asset media tidak valid untuk pengguna ini.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async destroy(publicId: string) {
    if (!this.isConfigured()) return { result: 'skipped' };
    try {
      return await cloudinary.uploader.destroy(publicId, {
        type: this.config.get<string>('cloudinary.deliveryType') ?? 'authenticated',
        invalidate: true,
      });
    } catch {
      return { result: 'error' };
    }
  }

  signedDeliveryUrl(publicId: string) {
    if (!this.isConfigured()) return null;
    return cloudinary.url(publicId, {
      type: this.config.get<string>('cloudinary.deliveryType') ?? 'authenticated',
      sign_url: true,
      secure: true,
      transformation: [{ width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    });
  }
}
