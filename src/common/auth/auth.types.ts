export type AuthClaims = {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

/** Runtime class so Nest emitDecoratorMetadata works with isolatedModules */
export class AuthenticatedUser {
  claims!: AuthClaims;
  appUserId!: string;
}
