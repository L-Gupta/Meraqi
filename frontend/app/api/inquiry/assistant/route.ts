import { z } from "zod";
import { getAnalysis, getCustomer, getDocuments, getInquiry, getRisk, getSummary } from "@/lib/mock-data/api";

const RequestSchema = z.object({
  question: z.string().min(2),
  deal: z.string().optional(),
  period: z.string().optional(),
  basis: z.string().optional(),
});

function buildSnapshot(params: {
  summary: Awaited<ReturnType<typeof getSummary>>;
  analysis: Awaited<ReturnType<typeof getAnalysis>>;
  risk: Awaited<ReturnType<typeof getRisk>>;
  documents: Awaited<ReturnType<typeof getDocuments>>;
  customer: Awaited<ReturnType<typeof getCustomer>>;
  inquiry: Awaited<ReturnType<typeof getInquiry>>;
}) {
  const { summary, analysis, risk, documents, customer, inquiry } = params;
  const revenue = summary.metrics.find((m) => m.id === "revenue-ltm")?.value ?? "N/A";
  const reportedEbitda = summary.metrics.find((m) => m.id === "reported-ebitda")?.value ?? "N/A";
  const adjustedEbitda = summary.metrics.find((m) => m.id === "adjusted-ebitda")?.value ?? "N/A";
  const cashConversion = summary.metrics.find((m) => m.id === "cash-conv")?.value ?? "N/A";
  const overallRisk = `${risk.riskScore.toFixed(1)} / 10`;
  const top10Concentration = customer.metrics.find((m) => m.id === "cust-top10")?.value ?? "N/A";
  const openBlockingInquiries = inquiry.inquiries.filter((i) => i.blocking && i.status !== "Closed").length;
  const tieoutFails = risk.tieOuts.filter((t) => t.status === "Fail").length;
  const tieoutWarns = risk.tieOuts.filter((t) => t.status === "Warn").length;
  const missingDocs = documents.coverage.reduce((acc, row) => acc + row.months.filter((m) => m.status === "Missing").length, 0);

  return {
    revenue,
    reportedEbitda,
    adjustedEbitda,
    cashConversion,
    overallRisk,
    top10Concentration,
    openBlockingInquiries,
    tieoutFails,
    tieoutWarns,
    missingDocs,
    riskHotspots: [...risk.dimensions].sort((a, b) => b.score - a.score).slice(0, 3),
    recentChanges: summary.deltaFeed.slice(0, 4).map((d) => `${d.type}: ${d.message}`),
    highRiskAddbacks: analysis.qoeMetrics.find((m) => m.id === "qoe-highrisk")?.value ?? "N/A",
  };
}

function formatSnapshot(snapshot: ReturnType<typeof buildSnapshot>) {
  return [
    `Revenue (LTM): ${snapshot.revenue}`,
    `Reported EBITDA (LTM): ${snapshot.reportedEbitda}`,
    `Adjusted EBITDA (LTM): ${snapshot.adjustedEbitda}`,
    `Cash conversion: ${snapshot.cashConversion}`,
    `Overall deal risk: ${snapshot.overallRisk}`,
    `Top 10 concentration: ${snapshot.top10Concentration}`,
    `Open blocking inquiries: ${snapshot.openBlockingInquiries}`,
    `Tie-out fails: ${snapshot.tieoutFails}`,
    `Tie-out warns: ${snapshot.tieoutWarns}`,
    `Missing document cells in coverage heatmap: ${snapshot.missingDocs}`,
    `High-risk addbacks count: ${snapshot.highRiskAddbacks}`,
    `Risk hotspots: ${snapshot.riskHotspots.map((r) => `${r.subject} (${r.score.toFixed(1)})`).join(", ")}`,
    `Recent changes: ${snapshot.recentChanges.join(" | ")}`,
  ].join("\n");
}

