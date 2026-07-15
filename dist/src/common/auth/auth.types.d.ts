export type AuthClaims = {
    sub: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
};
export declare class AuthenticatedUser {
    claims: AuthClaims;
    appUserId: string;
}
