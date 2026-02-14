# Student Activity Record for HIEs – Project Plan

## 1. Overview

This project is a multi-tenant platform for Higher Education Institutions (HIEs) that:

- Manages separate **college ecosystems** based on email domain.
- Supports three roles: **Student, Recruiter, Admin**.
- Automatically ingests academic results (via web scraping).
- Lets students build rich profiles and computes a **USS score**.
- Exposes a **leaderboard**, **DMs**, **recruiter analytics dashboard**, and later an **AI chatbot**.

The codebase is built with:

- **Next.js (App Router, TypeScript, Tailwind)**
- **PostgreSQL + Prisma ORM**

This document describes the architecture and implementation phases.

---

## 2. Tech Stack Summary

- **Frontend / Full-stack Framework**: Next.js (App Router, TypeScript)
- **UI**:
  - Tailwind CSS
  - Later: `shadcn/ui` for tables, dialogs, pagination, forms
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: Auth.js (NextAuth) with:
  - Credentials provider (email + password + OTP verification)
  - Google OAuth (restricted to college domains)
- **Background jobs**:
  - Separate Node/Python script for result scraping, triggered manually or via cron
- **Future AI**:
  - LLM provider (OpenAI / other) via Next.js API routes

---

## 3. Domain Model (Prisma)

**Already implemented in `prisma/schema.prisma`:**

- `College`
  - One ecosystem per college
  - `emailDomain` used for student/signup validation and recruiter access

- `User`
  - Common user entity with `role` = `STUDENT | RECRUITER | ADMIN`
  - `collegeId` links a user to an ecosystem (recruiter access is “current college”)
  - `status` for recruiter approval (`PENDING`, `ACTIVE`, `REJECTED`)

- `StudentAcademic`
  - Official, scraped academic data per `(collegeId, rollNumber)`  
  - Source of truth for GPA / CGPA / per-semester data  
  - Students cannot edit this

- `StudentProfile`
  - Created when a student signs up and links their roll number
  - Holds profile meta (headline, about, year of study, `ussScore`)
  - 1–1 with `User` and `StudentAcademic`

- `StudentSkill`
- `StudentExperience`
- `StudentCertification`
  - Normalized tables for profile enrichment and filtering:
    - skill-wise, experience-wise, certification-wise search

- `RecruiterCollegeRequest`
  - Records access/switch requests from recruiters
  - Admin approves/rejects; approved request updates recruiter’s `collegeId`
  - Ensures “current access will be gone” when moving to a new college

- `Message`
  - Direct messages between recruiter and student inside the same college
  - Business rules:
    - Only recruiter can start a conversation
    - Once started, student can reply

- `EmailVerificationToken`
  - OTP tokens for signup email verification (`SIGNUP_VERIFICATION`)

---

## 4. Implementation Phases

### Phase 0 – Current Status (DONE / SETUP)

- [x] `npx create-next-app@latest` (TypeScript + Tailwind)
- [x] Initialize Prisma and PostgreSQL connection (`DATABASE_URL`)
- [x] Define Prisma schema for all entities
- [x] Run `npx prisma migrate dev` to create tables
- [x] Create `lib/prisma.ts` to share Prisma Client in the app

---

## 5. Phase 1 – Colleges & Basic Admin Setup

**Goal**: Be able to seed colleges and manage them from a simple admin interface.

**Backend**

- Seed at least one `College` row by script or Prisma Studio:
  - Example: `MJ College`, `emailDomain="@mjcollege.ac.in"`.
- Add API route `POST /api/admin/colleges` (protected; called only by an admin) to:
  - Create new colleges with `name`, `emailDomain`, `isActive`.

**Frontend**

- Simple admin page (e.g. `app/admin/colleges/page.tsx`) that:
  - Lists all colleges
  - Has a minimal “Add college” form

Admin can be created manually in DB at first (`User.role = ADMIN`).

---

## 6. Phase 2 – Authentication & Role Handling

**Goal**: Implement signup/login for students and recruiters with the correct flows.

### 6.1 Auth.js configuration

- Install Auth.js (NextAuth) and set up:
  - `/api/auth/[...nextauth]/route.ts`
- Providers:
  - **Credentials**:
    - For email + password logins (mainly students and recruiters)
  - **Google OAuth**:
    - Restrict to allowed domains when used for students

### 6.2 Student Signup Flow

