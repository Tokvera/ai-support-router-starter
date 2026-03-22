export const sampleTickets = [
  {
    subject: "Need help understanding extra usage charges",
    message: "Our finance team saw a larger invoice this week. Can you explain what changed and what we should check first?",
    plan: "pro",
    customerName: "Riya",
    customerEmail: "riya@example.com",
  },
  {
    subject: "Bug: trace detail page returns permission error",
    message: "Our support team can open the traces list, but clicking a single trace fails with a permissions error for multiple users.",
    plan: "enterprise",
    customerName: "Ava",
    customerEmail: "ava@example.com",
  },
  {
    subject: "Feature request: Slack alerts for anomaly spikes",
    message: "We want anomaly alerts to go directly to a Slack channel with links back to the relevant dashboard views.",
    plan: "pro",
    customerName: "Marco",
    customerEmail: "marco@example.com",
  },
] as const;
