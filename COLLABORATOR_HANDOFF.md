# Computer Networks Virtual Lab (CN-VLab) — Collaborator Handoff Guide

Welcome to the **Computer Networks Virtual Laboratory** codebase. This document outlines the architectural setup, isolated database workflow, and instructions for continuing work on Experiment 4 and the core virtual lab platform.

---

## 1. System Architecture & Environment Separation

We enforce strict separation between development and production databases to ensure live student progress is never compromised.

```text
Local Machine (develop branch)
  ├── Frontend: Vanilla JS + HTML5 (Modules in /modules)
  ├── Serverless API: /api/index.js (dispatches to /lib)
  └── Database: Neon Isolated Dev Branch (.env.local)

Production (demo-stable branch on Vercel)
  ├── Live URL: https://computer-networks-v-lab.vercel.app
  └── Database: Neon 'develop-test' (ep-falling-flower-a5bll9b1)
```

> [!IMPORTANT]
> **Never connect local development (`develop`) to the production Neon database.**
> `lib/db.js` includes a hard safety guard (`DATABASE_ENV=development` & `DEV_DATABASE_URL===DATABASE_URL`) that blocks queries if this isolation rule is violated.

---

## 2. Quickstart for Collaborators

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/Jash9876/Computer-Networks-vLab.git
cd Computer-Networks-vLab
npm install
```

### Step 2: Configure Local Environment (`.env.local`)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your provisioned Neon development branch connection string:
```env
DATABASE_URL=postgresql://<user>:<password>@<dev-branch-endpoint>.aws.neon.tech/neondb?sslmode=require
DATABASE_ENV=development
DEV_DATABASE_URL=postgresql://<user>:<password>@<dev-branch-endpoint>.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=collaborator_local_jwt_secret_xyz
FACULTY_SECRET=collaborator_local_faculty_secret_xyz
NODE_ENV=development
```

### Step 3: Run Local Development Server
```bash
npx vercel dev
# or use your preferred local static server with the serverless API runner
```

---

## 3. Git Workflow & Promotion Rule

1. **Always develop on `develop`**:
   - Verify working tree with `git status`.
   - Run tests and browser verifications against your local Neon DB branch.
2. **Do not modify `demo-stable` directly**:
   - Only after all gates (UI interaction $\rightarrow$ event logger $\rightarrow$ database ledger $\rightarrow$ milestone accumulation $\rightarrow$ quiz completion) pass 100% on `develop`, fast-forward merge into `demo-stable`.
3. **Promotion Command**:
   ```bash
   git checkout demo-stable
   git merge develop --ff-only
   git push origin demo-stable
   npx vercel --prod --yes
   git checkout develop
   ```

---

## 4. Experiment 4 Architecture & Status

Experiment 4 (*Design of Subnet IP Addressing in Packet Tracer*) supports two parts: **4-A** (Point-to-point /24 subnetting) and **4-B** (Multi-LAN & WAN /27 subnetting).

### Authoritative Milestone Catalog
Experiment 4 has **4 mandatory milestones** (25% progress each):
1. `SUBNET_DESIGNED`: Earned by Subnet Allocation/Matching (4-A & 4-B).
2. `TOPOLOGY_WIRED`: Earned by Topology Builder graph validation (4-A & 4-B).
3. `ROUTER_CONFIGURED`: Earned by Router CLI, Command Formulation, DTE/DCE configuration, or Static Route Next-Hop formulation.
4. `PING_VERIFIED`: Earned by UI Ping simulator transmitting 4/4 packets successfully across hops.

### Key Files
- [`experiment4.html`](file:///c:/Users/Jashwanth/Documents/Projects/Computer-Networks-VLab/experiment4.html): Lab DOM structure, mode switches (4-A / 4-B), CLI modals, and Icon initializers.
- [`modules/experiment4-logic.js`](file:///c:/Users/Jashwanth/Documents/Projects/Computer-Networks-VLab/modules/experiment4-logic.js): Interactive validation logic, stage checking, topology canvas, and `obs()` event trigger calls.
- [`lib/events/log.js`](file:///c:/Users/Jashwanth/Documents/Projects/Computer-Networks-VLab/lib/events/log.js): Authoritative event ledger ingestor, evidence validator (`verifyMilestoneEvidence`), and milestone updater.
- [`lib/progress/get.js`](file:///c:/Users/Jashwanth/Documents/Projects/Computer-Networks-VLab/lib/progress/get.js): Server-side authoritative milestone reconciler and dashboard progress computer.
- [`lib/quiz/submit.js`](file:///c:/Users/Jashwanth/Documents/Projects/Computer-Networks-VLab/lib/quiz/submit.js): Viva quiz grader, dual invariant enforcer (`isSimComplete && passed >= 70%`), and certificate issuer.

---

## 5. Live Production Baseline (Do Not Regress)

The live production dashboard (`https://computer-networks-v-lab.vercel.app`) tracks 6 total exercises.
For the active student account (`RA2411003010386` / `tejesh123`), the baseline state is:
- **Overall Progress**: **83%** (**5 of 6** Completed)
- **Exp 1**: `Completed` (100%)
- **Exp 2**: `Completed` (100%)
- **Exp 3**: `Completed` (100%)
- **Exp 4**: `In Progress` (64% — awaiting remaining 4-B simulation milestone / quiz)
- **Exp 5**: `Completed` (100%)
- **Exp 6**: `Completed` (100%)