- Page: `app/(auth)/signup/student/page.tsx`
- Backend: `POST /api/auth/signup-student`
  - Validate that email domain matches an active `College.emailDomain`
  - Create `User` with:
    - `role = STUDENT`
    - `collegeId = matched college`
    - `authProvider = PASSWORD` or `GOOGLE`
    - `status = ACTIVE`
  - For **email/password**:
    - Hash password to `passwordHash`
    - Create `EmailVerificationToken` (OTP)
    - Send OTP email
  - For **Google**:
    - Set `emailVerifiedAt = now()` directly

- OTP verification endpoint:
  - `POST /api/auth/verify-email`
  - Validates token, sets `emailVerifiedAt`, marks token as consumed

### 6.3 Recruiter Signup Flow

- Page: `app/(auth)/signup/recruiter/page.tsx`
- Backend: `POST /api/auth/signup-recruiter`
  - Create `User` with:
    - `role = RECRUITER`
    - `status = PENDING`
    - `collegeId = null` initially
  - Create `RecruiterCollegeRequest` with chosen `targetCollegeId`
  - No email verification required for MVP (can be added later)

### 6.4 Admin Recruiter Approval

- Admin page: `app/admin/recruiters/page.tsx`
  - List `RecruiterCollegeRequest` with recruiter info and requested college
  - Actions: **Approve / Reject**
- On approve:
  - `User.status = ACTIVE`
  - `User.collegeId = targetCollegeId`
  - Mark request `status = APPROVED` and record resolver
  - If recruiter previously had `collegeId`, it is overwritten (current access removed)

### 6.5 Route Protection

- Implement helpers (e.g. `getCurrentUser()` using Auth.js session) to:
  - Restrict student pages to `role = STUDENT`
  - Restrict recruiter pages to `role = RECRUITER`
  - Restrict admin pages to `role = ADMIN`

---

## 7. Phase 3 – Student Onboarding & Profile Building

**Goal**: Student signs in, links their roll number to scraped data, and completes profile.

### 7.1 Connecting Student to Academic Record

- Page: `app/dashboard/student/link-roll/page.tsx`
  - Form: input `rollNumber` (12 digits)
- Backend:
  - Look up `StudentAcademic` by `(collegeId, rollNumber)`.
  - If not found, show user-friendly error (scraper not yet run).
  - If found:
    - Create `StudentProfile` with:
      - `userId = current user id`
      - `academicId = StudentAcademic.id`
      - `profileCompleted = false`

### 7.2 Profile Builder Wizard

- Page: `app/dashboard/student/profile/edit/page.tsx`
  - Step sections:
    - Headline, About, Year of Study
    - Skills (with categories and predefined suggestions + “Other” input)
    - Experience (internships + other experiences)
    - Certifications

- Backend:
  - Use `StudentSkill`, `StudentExperience`, `StudentCertification` tables
  - After each save:
    - Recalculate `ussScore` by combining:
      - `StudentAcademic.currentCgpa`
      - Count of skills
      - Count/type of experiences
      - (Formula can be adjusted later)
    - Update `StudentProfile.ussScore`
  - Once minimal required parts are filled, set `profileCompleted = true`

### 7.3 Student Profile Page

- Page: `app/dashboard/student/profile/page.tsx`
  - Shows:
    - User info (name, email, profile pic)
    - Academic summary (from `StudentAcademic`)
    - Skills, experience, certifications
    - Current USS score
    - Student’s rank on leaderboard (query all profiles in same college ordered by `ussScore`)

- Allow changing:
  - Profile pic (optional, store URL)
  - Skills, experiences, certifications, headline, about
- Do **not** allow changing academic data (read-only from `StudentAcademic`).

---

## 8. Phase 4 – Leaderboard (Students + Recruiters)

**Goal**: Shared leaderboard with filters and roll-number search.

### 8.1 Leaderboard API

- Route: `GET /api/leaderboard`
  - Query parameters:
    - `sortBy` (default `USS`)
    - `yearOfStudy`
    - `branch`
    - `minCgpa`, `maxCgpa`
    - optional skill filter (later)
  - Implementation:
    - Join `StudentProfile` with `User` and `StudentAcademic`
    - Filter by `User.collegeId = current user college`
    - `ORDER BY ussScore DESC` by default

### 8.2 Leaderboard Page

- Page: `app/leaderboard/page.tsx`
  - Shared UI for `Student` and `Recruiter`
  - Features:
    - Table/list of students with key info
    - Filters (year, branch, CGPA range, USS)
    - Search by **12-digit roll number**:
      - If matching student has a `StudentProfile`:
        - Show full profile (academics + profile data)
      - Else:
        - Show only academic details from `StudentAcademic`

---

## 9. Phase 5 – Messaging (Recruiter ↔ Student DMs)

