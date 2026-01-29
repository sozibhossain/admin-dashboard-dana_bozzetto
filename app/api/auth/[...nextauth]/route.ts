import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const getJwtExpiry = (token?: string) => {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    return typeof decoded?.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const refreshAccessToken = async (token: any) => {
  try {
    if (!token?.refreshToken) {
      return { ...token, error: "NoRefreshToken" };
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token.refreshToken }),
      }
    );

    if (!response.ok) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const data = await response.json();
    const accessToken = data.token;
    const accessTokenExpires = getJwtExpiry(accessToken);

    return {
      ...token,
      accessToken,
      accessTokenExpires,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
};

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        emailOrId: { label: "Email / Client ID / Employee ID", type: "text" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrId || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                emailOrId: credentials.emailOrId,
                password: credentials.password,
                rememberMe:
                  credentials.rememberMe === true ||
                  credentials.rememberMe === "true",
              }),
            }
          );

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.message || "Invalid credentials");
          }

          const data = await response.json();

          return {
            id: data._id,
            name: data.name,
            email: data.email,
            role: data.role,
            accessToken: data.token,
            refreshToken: data.refreshToken,
            avatar: data.avatar,
          };
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : "Authentication failed"
          );
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.avatar = user.avatar;
        token.accessTokenExpires = getJwtExpiry(user.accessToken);
        token.error = undefined;
      }
      const expiresAt = token.accessTokenExpires as number | null | undefined;
      if (expiresAt && Date.now() < expiresAt - 30 * 1000) {
        return token;
      }
      if (!expiresAt) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.user.avatar = token.avatar;
      session.accessTokenExpires = token.accessTokenExpires;
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
});

export { handler as GET, handler as POST };
