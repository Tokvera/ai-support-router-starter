# Contributing

Thanks for contributing to `ai-support-router-starter`.

## What this repo is for

This project is a small but realistic AI support workflow starter built to show how Tokvera traces a multi-step support flow.

Good contributions include:

- improving the support routing logic
- adding realistic policy or tool integrations
- improving local developer experience
- strengthening examples and documentation
- fixing bugs in mock mode or live mode

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Default local server:

- `http://localhost:3000`

Build the project:

```bash
npm run build
```

## Before opening a pull request

Please try to keep changes:

- focused and easy to review
- aligned with the repo's starter-template purpose
- compatible with both mock mode and live provider mode
- reflected in the README when endpoints or response shapes change

## Pull request checklist

- explain the user-facing impact
- include any API or README updates needed
- mention how you tested the change
- keep sample payloads and demo routes working

## Reporting bugs and requesting features

Please use the GitHub issue templates when possible so reproduction steps and expected behavior are clear.
