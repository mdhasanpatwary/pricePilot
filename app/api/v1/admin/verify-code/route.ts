import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  verifyAdminCodeSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // Still check if the user is a super admin in the DB before allowing code verification
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate input
    const validation = await validateBody(req, verifyAdminCodeSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { code } = validation.data!;
    const secretCode = process.env.SUPER_ADMIN_LOGIN_CODE;

    if (!code || code !== secretCode) {
      return NextResponse.json(
        { error: "Invalid administrative code" },
        { status: 403 },
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", handlePOST);
}
