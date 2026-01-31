# MicroEnv Manager - Product Requirements Document

## Original Problem Statement
Generate a website with two modules: Admin and User for managing testing environments and work item assignments.

## Product Overview
A full-stack application (React + FastAPI + MongoDB) for managing QA testing environments and daily work assignments. The core feature is an intelligent assignment algorithm that optimizes environment usage while handling team conflicts and collaboration preferences.

## User Personas
1. **Admin**: Creates/manages users, teams, environments, microservices. Generates daily testing session assignments.
2. **User**: Creates work items specifying which microservices they need to test, with priority and collaboration preferences.

## Core Requirements

### Admin Features
- Create/edit/delete Users, Teams, Environments, Microservices
- View all user-submitted work items for the day
- Generate daily "testing session list" with intelligent assignment algorithm
- Edit/delete/regenerate assignment lists
- Approve pending OAuth users

### User Features
- Dashboard to create "Work Items"
- Select required microservices, set priority (1-4), optional target environment
- Collaboration flags: `can_temp_branch` (team), `can_temp_with_qa` (cross-team)
- Add comments to work items

### Assignment Logic (IMPLEMENTED)
1. **Priority-based sorting**: Items sorted by priority (1=Critical to 4=Low)
2. **Cross-Team Temp Branching**: Users from different teams CAN share environment if both have `can_temp_with_qa=true`
3. **Same-Team Collaboration**: Users from same team can share with `can_temp_branch=true` (default ON)
4. **Optimized -second Usage**: FE/BE split for better environment utilization
5. **Waiting List**: Unassigned items go to "WAITING - In Queue"

### Authentication
- JWT-based email/password login
- Google OAuth via auth.emergentagent.com
- Azure AD OAuth (backend exists, UI button removed per user request)
- Pending user approval system for OAuth sign-ups

### UI/UX
- English UI (all text translated)
- HelloCare logo integrated
- Dark/Light mode toggle
- Search bars on all management tables
- Share/Copy button for assignments

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main application with all endpoints
- `/app/backend/auth_oauth.py` - OAuth helper functions
- MongoDB for data persistence

### Frontend (React)
- `/app/frontend/src/pages/` - LoginPage, AdminDashboard, UserDashboard
- `/app/frontend/src/components/` - Reusable components (WorkItemsView, AssignmentsView, etc.)
- `/app/frontend/src/contexts/ThemeContext.js` - Dark/Light mode
- TailwindCSS + Shadcn UI components

### Database Schema
- **User**: id, email, first_name, last_name, role, team_name, approved, oauth_provider
- **WorkItem**: id, user_id, work_item_name, microservices, priority, can_temp_branch, can_temp_with_qa, environment, comments
- **Environment**: id, name, is_second
- **Microservice**: id, name
- **Assignment**: user_id, work_item_name, assigned_environment, microservices, is_temp_branch, conflicts

## What's Been Implemented (January 2026)

### Completed Features
- [x] Full CRUD for Users, Teams, Environments, Microservices
- [x] Work item creation with all options
- [x] **Advanced assignment algorithm with optimized -second logic:**
  - **STRATEGY 1 (Split)**: For mixed FE+BE items, splits into separate assignments (FE → `-second` env, BE → parent env)
  - **STRATEGY 2 (Regular)**: Assigns full items to regular environments with conflict checking
  - **STRATEGY 3 (FE-only)**: Routes frontend-only items to `-second` environments
  - **STRATEGY 4 (Fallback)**: Uses any remaining `-second` environment
- [x] Cross-team temp branching (`can_temp_with_qa`)
- [x] Same-team temp branching (`can_temp_branch`, default ON)
- [x] Priority-based sorting (1=Critical to 4=Low)
- [x] Waiting list functionality
- [x] Google OAuth integration
- [x] Pending user approval system
- [x] Dark/Light mode toggle
- [x] Search bars on all tables
- [x] Share/Copy assignments
- [x] Full English UI translation
- [x] **Force Assign feature**: Admin can manually assign waiting items to any environment with confirmation dialog

### Test Coverage
- Backend: 14/14 API tests passing (100%)
- Frontend: All UI flows verified
- Test file: `/app/backend/tests/test_api.py`

## Prioritized Backlog

### P0 (Critical)
- None - all critical features implemented

### P1 (High)
- Database query optimization (pagination for large datasets)
- Remove unused ML dependencies from requirements.txt

### P2 (Medium)
- Refactor server.py into separate modules (routes, models)
- Add database indexes for frequently queried fields

### Future Enhancements
- Email notifications for assignments
- Historical assignment reports
- User preferences persistence
- Mobile-responsive improvements

## Credentials
- **Admin**: admin@example.com / Solab-123
- **Test User**: test@test.test / Solab-123

## API Endpoints
- `POST /api/auth/login` - Local login
- `GET /api/auth/google` - Google OAuth redirect
- `GET /api/users`, `POST /api/users` - User management
- `GET /api/microservices`, `POST /api/microservices` - Microservice management
- `GET /api/environments`, `POST /api/environments` - Environment management
- `GET /api/work-items`, `POST /api/work-items` - Work item management
- `POST /api/generate-assignments` - Generate daily assignments
- `GET /api/assignments` - Get assignments
- `DELETE /api/assignments` - Delete assignments
