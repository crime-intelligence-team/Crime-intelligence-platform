# State Crime Intelligence Platform

A secure, role-based intelligence platform for authorized law-enforcement users to monitor criminal activity, analyze regional trends, explore criminal networks, and support investigation workflows through maps, dashboards, and connected-entity analysis.

## Overview

The State Crime Intelligence Platform is being built as a full-stack web application for authorized users such as police officers, detectives, intelligence analysts, supervisors, and administrators. The platform combines geospatial intelligence, district-level dashboards, criminal network analysis, and explainable risk-zone visualization into one operational system.

The first version is scoped to a single state with district-level drill-down. The architecture is being designed so the system can later scale to broader geography and more advanced analytics without requiring a full rewrite.

## Core Modules

- Secure login and role-based access control
- State and district map with multiple visualization modes
- Regional dashboard for selected districts or state-level summaries
- Network intelligence page for criminal and gang relationship analysis
- Explainable zone/risk analysis
- Audit logging and governance controls
- Case workspace for saving investigation context

## Goals

- Provide a centralized intelligence workspace for authorized law-enforcement use
- Improve situational awareness through maps and dashboards
- Help investigators identify criminal, gang, and incident connections
- Support explainable risk-based regional monitoring
- Maintain secure access, auditability, and role-based data visibility

## Tech Stack

### Frontend
- React
- Vite
- TypeScript
- React Router
- Axios
- Leaflet

### Backend
- NestJS
- TypeScript
- JWT Authentication
- Role-Based Access Control (RBAC)

### Database
- PostgreSQL
- PostGIS

### Analytics
- Python service / scheduled jobs for risk scoring and intelligence analytics

### Repository Structure
- Monorepo with shared packages and app separation
- pnpm workspaces

## Repository Structure

```text
.
├── apps/
│   ├── web/                # React + Vite frontend
│   ├── api/                # NestJS backend
│   └── analytics/          # Python analytics / scoring jobs
├── packages/
│   ├── shared-types/       # Shared DTOs, enums, contracts
│   └── config/             # Shared config, linting, TS settings
├── docs/
│   ├── prd/                # Product requirement documents
│   ├── architecture/       # Architecture notes and diagrams
│   ├── api/                # API contracts and endpoint docs
│   ├── database/           # Schema and data model docs
│   ├── roles/              # Permission matrix and access rules
│   └── decisions/          # Architecture decision records
├── infra/
│   ├── db/                 # Database scripts and setup
│   └── docker/             # Container and local infra config
├── .github/
│   ├── workflows/          # CI/CD workflows
│   ├── CODEOWNERS          # Review ownership rules
│   └── pull_request_template.md
├── .env.example
├── CONTRIBUTING.md
├── SECURITY.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## User Roles

The platform is intended only for authorized users. Current planned roles include:

- Admin
- Supervisor
- Intelligence Analyst
- Detective
- District Officer

Each role will have controlled access to modules, records, and actions based on permissions and jurisdiction.

## Planned Map Modes

### Default Mode
A clean district/state map view with minimal clutter, focused on geography and core intelligence indicators.

### Network Mode
A relationship-focused map overlay showing criminal and gang connections across regions, with filters for specific individuals, gangs, cases, and time ranges.

### Zone Mode
A visual risk layer that highlights more crime-prone or intelligence-sensitive areas using explainable scoring and color-based intensity.

## Development Workflow

### Branching Strategy

- `main` → stable branch
- `develop` → integration branch
- `feature/<feature-name>` → feature branches
- `bugfix/<bug-name>` → bug fix branches
- `hotfix/<hotfix-name>` → urgent fixes

### Rules

- Do not push directly to `main`
- Create all feature work from `develop`
- Open a pull request to merge into `develop`
- Require at least one review before merge
- Keep commits focused and descriptive
- Update documentation when architecture or contracts change

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js (LTS)
- pnpm
- PostgreSQL
- Git
- Python 3.x

### Clone the Repository

```bash
git clone https://github.com/<owner>/state-crime-intelligence-platform.git
cd state-crime-intelligence-platform
```

### Install Workspace Dependencies

```bash
pnpm install
```

### Environment Variables

Create local environment files based on `.env.example`.

Example root variables may include:

```env
DATABASE_URL=
JWT_SECRET=
PORT=
VITE_API_URL=
MAP_TILE_URL=
```

Do not commit real secrets or private credentials.

## Running the Project

The exact run steps will be added as the apps are initialized.

Planned commands:

```bash
pnpm dev:web
pnpm dev:api
```

Additional setup instructions for database migration, seeding, and analytics jobs will be documented inside `/docs` and each app folder as development progresses.

## Documentation

Project documentation will be maintained inside the `/docs` directory.

Important docs include:
- PRD
- architecture overview
- permission matrix
- API contracts
- database schema
- setup guides
- architecture decisions

## Contributing

Before contributing:
1. Pull the latest `develop`
2. Create a new feature branch
3. Commit only related changes
4. Open a pull request with a clear summary
5. Request review from the relevant code owner

Please read `CONTRIBUTING.md` for the full workflow.

## Security

This repository is private and intended for internal team development only.

Important rules:
- Never commit secrets, credentials, or production keys
- Never upload real sensitive datasets
- Use `.env` files for local configuration
- Follow role-based access design carefully
- Report security concerns privately to the repo admins

Please read `SECURITY.md` for more details.

## Current Status

This project is currently in the planning and repository setup phase.

Completed:
- Product outline
- PRD draft
- Initial stack selection
- Repository planning

Next:
- Monorepo initialization
- Backend and frontend app setup
- Database schema design
- API contract definition
- Sprint 0 execution

## Team

- Team Lead: Ravi Shankar
- Team Members: To be updated

## License

This project is currently for academic/internal team use unless otherwise specified by the team.