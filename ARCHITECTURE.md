# Host A Journal CRM Architecture

## 1. CRM Architecture Diagram
The system is built as a multi-tenant (per-publisher/client) CRM with a focus on service automation and life-cycle management.

**Core Layers:**
*   **Presentation Layer**: React + Tailwind UI (Vite-based)
*   **Business Logic Layer**: Custom Services (Uniqueness, Gemini AI, Recommendations)
*   **Data Layer**: Firebase Firestore (NoSQL) & Authentication

---

## 2. Database Structure (Collections & Schemas)

### `users` (Clients & Employees)
*   `role`: 'Admin' | 'Manager' | 'Employee' | 'Client'
*   `permissions`: Module-level visibility and action scopes.
*   `points`: Reward/Commission system points.
*   `subscription_prefs`: Client-specific notification and service preferences.

### `catalog` (Service Definitions)
*   `name`: Service name (Domain, ISSN, etc.)
*   `tiers`: Array of `ServiceTier`
    *   `Basic`: Standard pricing, core steps.
    *   `Advanced`: Higher price, extra fields/steps.
    *   `Premium`: Highest price, priority flag.
*   `formConfig`: Dynamic fields (WYSIWYG generated).
*   `add_ons`: Optional pricing items.

### `journals` (The Product)
*   `title`, `issnPrint`, `issnOnline`
*   `lifecycleStatus`: Draft → Published → Archived.
*   `lifecycleHistory`: Trace of all status changes.
*   `credentials`: Managed login info for OJS/ISSN portals.

### `domains` (Infrastructure)
*   `domainName`, `registrar`, `expirationDate`
*   `ownershipHistory`: Client transfer logs.

---

## 3. UI/UX Module Structure
*   **Dashboard**: Role-specific overview (Sales vs Operations).
*   **Service Catalog**: Front-facing store and admin builder.
*   **Task Manager**: Kanban-style internal flow.
*   **Financial Module**: Invoices, point conversion (USD/PKR), and commissions.
*   **Journal Lifecycle Tracker**: Progress visualization of a journal's growth.

---

## 4. Workflow Diagram (Text-Based)

### Service Activation Workflow
1.  **Selection**: Client chooses service (e.g., ISSN) and tier (Premium).
2.  **Form Filling**: Dynamic form generated based on `formConfig`.
3.  **Payment**: Invoice generated; held in `Pending Payment` status.
4.  **Auto-Assignment**: System triggers `client_services` creation and auto-assigns `EmployeeTasks`.
5.  **Execution**: 
    *   Client uploads documents (Checklist).
    *   Employee performs steps (Workflow).
6.  **Finalization**: Service marked `Completed`, revenue points calculated.

### Journal Lifecycle Workflow
1.  **Draft**: Metadata input, Domain assigned.
2.  **Submission**: ISSN/HEC applications triggered.
3.  **Active**: Indexing services applied.
4.  **Published**: Public URL verified, DOI assigned.
5.  **Archive**: Read-only state for historical tracking.
