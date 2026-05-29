import { getCustomer } from "@/lib/mock-data/api";
import { CustomerResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getCustomer(searchParams.get("period"), searchParams.get("basis"), searchParams.get("deal"));
  return Response.json(CustomerResponseSchema.parse(data));
}
