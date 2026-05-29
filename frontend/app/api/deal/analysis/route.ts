import { getAnalysis } from "@/lib/mock-data/api";
import { AnalysisResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getAnalysis(searchParams.get("period"), searchParams.get("basis"), searchParams.get("deal"));
  return Response.json(AnalysisResponseSchema.parse(data));
}
