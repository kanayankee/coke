import { NextResponse } from "next/server";
import { getStatus } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStatus());
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "データを読み込めませんでした" }, { status: 500 });
  }
}
