// Sample CrawledPage[] fixtures for testing.

import type { CrawledPage } from "../../types.js";

export const SAMPLE_PAGES: CrawledPage[] = [
  {
    url: "https://example.com",
    title: "Example Product - Home",
    pageType: "homepage",
    content: "Example Product is a project management tool for engineering teams. Create boards, track issues, and ship faster. Trusted by 10,000+ teams worldwide. Get started free.",
  },
  {
    url: "https://example.com/features",
    title: "Features - Example Product",
    pageType: "features",
    content: "Board View: Drag tasks between columns. Sprint Planning: Auto-assign based on capacity. Timeline: See project dependencies. Reports: Export PDF status reports. Integrations: Connect GitHub, Slack, Jira. API: Build custom workflows.",
  },
  {
    url: "https://example.com/about",
    title: "About Us - Example Product",
    pageType: "about",
    content: "We believe every engineering team deserves great tools. Founded in 2020, Example Product serves B2B SaaS companies. Our target customer is engineering managers leading teams of 5-50 developers.",
  },
  {
    url: "https://example.com/customers",
    title: "Customer Stories - Example Product",
    pageType: "customers",
    content: "Acme Corp reduced sprint planning time from 2 hours to 10 minutes. Their engineering lead says: 'The auto-assignment feature changed how we plan sprints entirely.' Beta Inc saved 5 hours/week on status reporting using the automated dashboards.",
  },
  {
    url: "https://example.com/help/getting-started",
    title: "Getting Started Guide",
    pageType: "help",
    content: "Step 1: Create your first board. Step 2: Invite team members. Step 3: Create your first sprint. Step 4: Track your first issue to completion. Step 5: Share your first status report.",
  },
  {
    url: "https://example.com/pricing",
    title: "Pricing",
    pageType: "pricing",
    content: "Free: 1 board, 3 members. Pro: $10/user/month, unlimited boards. Enterprise: Custom pricing, SSO, audit logs.",
  },
  {
    url: "https://example.com/solutions",
    title: "Solutions",
    pageType: "solutions",
    content: "For Engineering Teams: Track issues, manage sprints, visualize dependencies. For Product Teams: Roadmap planning, customer feedback tracking. For Leadership: Portfolio view, resource allocation, KPI dashboards.",
  },
  {
    url: "https://example.com/onboarding",
    title: "Onboarding",
    pageType: "onboarding",
    content: "Welcome! Let's set up your workspace. Create your first project, invite your team, and configure your first board. Most teams are up and running in under 30 minutes.",
  },
];

export const EMPTY_PAGES: CrawledPage[] = [];

export const MINIMAL_PAGES: CrawledPage[] = [
  SAMPLE_PAGES[0], // homepage
  SAMPLE_PAGES[1], // features
];
