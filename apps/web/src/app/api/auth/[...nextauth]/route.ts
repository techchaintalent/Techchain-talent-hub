import NextAuth from "next-auth";
import { authOptions } from "@techchain/lib";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
