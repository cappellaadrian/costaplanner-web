/**
 * NextAuth configuration for costaplanner-web.
 *
 * IDENTICAL to REVARA's src/lib/auth.ts (same CredentialsProvider, same JWT
 * shape, same NEXTAUTH_SECRET). This is intentional — both apps point at
 * the same Neon Postgres User table, and the same JWT secret means a session
 * issued by either app is structurally identical.
 *
 * Cross-app session SHARING (single cookie covering both) is not enabled
 * yet because .vercel.app subdomains don't share cookies. Users with the
 * same email + password log in to each app independently. Real SSO comes
 * in Phase 9 when we move to costaplanner.com + revara.com custom domains.
 */
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.company = (user as unknown as { company: string }).company;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { company: string }).company = token.company as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
