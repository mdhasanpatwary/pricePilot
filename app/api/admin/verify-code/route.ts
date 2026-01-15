import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // Still check if the user is a super admin in the DB before allowing code verification
  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await req.json();
    const secretCode = process.env.SUPER_ADMIN_LOGIN_CODE;

    if (!code || code !== secretCode) {
      return NextResponse.json({ error: "Invalid administrative code" }, { status: 403 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
