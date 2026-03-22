# ai-support-router-starter

A minimal customer-support AI workflow starter that routes inbound tickets, looks up policy guidance, drafts a reply, and traces the full execution with Tokvera.

## Why this repo is useful

- realistic AI support flow instead of a toy single-prompt demo
- clear multi-step orchestration with routing, tool lookup, draft generation, and escalation decision
- Tokvera tracing across the whole workflow
- mock mode for local evaluation without provider credentials
- easy starting point for support bots, internal helpdesk copilots, and SaaS customer ops tools

## Stack

- Node.js
- Express
- OpenAI
- Tokvera JavaScript SDK

## Endpoints

- `GET /health`
- `GET /api/demo-ticket`
- `POST /api/tickets/reply`

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Mock mode is enabled by default. To use a live provider:

- set `MOCK_MODE=false`
- provide `OPENAI_API_KEY`
- provide `TOKVERA_API_KEY`

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

## What Tokvera shows for this flow

- root trace for the support request
- intent classification step
- policy lookup tool step
- draft reply model step
- escalation decision in the final response

## Suggested article angles

- How to build a customer support AI router with trace visibility
- How to trace multi-step support workflows in Node.js
- How to debug routing and escalation logic in AI support apps
