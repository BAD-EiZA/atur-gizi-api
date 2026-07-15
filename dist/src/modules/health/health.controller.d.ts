import { PrismaService } from '../../prisma/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    health(): {
        status: string;
    };
    ready(): Promise<{
        status: string;
        database: string;
    }>;
}
