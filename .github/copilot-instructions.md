# Role-Focused Product Guardrails (PoC)

This project is a role-based pharmaceutical sales, marketing, and compliance web app.

## Core Principle
Build only what directly supports one of these roles:
- Campaign Manager
- Sales & Marketing Representative
- Compliance Reviewer
- Liaison Officer

Do not introduce features without a clear role workflow.

## Feature Acceptance Checklist
Before adding or expanding any feature, validate all items:
1. Role Support: Does this directly support at least one role above?
2. Workflow Value: Does it simplify a real day-to-day task for that role?
3. Prototype Fit: Is it essential for a proof-of-concept, not enterprise complexity?
4. UX Simplicity: Does it reduce clicks, reduce ambiguity, and improve navigation?
5. Traceability/Compliance: Does it improve auditability, accountability, or safe content use?
6. Non-Duplication: Does it avoid overlap with existing pages/components?

If any answer is no, simplify or remove the change.

## Priorities
- Clean, obvious UI and naming
- Minimal steps to complete tasks
- Clear role-specific navigation and context
- Maintainable, modular components
- Lightweight and realistic data models

## Exclusions
- Features that are confusing or difficult to explain to end users
- Optional complexity that does not improve role workflow
- Premature optimization and enterprise-only abstractions

## Implementation Rules
- Respect role-based access and boundaries in UI and data access.
- Prefer extending shared components over creating duplicate flows.
- Keep copy clear and action-oriented (what to do next should be obvious).
- Keep forms and tabs focused on one workflow intent.
- Favor straightforward logic over highly abstract patterns in this prototype.

## Review Standard for PRs/Changes
For each new feature or page change, include a short note in the change summary:
- Supported role(s)
- Workflow improved
- Why this is essential for the PoC
- What was removed/simplified to avoid complexity
