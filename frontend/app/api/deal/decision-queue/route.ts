import { getDecisionQueue } from "@/lib/mock-data/api";
import { DecisionQueueResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getDecisionQueue(
    searchParams.get("deal"),
    searchParams.get("period"),
    searchParams.get("basis")
  );
  return Response.json(DecisionQueueResponseSchema.parse(data));
}
