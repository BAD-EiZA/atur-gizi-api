import { AuthenticatedUser } from '../../common/auth/auth.types';
import { MediaService } from './media.service';
export declare class MediaController {
    private readonly media;
    constructor(media: MediaService);
    signature(user: AuthenticatedUser): {
        cloud_name: string | undefined;
        api_key: string | undefined;
        timestamp: number;
        folder: string;
        public_id_prefix: string;
        delivery_type: string;
        signature: string;
        mock: boolean;
    };
}
