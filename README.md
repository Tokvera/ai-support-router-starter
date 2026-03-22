# ai-support-router-starter

A realistic customer-support AI workflow starter that classifies inbound tickets, chooses an internal queue, looks up support guidance, drafts a reply, and traces the full execution with Tokvera.

## Why this repo matters

Most AI support examples stop at a single prompt. Real support systems need routing, policy/tool context, escalation logic, and observability across the whole workflow.

This starter is built to be useful as:

- a reference project for AI support and helpdesk copilots
- a Tokvera tracing example for multi-step orchestration
- a starting point for SaaS support automation
- a blog/article companion repo for organic developer traffic

## What it does

For each incoming ticket, the app:

1. classifies the request
2. selects a support queue
3. applies policy guidance
4. drafts a customer-facing reply
5. returns next actions for the internal team
6. emits Tokvera trace data for the full flow

## Stack

- Node.js
- Express
- OpenAI
- Tokvera JavaScript SDK
- Zod

## Why Tokvera is useful here

This project is intentionally multi-step so Tokvera can show more than just a raw model call.

With Tokvera, you can inspect:

- the root support workflow trace
- ticket classification behavior
- policy lookup as a tool step
- draft reply generation
- routing and escalation metadata
- mock vs live provider behavior

This makes it a good demo for teams that want to understand how Tokvera helps debug AI workflows, not just record token usage.

## Endpoints

- `GET /health`
- `GET /api/demo-ticket`
- `GET /api/sample-tickets`
- `POST /api/tickets/reply`

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

The server starts on `http://localhost:3000` by default.

## Environment

Mock mode is enabled by default, so you can run the project without provider credentials.

To use a live provider:

- set `MOCK_MODE=false`
- provide `OPENAI_API_KEY`
- provide `TOKVERA_API_KEY`

Main environment variables:

- `PORT`
- `MOCK_MODE`
- `TOKVERA_API_KEY`
- `TOKVERA_INGEST_URL`
- `SUPPORT_TENANT_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Example request

```bash
curl -X POST http://localhost:3000/api/tickets/reply \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Need help understanding extra usage charges",
    "message": "Our finance team saw a larger invoice this week. Can you explain what changed?",
    "plan": "pro",
    "customerName": "Riya",
    "customerEmail": "riya@example.com"
  }'
```

## Example response shape

```json
{
  "traceId": "trc_123",
  "runId": "run_123",
  "ticket": {
    "subject": "Need help understanding extra usage charges",
    "plan": "pro",
    "customerName": "Riya",
    "customerEmail": "riya@example.com"
  },
  "triage": {
    "category": "billing",
    "priority": "medium",
    "shouldEscalate": false,
    "queue": "billing-ops",
    "suggestedOwner": "billing",
    "suggestedSlaHours": 8,
    "tone": "reassuring",
    "shortReason": "billing language detected"
  },
  "policy": {
    "title": "Billing explanation",
    "guidance": "Explain included usage, overages, and the next billing review steps in a clear, non-technical tone."
  },
  "nextActions": [
    "Assign to billing",
    "Respond within 8 hours",
    "Review included usage, overages, and invoice change history"
  ],
  "reply": "...",
  "meta": {
    "mockMode": true,
    "provider": "mock",
    "model": "mock-support-writer"
  }
}
```

## Architecture

```text
Inbound ticket
  -> classify_ticket
  -> lookup_policy
  -> draft_reply
  -> return triage + reply + next actions
```

Tokvera traces the workflow root plus the child steps so you can inspect the complete request lifecycle.

## Repo structure

```text
src/
  server.ts
  sample-tickets.ts
```

## Useful local routes

- `GET /api/demo-ticket` for one default payload
- `GET /api/sample-tickets` for multiple demo inputs you can reuse in articles, screenshots, or quick testing

## Extension ideas

- connect a real knowledge base lookup tool
- add Anthropic fallback for reply drafting
- persist ticket states to a database
- add Slack / email escalation hooks
- attach screenshots or payload references to Tokvera traces
- add a small frontend UI for support team review

## Suggested article angles

- How to build a customer support AI router with trace visibility
- How to trace multi-step support workflows in Node.js
- How to debug routing and escalation logic in AI support apps

## Related Tokvera concepts to highlight in content

- root traces vs child spans
- model and tool visibility in one workflow
- live traces for active processing
- debugging classification, routing, and escalation logic
