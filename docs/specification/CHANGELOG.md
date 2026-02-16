# Schema Specification Changelog

All notable changes to the Basesignal ProductProfile schema specification.

Versioning follows semver rules:
- **Minor** (1.0 -> 1.1): New optional fields or enum values. Existing profiles remain valid.
- **Major** (1.0 -> 2.0): Breaking changes. Existing profiles may not validate.

## v1.0 - 2026-02-15

Initial release of the Basesignal ProductProfile schema specification.

### Sections
- CoreIdentity: product name, description, target customer, business model
- RevenueArchitecture: pricing model, tiers, expansion/contraction paths
- EntityModel: data entities and relationships
- UserJourney: lifecycle stages from first touch to expansion
- DefinitionsMap: activation, first value, active, at-risk, and churn definitions
- OutcomesSection: business outcomes linked to features
- MetricsSection: P&L framework metrics (reach, engagement, value delivery, value capture)

### Features
- basesignal_version field for schema versioning
- Confidence scoring (0-1) per section
- Evidence arrays linking data to source URLs
- Multi-level activation definition format (alongside legacy flat format)
- JSON Schema Draft 2020-12 for non-TypeScript consumers
- TypeScript type definitions via @basesignal/core
