import { getRisk } from "@/lib/mock-data/api";
import { RiskResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getRisk(searchParams.get("deal"), searchParams.get("period"), searchParams.get("basis"));
  return Response.json(RiskResponseSchema.parse(data));
}