function fallbackAnswer(question: string, snapshot: ReturnType<typeof buildSnapshot>) {
  const q = question.toLowerCase();

  if (q.includes("overall risk") || q.includes("deal risk")) {
    return `Overall deal risk is ${snapshot.overallRisk}. Top hotspots are ${snapshot.riskHotspots.map((r) => `${r.subject} (${r.score.toFixed(1)})`).join(", ")}.`;
  }

  if (q.includes("revenue") || q.includes("ebitda") || q.includes("cash conversion")) {
    return `Current dashboard metrics: Revenue (LTM) ${snapshot.revenue}, Reported EBITDA (LTM) ${snapshot.reportedEbitda}, Adjusted EBITDA (LTM) ${snapshot.adjustedEbitda}, Cash conversion ${snapshot.cashConversion}.`;
  }

  if (q.includes("tie-out") || q.includes("tie out")) {
    return `Tie-out status: ${snapshot.tieoutFails} fail and ${snapshot.tieoutWarns} warn items. Highest-risk check remains TB <-> BS (A=L+E) as shown in the risk table.`;
  }

  if (q.includes("inquiry") || q.includes("blocking")) {
    return `There are ${snapshot.openBlockingInquiries} open blocking inquiries right now. Prioritize AP aging reconciliation and FX adjustment support.`;
  }

  if (q.includes("document") || q.includes("coverage") || q.includes("pbc")) {
    return `Document coverage has ${snapshot.missingDocs} missing cells in the heatmap. Open PBC items include AP aging vendor detail, FX adjustment support, and bank rec support.`;
  }

  return `From the current dashboard: overall deal risk is ${snapshot.overallRisk}, revenue is ${snapshot.revenue}, adjusted EBITDA is ${snapshot.adjustedEbitda}, cash conversion is ${snapshot.cashConversion}, and top-10 concentration is ${snapshot.top10Concentration}. Ask about revenue, risk, tie-outs, documents, or inquiries for a deeper breakdown.`;
}

async function callOpenAI(question: string, snapshotText: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are TAM Inquiry Copilot for financial due diligence. Answer clearly, use only provided dashboard context, do not invent data, and keep the answer concise and actionable.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Dashboard context:\n${snapshotText}\n\nUser question: ${question}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const json = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (json.output_text && json.output_text.trim().length > 0) {
    return { answer: json.output_text.trim(), model };
  }

  const fallbackText = json.output
    ?.flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" || c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  if (fallbackText) {
    return { answer: fallbackText, model };
  }

  return { answer: "I could not generate a response from the model output.", model };
}

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const [summary, analysis, risk, documents, customer, inquiry] = await Promise.all([
      getSummary(body.period ?? null, body.basis ?? null, body.deal ?? null, { withDelay: false }),
      getAnalysis(body.period ?? null, body.basis ?? null, body.deal ?? null, { withDelay: false }),
      getRisk(body.deal ?? null, body.period ?? null, body.basis ?? null, { withDelay: false }),
      getDocuments(body.deal ?? null, { withDelay: false }),
      getCustomer(body.period ?? null, body.basis ?? null, body.deal ?? null, { withDelay: false }),
      getInquiry(body.deal ?? null, body.period ?? null, body.basis ?? null, { withDelay: false }),
    ]);
    const snapshot = buildSnapshot({ summary, analysis, risk, documents, customer, inquiry });
    const snapshotText = formatSnapshot(snapshot);

    try {
      const llm = await callOpenAI(body.question, snapshotText);
      if (llm) {
        return Response.json({
          answer: llm.answer,
          mode: "llm",
          model: llm.model,
        });
      }
    } catch {
      // fall through to deterministic answer
    }

    return Response.json({
      answer: fallbackAnswer(body.question, snapshot),
      mode: "fallback",
      model: "dashboard-rules-v1",
    });
  } catch {
    return Response.json({
      answer: "I could not process that request. Please try again with a clearer question.",
      mode: "fallback",
      model: "dashboard-rules-v1",
    });
  }
}
