import { getInquiry } from "@/lib/mock-data/api";
import { InquiryResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getInquiry(searchParams.get("deal"), searchParams.get("period"), searchParams.get("basis"));
  return Response.json(InquiryResponseSchema.parse(data));
}
