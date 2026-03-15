import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/apiResponse";

const SIGNED_URL_TTL = 300; // 5 minutes
const BUCKET = "chat-attachments";

/**
 * POST /api/chat/[chatId]/attachments/refresh-urls
 * Accepts { paths: string[] } and returns fresh signed URLs.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body?.paths || !Array.isArray(body.paths) || body.paths.length === 0) {
      return badRequest("paths must be a non-empty array of storage paths");
    }

    // Validate all paths belong to this chat
    const invalidPath = body.paths.find((p: string) => typeof p !== "string" || !p.startsWith(`${chatId}/`));
    if (invalidPath) return forbidden("Path does not belong to this chat");

    const admin = createAdminClient();
    if (!admin) return serverError("Storage not configured");

    const { data } = await admin.storage
      .from(BUCKET)
      .createSignedUrls(body.paths, SIGNED_URL_TTL);

    if (!data) return serverError("Failed to generate signed URLs");

    const urlMap: Record<string, string> = {};
    for (let i = 0; i < body.paths.length; i++) {
      if (data[i]?.signedUrl) {
        urlMap[body.paths[i]] = data[i].signedUrl;
      }
    }

    return ok({ urls: urlMap });
  } catch (error) {
    return serverError("Failed to refresh URLs", error);
  }
}
