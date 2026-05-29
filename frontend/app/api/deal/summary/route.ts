import { getSummary } from "@/lib/mock-data/api";
import { SummaryResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getSummary(searchParams.get("period"), searchParams.get("basis"), searchParams.get("deal"));
  return Response.json(SummaryResponseSchema.parse(data));
}
