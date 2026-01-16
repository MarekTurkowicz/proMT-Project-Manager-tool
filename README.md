# PROMT — Plan • Run • Optimise Management Tool

### Project Management Support Platform for Daily Project Operations

## Overview

This repository contains a **web-based Project Management Support Platform** designed to support the **daily operational workflow of a Project Manager**. The system provides a centralized and structured environment for managing projects, tasks, teams, and project funding in a consistent and traceable manner.

The application was developed as part of an **engineering diploma thesis** and emphasizes **clear domain separation, deterministic business logic, and scalable system architecture**. The design reflects real-world project execution processes rather than abstract task tracking.

 > 📄 Polish version: see [README.pl.md](./README.pl.md)

---

## System Scope

The platform covers the full lifecycle of project execution:

- project initialization and planning
- task definition and assignment
- funding-driven task generation
- progress monitoring and reporting
- project completion and archiving

All core activities are performed within a single, integrated system.

---

## Domain Model

The system is built around three primary domain entities:

- **Project**\
  Represents the main working context. Projects aggregate tasks, funding sources, timelines, and team members.

- **Task**\
  Atomic execution units assigned to users. Tasks may be manually created or automatically generated based on funding requirements.

- **Funding**\
  Represents formal sources of requirements and constraints. Funding entities influence project structure and can define predefined task templates.

These entities form a coherent and extensible domain model.

---

## Key Features

- Project lifecycle management
- Task and subtask management
- Automatic task generation based on funding definitions
- Multiple data presentation modes:
  - list views
  - Kanban boards
  - timeline / schedule views
- Team and responsibility management
- Filtering, sorting, and pagination of datasets
- Progress and risk monitoring
- Authentication and access control

---

## Architecture

The application follows a **layered architecture**, ensuring separation of concerns and maintainability:

- **Frontend**\
  Single Page Application (SPA) responsible for data presentation and user interaction.

- **Backend**\
  REST-based API implementing business logic, validation, and domain rules.

- **Database**\
  Relational data store ensuring data integrity and transactional consistency.

The system is designed for scalability and further extension.

---

## Technology Stack

### Frontend

- **JavaScript / TypeScript** — strongly typed client-side logic
- **React** — component-based UI architecture
- **SPA architecture** — state-driven rendering and client-side routing
- **HTTP client layer** — typed communication with backend API

### Backend

- **Python** — primary backend language
- **Django** — core backend framework
- **Django REST Framework (DRF)** — RESTful API layer
- **Modular application structure** — separation of domains and services
- **Authentication & authorization layer** — access control and role-based permissions

### Database

- **PostgreSQL** — relational database engine
- **Explicit relational schema** — enforced data integrity and constraints
- **Transactional consistency** — ACID-compliant operations

### Tooling & Quality

- **Git** — version control system
- **Automated testing** — unit, integration, and end-to-end tests
- **Environment-based configuration** — development and production separation

> Detailed technology choices and architectural justification are described in the accompanying technical documentation.

---

## Documentation

This project is based on an **engineering diploma thesis**, which includes:

- analysis of existing project management tools (e.g. Asana, Jira, ClickUp)
- system architecture and domain modeling
- database design
- user interface description
- testing methodology and results

---

## Author

**Marek Turkowicz**\
Faculty of Computer Science\
Białystok University of Technology\
2026

---

## Project Status

The project is considered **functionally complete** and serves as a foundation for further development and research.

