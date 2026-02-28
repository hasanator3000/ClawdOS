# ClawdOS — Vision

## The Problem

AI agents are powerful — but invisible. You run them in the terminal, get text back, and that's it. No workspace. No persistent data. No visual feedback.

Meanwhile, productivity tools like Notion, Todoist, and Obsidian give you great UI — but zero intelligence. You do all the work: create tasks, organize feeds, track packages, switch pages. The tool is passive.

**What's missing is the layer between the AI agent and the human.** A visual operating system where the agent can act, and the human can see, verify, and override.

## The Idea

ClawdOS is the web interface for [OpenClaw](https://github.com/openclaw/openclaw) — the open-source personal AI agent.

OpenClaw (formerly Moltbot / Clawdbot) is the brain — it handles reasoning, skill execution, and tool use. ClawdOS is the eyes and hands — a full productivity workspace where the agent's actions become visible and interactive.

When you tell your OpenClaw agent *"remind me to call the bank tomorrow, high priority"*, it doesn't reply with "Sure, here's how you can create a reminder." It creates the task. Right now. With the right priority and due date. And you see it appear in your task list.

When you say *"add Hacker News to my feeds"*, the RSS source appears. When you say *"track my package"*, tracking starts. When you say *"open settings"*, the page navigates.

The AI doesn't just understand you. It **does things inside your workspace**.

Think of it like this:
- **Linux kernel** needs **KDE/GNOME** to be usable for most people
- **Docker** needs **Portainer** to be manageable through a browser
- **OpenClaw** needs **ClawdOS** to become a full productivity platform

## Self-Hosted, Private, Yours

ClawdOS runs on your own server alongside OpenClaw. That's not a limitation — it's the point.

- **Your data stays on your machine.** Tasks, conversations, feeds, tracking numbers — all in your PostgreSQL instance. No cloud sync, no third-party analytics, no telemetry.
- **No accounts, no subscriptions.** Clone the repo, run setup, you're in.
- **No vendor lock-in.** It's a Next.js app with a PostgreSQL database. You own every bit of it.
- **Offline-capable intelligence.** Intent routing uses local embeddings — common commands resolve without any API call.

This isn't a SaaS product. It's infrastructure you own.

## How the AI Works

ClawdOS and OpenClaw communicate over a local HTTP gateway (OpenAI-compatible API). The separation is deliberate:

- **ClawdOS** handles UI, data, authentication, and action execution. It defines *what* the AI can do through a whitelisted action protocol.
- **OpenClaw** handles natural language understanding, context management, and decision-making. It decides *when* and *how* to act.

The AI doesn't have free rein. Every action is whitelisted, validated, and executed server-side. The AI can create a task but can't drop your database. It can navigate to a page but can't access your filesystem.

### Intent Routing

Not every message needs to go through an LLM. ClawdOS uses a 3-layer system:

1. **Regex patterns** catch obvious commands instantly (< 1ms)
2. **Local embeddings** handle fuzzy matches semantically (~6ms, fully offline)
3. **OpenClaw LLM** handles everything else with full reasoning

This means *"open tasks"* resolves in under a millisecond. Only genuinely complex requests hit the AI model. The result: the interface feels instant — not "AI-loading-spinner" slow.

### Skills

OpenClaw is extensible through skills — modular capabilities that can be installed from a marketplace. GitHub integration, Slack notifications, weather data, coding agents, and more. ClawdOS provides a visual skill marketplace to browse, install, and manage them.

## Design Philosophy

ClawdOS looks like nothing else in the productivity space. No white backgrounds, no rounded-corner-card-on-gray sameness.

**Void black** (`#06060a`) background. **Glassmorphism** cards with 4% white opacity. **Neon purple** (`#a78bfa`) accents. The aesthetic is intentional — it's a workspace for people who spend hours in front of screens and want something that respects their eyes.

The layout is a three-column shell: a collapsible rail sidebar, flexible content area, and a resizable AI chat panel. Everything stays within reach.

Fonts are chosen for clarity: **Outfit** for the interface, **Space Mono** for data and code.

## Who It's For

ClawdOS is for anyone running OpenClaw who wants a real workspace — not just a terminal.

- **OpenClaw users** who want a visual interface for their agent
- **Self-hosters** who care about data ownership and privacy
- **Productivity enthusiasts** who prefer one unified workspace over 12 separate apps
- **Developers** who want to extend their AI agent with custom skills and UI components
- **Teams** evaluating OpenClaw who need a polished GUI to demo or adopt it

If you're running OpenClaw (or planning to), ClawdOS is the interface it deserves.

## Where It's Going

ClawdOS is in active development. The roadmap:

- **Plugin-driven UI** — OpenClaw skills that render their own interface components inside ClawdOS. Your agent doesn't just execute — it builds its own UI.
- **Mobile-first responsive** — bottom sheet chat, tab navigation, drawer sidebar. Full experience on any device.
- **More AI actions** — calendar events, reminders, file management, automations, email
- **Multi-device sync** — seamless experience across desktop and mobile
- **Deeper integrations** — notes, bookmarks, calendar — all through the same AI interface

The long-term vision: **ClawdOS becomes the default GUI for the OpenClaw ecosystem** — the way VS Code became the default editor for web developers. One workspace, one AI, everything you need.

## Get Involved

- **Star the repo** — helps others find ClawdOS when searching for an OpenClaw interface
- **Try it out** — [Quick Start](../README.md#quick-start) takes under 5 minutes
- **Contribute** — check the [RULES/](../RULES/) developer guide and pick an issue
- **Report bugs** — open an issue on GitHub
