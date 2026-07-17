"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cloudinary_1 = require("cloudinary");
const app_exception_1 = require("../../common/errors/app.exception");
let MediaService = class MediaService {
    config;
    constructor(config) {
        this.config = config;
        cloudinary_1.v2.config({
            cloud_name: this.config.get('cloudinary.cloudName'),
            api_key: this.config.get('cloudinary.apiKey'),
            api_secret: this.config.get('cloudinary.apiSecret'),
            secure: true,
        });
    }
    folder(userId) {
        const base = this.config.get('cloudinary.uploadFolder') ?? 'ai-fitness/development';
        return `${base}/${userId}/food`;
    }
    isConfigured() {
        return Boolean(this.config.get('cloudinary.cloudName') &&
            this.config.get('cloudinary.apiKey') &&
            this.config.get('cloudinary.apiSecret'));
    }
    createUploadSignature(userId) {
        if (!this.isConfigured()) {
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
            throw new app_exception_1.AppException('MEDIA_NOT_CONFIGURED', 'Cloudinary belum dikonfigurasi.', common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = this.folder(userId);
        const deliveryType = this.config.get('cloudinary.deliveryType') ?? 'authenticated';
        const paramsToSign = {
            timestamp,
            folder,
            type: deliveryType,
        };
        const signature = cloudinary_1.v2.utils.api_sign_request(paramsToSign, this.config.get('cloudinary.apiSecret'));
        return {
            cloud_name: this.config.get('cloudinary.cloudName'),
            api_key: this.config.get('cloudinary.apiKey'),
            timestamp,
            folder,
            public_id_prefix: folder,
            delivery_type: deliveryType,
            signature,
            mock: false,
        };
    }
    assertOwnedPublicId(userId, publicId) {
        const prefix = this.folder(userId);
        if (!publicId.startsWith(`${prefix}/`)) {
            throw new app_exception_1.AppException('MEDIA_OWNERSHIP_DENIED', 'Asset media tidak valid untuk pengguna ini.', common_1.HttpStatus.FORBIDDEN);
        }
    }
    async destroy(publicId) {
        if (!this.isConfigured())
            return { result: 'skipped' };
        try {
            return await cloudinary_1.v2.uploader.destroy(publicId, {
                type: this.config.get('cloudinary.deliveryType') ?? 'authenticated',
                invalidate: true,
            });
        }
        catch {
            return { result: 'error' };
        }
    }
    signedDeliveryUrl(publicId) {
        if (!this.isConfigured())
            return null;
        return cloudinary_1.v2.url(publicId, {
            type: this.config.get('cloudinary.deliveryType') ?? 'authenticated',
            sign_url: true,
            secure: true,
            transformation: [{ width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        });
    }
    async fetchAsBase64(publicId) {
        if (!this.isConfigured())
            return null;
        try {
            const url = this.signedDeliveryUrl(publicId);
            if (!url)
                return null;
            const res = await fetch(url);
            if (!res.ok)
                return null;
            const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
            const maxBytes = 10 * 1024 * 1024;
            const contentLength = Number(res.headers.get('content-length'));
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || contentLength > maxBytes) {
                return null;
            }
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > maxBytes)
                return null;
            return { data: buf.toString('base64'), mimeType };
        }
        catch {
            return null;
        }
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MediaService);
//# sourceMappingURL=media.service.js.map