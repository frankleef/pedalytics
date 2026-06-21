import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail, verifyPassword, createUser, getUserById } from "./users";
import { getKV } from "./kv";

export const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })] : []),
    CredentialsProvider({
      name: "Inloggen",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await getUserByEmail(credentials.email);
        if (!user) return null;
        const valid = await verifyPassword(user, credentials.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.naam };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const kv = getKV();
        const bestaand = await kv.get(`email:${user.email.toLowerCase()}`);
        if (!bestaand) {
          const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          const newUser = { id, email: user.email.toLowerCase(), passwordHash: null, naam: user.name || "", createdAt: new Date().toISOString(), provider: "google" };
          await kv.set(`user:${id}`, newUser);
          await kv.set(`email:${user.email.toLowerCase()}`, id);
          user.id = id;
        } else {
          user.id = bestaand;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google" && !token.userId) {
          const userId = await getKV().get(`email:${user.email?.toLowerCase()}`);
          token.userId = userId || user.id;
        } else {
          token.userId = user.id;
        }
      }
      if (token.userId && !token.hasIntervalsKey && !token._checkedAt) {
        const kv = getKV();
        const [encKey, athleteId, skipped] = await kv.mget(
          `user:${token.userId}:intervals_key`,
          `user:${token.userId}:athlete_id`,
          `user:${token.userId}:onboarding_overgeslagen`
        );
        if (encKey) {
          token.hasIntervalsKey = true;
          token.athleteId = athleteId;
        } else if (skipped) {
          token.onboardingSkipped = true;
        }
        token._checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
