import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { sampleTickets } from "./sample-tickets.js";
import {
  createTokveraTracer,
  finishSpan,
  getTrackOptionsFromTraceContext,
  startSpan,
  startTrace,
  trackOpenAI,
} from "@tokvera/sdk";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 3000);
const isMockMode = process.env.MOCK_MODE !== "false";
const openAIModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const tokveraTenantId = process.env.SUPPORT_TENANT_ID || "acme-demo";
const tokveraApiKey = process.env.TOKVERA_API_KEY || "tkv_demo_key";
const tokveraIngestUrl = process.env.TOKVERA_INGEST_URL;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const tracer = createTokveraTracer({
  api_key: tokveraApiKey,
  ingest_url: tokveraIngestUrl,
  feature: "ai_support_router_starter",
  tenant_id: tokveraTenantId,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  emit_lifecycle_events: true,
});

const ticketSchema = z.object({
  subject: z.string().min(5),
  message: z.string().min(10),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
  customerName: z.string().min(2).default("Customer"),
  customerEmail: z.string().email().default("customer@example.com"),
});

type Ticket = z.infer<typeof ticketSchema>;
type TicketCategory = "billing" | "bug" | "feature" | "general";
type SupportQueue = "billing-ops" | "engineering" | "product-feedback" | "customer-support";
type SupportTone = "reassuring" | "urgent" | "consultative" | "helpful";

type Classification = {
  category: TicketCategory;
  priority: "low" | "medium" | "high";
  shouldEscalate: boolean;
  queue: SupportQueue;
  suggestedOwner: string;
  suggestedSlaHours: number;
  tone: SupportTone;
  policyKey: "billing" | "incident" | "feature" | "general";
  shortReason: string;
};

const policies: Record<Classification["policyKey"], { title: string; guidance: string }> = {
  billing: {
    title: "Billing explanation",
    guidance: "Explain included usage, overages, and the next billing review steps in a clear, non-technical tone.",
  },
  incident: {
    title: "Incident response",
    guidance: "Acknowledge the issue, request timestamps or trace IDs, and set expectations for engineering follow-up.",
  },
  feature: {
    title: "Feature request handling",
    guidance: "Thank the customer, summarize the request, and explain how product feedback is reviewed.",
  },
  general: {
    title: "General support",
    guidance: "Answer the question directly, link the next best step, and keep the tone warm and concise.",
  },
};

const demoTicket: Ticket = sampleTickets[0];

