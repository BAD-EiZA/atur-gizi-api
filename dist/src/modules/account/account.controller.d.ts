import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AccountService } from './account.service';
export declare class AccountController {
    private readonly account;
    constructor(account: AccountService);
    request(user: AuthenticatedUser): Promise<{
        status: string;
    }>;
    status(user: AuthenticatedUser): Promise<{
        status: string;
    }>;
}