**Goal**: Recruiter can initiate DMs; students can only reply.

### 9.1 Messaging API

- Route: `POST /api/messages`
  - Validations:
    - Ensure both users belong to the same `collegeId`.
    - If **no previous message** between recruiter and student:
      - Only allow `currentUser.role = RECRUITER`.
    - If messages already exist:
      - Allow both recruiter and student to send.

- Route: `GET /api/messages?with={userId}`
  - Returns message history between current user and target user.

### 9.2 UI

- Recruiter:
  - From student profile or leaderboard row:
    - Button: “Message Student”
  - Chat UI: `app/recruiter/messages/[studentId]/page.tsx`

- Student:
  - Inbox page: `app/student/messages/page.tsx`
  - Chat detail: `app/student/messages/[recruiterId]/page.tsx`

Messages can initially use simple polling (fetch every few seconds). Live updates via websockets can be added later.

---

## 10. Phase 6 – Recruiter Home Dashboard

**Goal**: Provide recruiters with analytics and powerful filters.

### 10.1 Backend Aggregations

- Build queries that:
  - Group students by year, branch, CGPA ranges
  - Count skills (top N skills)
  - Count experiences/internships
- These are read-only analytics on:
  - `StudentAcademic`, `StudentProfile`, `StudentSkill`, `StudentExperience`

### 10.2 Dashboard UI

- Page: `app/dashboard/recruiter/page.tsx`
  - Sections:
    - Cards: total students, avg CGPA, avg USS
    - Charts:
      - CGPA distribution
      - Skills popularity
      - Experience count
    - Filters:
      - Year, branch, CGPA, skills, experience

The same filtering logic should be reused between recruiter dashboard and leaderboard API where possible.

---

## 11. Phase 7 – Academic Scraper Integration

**Goal**: Automatically fetch and update academic records monthly.

### 11.1 Scraper Service

- Implement a separate Node/Python script (outside Next.js app) that:
  - Loads DB connection from environment.
  - For each active `College`:
    - Generate list of roll numbers for current batches.
    - Crawl result portal, find all result links.
    - For each roll number:
      - Scrape academic details (GPA, SGPA, semester data).
      - `upsert` into `StudentAcademic`:
        - Preserve `id`, update GPA/CGPA, `semesters`, `lastScrapedAt`, `rawPayload`.

### 11.2 Updating USS Scores

- After updating academics:
  - For each `StudentProfile` linked to an updated `StudentAcademic`:
    - Recompute `ussScore` using current formula.

### 11.3 Scheduling

- Use any cron solution (system cron, GitHub Actions, cloud scheduler) to run scraper monthly.
- For development, run manually.

---

## 12. Phase 8 – Chatbot (Student & Recruiter)

**Goal**: Add an AI chatbot with different behavior for students and recruiters.

### 12.1 Backend API

- Routes:
  - `POST /api/chat/student`
  - `POST /api/chat/recruiter`

Each route:

- Builds context from the database:
  - Student:
    - Own `StudentProfile` + `StudentAcademic`
    - Aggregated stats from peers in same college
  - Recruiter:
    - Filtered list of students, skills, CGPA distributions
- Calls LLM provider with:
  - System prompt that enforces allowed visibility per role
  - User query and DB context summarised (no raw DB dump)

### 12.2 Frontend

- Student chat page: `app/dashboard/student/chat/page.tsx`
- Recruiter chat page: `app/dashboard/recruiter/chat/page.tsx`
- Chatbot can also respond with chart configuration data which the frontend renders into graphs.

---

## 13. Phase 9 – Production Hardening & Deployment

- Introduce proper environment variable management (`NEXTAUTH_SECRET`, DB URL, API keys).
- Choose hosting:
  - Next.js app on Vercel/Render, DB on cloud PostgreSQL (Neon/Supabase/etc.).
- Add:
  - Error logging
  - Rate limiting for messaging and chatbot endpoints
  - Input validation (Zod or similar)

---

## 14. Recommended Development Order (Short Version)

1. **Colleges + Admin seeding**  
2. **Auth.js setup** (student + recruiter signup & login, OTP for students)  
3. **Student roll-number linking + profile builder + USS**  
4. **Leaderboard + filters + roll search**  
5. **Messaging (recruiter-initiated DMs)**  
6. **Recruiter analytics dashboard**  
7. **Scraper integration and monthly academic updates**  
8. **Chatbot (student + recruiter modes)**  
9. **Deployment + production hardening**

This order ensures a usable core product early (student profiles + leaderboard) while allowing more advanced features (scraper, chatbot) to be added incrementally.
