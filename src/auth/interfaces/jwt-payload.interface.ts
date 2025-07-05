export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role?: string;
}
