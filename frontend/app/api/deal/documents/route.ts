import { getDocuments } from "@/lib/mock-data/api";
import { DocumentsResponseSchema } from "@/lib/schemas/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getDocuments(searchParams.get("deal"));
  return Response.json(DocumentsResponseSchema.parse(data));
}