function parseModelJson<T>(value: string, fallback: T): T {
  try {
    const normalized = value.replace(/^```json\s*/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
}

function heuristicClassify(ticket: Ticket): Classification {
  const text = `${ticket.subject} ${ticket.message}`.toLowerCase();
  if (text.includes("invoice") || text.includes("billing") || text.includes("charge") || text.includes("refund")) {
    return {
      category: "billing",
      priority: ticket.plan === "enterprise" ? "high" : "medium",
      shouldEscalate: ticket.plan === "enterprise",
      queue: "billing-ops",
      suggestedOwner: "billing",
      suggestedSlaHours: ticket.plan === "enterprise" ? 4 : 8,
      tone: "reassuring",
      policyKey: "billing",
      shortReason: "billing language detected",
    };
  }
  if (text.includes("bug") || text.includes("error") || text.includes("broken") || text.includes("incident")) {
    return {
      category: "bug",
      priority: "high",
      shouldEscalate: true,
      queue: "engineering",
      suggestedOwner: "support-engineering",
      suggestedSlaHours: 2,
      tone: "urgent",
      policyKey: "incident",
      shortReason: "incident language detected",
    };
  }
  if (text.includes("feature") || text.includes("roadmap") || text.includes("add support")) {
    return {
      category: "feature",
      priority: "low",
      shouldEscalate: false,
      queue: "product-feedback",
      suggestedOwner: "product-ops",
      suggestedSlaHours: 24,
      tone: "consultative",
      policyKey: "feature",
      shortReason: "feature request language detected",
    };
  }
  return {
    category: "general",
    priority: ticket.plan === "enterprise" ? "medium" : "low",
    shouldEscalate: false,
    queue: "customer-support",
    suggestedOwner: "support",
    suggestedSlaHours: ticket.plan === "enterprise" ? 6 : 12,
    tone: "helpful",
    policyKey: "general",
    shortReason: "default support route",
  };
}

function buildNextActions(ticket: Ticket, classification: Classification): string[] {
  const actions = [
    `Assign to ${classification.suggestedOwner}`,
    `Respond within ${classification.suggestedSlaHours} hour${classification.suggestedSlaHours === 1 ? "" : "s"}`,
  ];

  if (classification.category === "billing") {
    actions.push("Review included usage, overages, and invoice change history");
  }

  if (classification.category === "bug") {
    actions.push("Collect reproduction details, timestamps, and trace IDs");
  }

  if (classification.category === "feature") {
    actions.push("Log the feature request and link it to product feedback review");
  }

  if (classification.shouldEscalate) {
    actions.push(`Escalate because the ${ticket.plan} plan requires faster handling`);
  }

  return actions;
}

async function classifyTicket(ticket: Ticket, parent: ReturnType<typeof startSpan>): Promise<Classification> {
  const fallback = heuristicClassify(ticket);
  if (isMockMode || !openai) {
    return fallback;
  }

  const trackedOpenAI = trackOpenAI(
    openai,
    getTrackOptionsFromTraceContext(parent, {
      step_name: "classify_ticket",
      span_kind: "model",
      capture_content: true,
    })
  );

  const completion = await trackedOpenAI.chat.completions.create({
    model: openAIModel,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Classify support tickets. Return minified JSON with keys category, priority, shouldEscalate, queue, suggestedOwner, suggestedSlaHours, tone, policyKey, shortReason. category must be one of billing, bug, feature, general. priority must be low, medium, or high. queue must be one of billing-ops, engineering, product-feedback, customer-support. tone must be one of reassuring, urgent, consultative, helpful. policyKey must be billing, incident, feature, or general. suggestedSlaHours must be a number.",
      },
      {
        role: "user",
        content: JSON.stringify(ticket),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content || "";
  const parsed = parseModelJson<Partial<Classification>>(content, fallback);
  finishSpan(parent, { response: completion, model: openAIModel });
  return {
    ...fallback,
    ...parsed,
  };
}

async function draftReply(ticket: Ticket, classification: Classification, policy: { title: string; guidance: string }, parent: ReturnType<typeof startSpan>): Promise<string> {
  const fallback = `Hi ${ticket.customerName},\n\nThanks for reaching out. Based on your request, this looks like a ${classification.category} question. ${policy.guidance} We recommend replying with the relevant account context and, if needed, sharing any timestamps or screenshots so the team can help faster.\n\nBest,\nSupport`;
  if (isMockMode || !openai) {
    return fallback;
  }

  const trackedOpenAI = trackOpenAI(
    openai,
    getTrackOptionsFromTraceContext(parent, {
      step_name: "draft_reply",
      span_kind: "model",
      capture_content: true,
    })
  );

  const completion = await trackedOpenAI.chat.completions.create({
    model: openAIModel,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `You are a SaaS support assistant. Keep replies concise, accurate, and empathetic. Policy title: ${policy.title}. Guidance: ${policy.guidance}`,
      },
      {
        role: "user",
        content: `Customer plan: ${ticket.plan}\nCustomer subject: ${ticket.subject}\nCustomer message: ${ticket.message}\nClassification: ${classification.category}\nPriority: ${classification.priority}`,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() || fallback;
  finishSpan(parent, { response: completion, model: openAIModel });
  return answer;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, mockMode: isMockMode });
});

app.get("/api/demo-ticket", (_req: Request, res: Response) => {
  res.json(demoTicket);
});

app.get("/api/sample-tickets", (_req: Request, res: Response) => {
  res.json(sampleTickets);
});

app.post("/api/tickets/reply", async (req: Request, res: Response) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const ticket = parsed.data;
  const root = startTrace(tracer.baseOptions, {
    step_name: "handle_support_ticket",
    model: "support-router",
    span_kind: "orchestrator",
  });

  try {
    const classifySpan = startSpan(root, {
      step_name: "classify_ticket",
      span_kind: "model",
      provider: isMockMode ? "tokvera" : "openai",
      model: isMockMode ? "heuristic-router" : openAIModel,
    });
    const classification = await classifyTicket(ticket, classifySpan);
    if (isMockMode) {
      finishSpan(classifySpan, { response: classification, model: "heuristic-router" });
    }

    const policySpan = startSpan(root, {
      step_name: "lookup_policy",
      span_kind: "tool",
      tool_name: "policy_lookup",
    });
    const policy = policies[classification.policyKey];
    finishSpan(policySpan, { response: policy });

    const draftSpan = startSpan(root, {
      step_name: "draft_reply",
      span_kind: "model",
      provider: isMockMode ? "tokvera" : "openai",
      model: isMockMode ? "mock-support-writer" : openAIModel,
    });
    const reply = await draftReply(ticket, classification, policy, draftSpan);
    if (isMockMode) {
      finishSpan(draftSpan, { response: { message: reply }, model: "mock-support-writer" });
    }

    const triage = {
      category: classification.category,
      priority: classification.priority,
      shouldEscalate: classification.shouldEscalate,
      queue: classification.queue,
      suggestedOwner: classification.suggestedOwner,
      suggestedSlaHours: classification.suggestedSlaHours,
      tone: classification.tone,
      shortReason: classification.shortReason,
    };
    const nextActions = buildNextActions(ticket, classification);

    finishSpan(root, {
      response: {
        ...triage,
        nextActions,
      },
    });

    return res.json({
      traceId: root.trace_id,
      runId: root.run_id,
      ticket: {
        subject: ticket.subject,
        plan: ticket.plan,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
      },
      triage,
      policy,
      nextActions,
      reply,
      meta: {
        mockMode: isMockMode,
        provider: isMockMode ? "mock" : "openai",
        model: isMockMode ? "mock-support-writer" : openAIModel,
      },
    });
  } catch (error) {
    finishSpan(root, {
      response: {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      outcome: "failure",
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      traceId: root.trace_id,
      runId: root.run_id,
    });
  }
});

app.listen(port, () => {
  console.log(`ai-support-router-starter listening on :${port}`);
});
