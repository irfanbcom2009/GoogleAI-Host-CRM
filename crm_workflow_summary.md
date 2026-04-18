# CRM Workflow & Journal Operations Management System Details

## Core Architecture
- **Frontend**: React + TypeScript + Framer Motion + Lucide Icons + Tailwind CSS.
- **Backend**: Firebase (Firestore, Auth).
- **AI Integration**: Google Gemini API for task descriptions, activity summarization, and financial insights.

## Key Modules
1. **Workflow Engine**: 
   - Automates task generation upon service orders.
   - Predefined templates for ISSN, DOI, OJS, Hosting, Indexing, and more.
   - Kanban board visualization with statuses: Pending, In Progress, Review, Completed, Rework.

2. **Journal Health Dashboard**:
   - AI-driven health scoring (0-100).
   - Component checks: ISSN, DOI, OJS, Security, Indexing.
   - Proactive suggestions for journal improvement.

3. **Financial Intelligence**:
   - Revenue vs. Expenses tracking.
   - AI Analysis of financial data for growth recommendations.
   - Service-level profit visibility.

4. **Credential Vault**:
   - Secure storage for Domain, Hosting, and OJS credentials.
   - Access logging to track who viewed what and when.

5. **Performance Leaderboard**:
   - Employee ranking based on task completion and points.
   - Tracks quality score, rework rate, and average completion time.

6. **Notification System**:
   - Alerts for domain/ISSN expirations.
   - Task assignments and status changes.
   - System updates.

7. **Advanced Search & Filtering**:
   - Global command palette (Cmd/Ctrl + K).
   - Dynamic table column selection.

## Data Schema (Firestore)
- `users`: Clients and Employees with roles and permissions.
- `journals`: Core journal metadata, health scores, and linked services.
- `orders`: Service bookings with requirements and tracking.
- `tasks`: Individual workflow items linked to orders and journals.
- `expenses`: Financial tracking.
- `notifications`: User-specific alert stream.
- `vault`: Secure credentials.
- `activity_logs`: Audit trail for all system changes.

## Proposed Enhancements for ChatGPT Discussion
- Integration with external DOAJ/Crossref APIs for automated metadata syncing.
- Multi-currency support for global clients.
- Advanced SLA monitoring with automated escalation for overdue tasks.
- Customer satisfaction (CSAT) survey integration post-deliverable.
