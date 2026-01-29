import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    accessToken: string;
    refreshToken: string;
    avatar?: {
      public_id: string;
      url: string;
    };
  }

  interface Session {
    user: User & {
      email: string;
      name: string;
    };
    accessToken: string;
    refreshToken: string;
    accessTokenExpires?: number | null;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    refreshToken: string;
    avatar?: {
      public_id: string;
      url: string;
    };
    accessTokenExpires?: number | null;
    error?: string;
  }
}
