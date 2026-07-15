import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
export declare class AccountService {
    private readonly prisma;
    private readonly media;
    constructor(prisma: PrismaService, media: MediaService);
    requestDeletion(userId: string): Promise<{
        status: string;
    }>;
    status(userId: string): Promise<{
        status: string;
    }>;
}
