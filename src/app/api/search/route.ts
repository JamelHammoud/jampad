import { NextRequest, NextResponse } from "next/server";
import { searchPages } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const results = await searchPages(q, 30);
  return NextResponse.json({ results });
}
