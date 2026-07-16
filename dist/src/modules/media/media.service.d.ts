import { ConfigService } from '@nestjs/config';
export declare class MediaService {
    private readonly config;
    constructor(config: ConfigService);
    private folder;
    isConfigured(): boolean;
    createUploadSignature(userId: string): {
        cloud_name: string | undefined;
        api_key: string | undefined;
        timestamp: number;
        folder: string;
        public_id_prefix: string;
        delivery_type: string;
        signature: string;
        mock: boolean;
    };
    assertOwnedPublicId(userId: string, publicId: string): void;
    destroy(publicId: string): Promise<any>;
    signedDeliveryUrl(publicId: string): string | null;
    fetchAsBase64(publicId: string): Promise<{
        data: string;
        mimeType: string;
    } | null>;
}
