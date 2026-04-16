import { LucideIcon, Shield, Users, Briefcase, Workflow, CheckSquare, ShieldCheck, CreditCard, Headphones, BarChart, Settings, RefreshCw, Info, Globe } from 'lucide-react';

export interface HandbookSection {
  id: string;
  title: string;
  icon: any;
  content?: string;
  subsections?: {
    title: string;
    content: string;
  }[];
}

export const HANDBOOK_CONTENT: HandbookSection[] = [
  {
    id: 'overview',
    title: '1. Company Overview',
    icon: Info,
    content: 'Host A Journal is a professional platform providing academic journal services including OJS hosting, journal management, indexing, ISSN support, and technical maintenance. The organization operates through a structured CRM system to ensure efficient client handling and service delivery.'
  },
  {
    id: 'crm',
    title: '2. CRM Policies',
    icon: Users,
    subsections: [
      {
        title: '2.1 Client Data Management',
        content: 'All client information must be stored in the CRM system.\n\nMandatory fields:\n• Client Name\n• Email\n• Organization / Journal Name\n• Contact Number\n\nData must be accurate and updated regularly. Duplicate entries are strictly prohibited.'
      },
      {
        title: '2.2 Data Security & Privacy',
        content: 'Client data is confidential and must not be shared externally. Only authorized staff can access CRM records. Regular backups must be maintained. CRM access should be role-based (Admin, Manager, Staff).'
      },
      {
        title: '2.3 Service Tracking',
        content: 'Every service must be logged under the client profile. Each service must include:\n• Service Name\n• Task List\n• Status (Pending, In Progress, Completed)\n• Assigned Employee\n• Deadline'
      },
      {
        title: '2.4 Communication Logs',
        content: 'All client communications must be recorded (Emails, WhatsApp summaries, Call notes). Maintain professionalism in all communications.'
      }
    ]
  },
  {
    id: 'employee',
    title: '3. Employee Policies',
    icon: Briefcase,
    subsections: [
      {
        title: '3.1 Roles & Responsibilities',
        content: '• Admin: Full system control, approves services/pricing, manages employees.\n• Manager: Assigns tasks, monitors workflow, reviews work.\n• Technical Staff: OJS installation/upgrades, bug fixing, server management.\n• Content/Support Staff: Client communication, article uploads, metadata handling.'
      },
      {
        title: '3.2 Work Ethics',
        content: 'Maintain professionalism at all times. Meet deadlines strictly. Avoid miscommunication. Do not commit services without approval.'
      },
      {
        title: '3.3 Attendance & Availability',
        content: 'Employees must be available during working hours. Delays must be reported in advance. Urgent tasks must be prioritized.'
      },
      {
        title: '3.4 Confidentiality',
        content: 'Do not share client data, server credentials, or internal processes. Violation may result in termination.'
      }
    ]
  },
  {
    id: 'workflow',
    title: '4. Service Delivery Workflow',
    icon: Workflow,
    content: 'Step 1: Client Onboarding (Add to CRM, record details)\nStep 2: Service Creation (Select category, define tasks/pricing)\nStep 3: Task Assignment (Assign to employees, set deadlines)\nStep 4: Execution (Perform tasks, maintain logs)\nStep 5: Quality Check (Manager reviews work, ensure requirements met)\nStep 6: Client Delivery (Share report, provide credentials, get confirmation)\nStep 7: Closure & Feedback (Mark completed, collect feedback)'
  },
  {
    id: 'task',
    title: '5. Task Management Policy',
    icon: CheckSquare,
    content: 'Each service must be broken into tasks. Tasks must include description, assigned person, and deadline. Status must be updated daily (Pending, In Progress, Completed).'
  },
  {
    id: 'qa',
    title: '6. Quality Assurance Policy',
    icon: ShieldCheck,
    content: 'All services must pass QA before delivery. Check for website functionality, security vulnerabilities (XSS, SQL Injection), and proper indexing setup. Maintain a checklist for each service.'
  },
  {
    id: 'security',
    title: '7. Security Policy',
    icon: Shield,
    content: 'Regular system updates. Use strong passwords. Enable firewall and malware protection. Periodic security audits. Immediate action on detected vulnerabilities.'
  },
  {
    id: 'pricing',
    title: '8. Pricing & Payment Policy',
    icon: CreditCard,
    content: 'Pricing must be predefined in CRM. No hidden charges. Payment terms: 50% advance (recommended), 50% after completion. Record all transactions in CRM.'
  },
  {
    id: 'support',
    title: '9. Client Support Policy',
    icon: Headphones,
    content: 'Response time: within 24 hours. Provide clear and professional replies. Maintain support tickets in CRM. Offer post-service support (if included).'
  },
  {
    id: 'reporting',
    title: '10. Reporting & Analytics',
    icon: BarChart,
    content: 'Generate reports for completed services, pending tasks, and employee performance. Monthly performance review.'
  },
  {
    id: 'usage',
    title: '11. System Usage Policy',
    icon: Settings,
    content: 'Employees must use CRM for all operations. Avoid external tracking systems. No manual handling outside CRM.'
  },
  {
    id: 'improvement',
    title: '12. Improvement & Updates',
    icon: RefreshCw,
    content: 'Continuously improve workflow, services, and CRM features. Collect feedback from clients and employees.'
  },
  {
    id: 'ethics',
    title: '13. Professional Ethics',
    icon: ShieldCheck,
    content: 'All employees are expected to maintain the highest standards of integrity. Misrepresentation of journal metrics or indexing status is strictly prohibited. We value transparency with our clients above all.'
  },
  {
    id: 'remote',
    title: '14. Remote Work Policy',
    icon: Globe,
    content: 'Remote employees must maintain a stable internet connection and be available on official communication channels (Slack/WhatsApp) during their shift. Time tracking via the CRM is mandatory.'
  },
  {
    id: 'system-logic',
    title: '15. System Logic & Access Control',
    icon: ShieldCheck,
    subsections: [
      {
        title: '15.1 Employee Hiring & Rehiring',
        content: '• Hiring: New employees are registered with a unique ID (EMP-YYYYMMDD-XXX).\n• Rehiring: Previous records are NEVER deleted. On rehire, the previous joining/ending dates are moved to Employment History, and a new Joining Date is set. This ensures a complete audit trail of employment cycles.'
      },
      {
        title: '15.2 Portal Access Rules',
        content: '• Access is restricted to authorized Google accounts only.\n• Self-registration is disabled. Users must be added by an Admin.\n• Portal Access Toggle: Admins can enable/disable access. Disabled users are immediately logged out and cannot re-login.'
      },
      {
        title: '15.3 Domain Management Logic',
        content: '• Client View: Clients only see domains assigned to them.\n• Assignment: Domains can only be assigned to one client at a time.\n• Transfers: When a domain is transferred, the system records the previous owner, new owner, and transfer date in the Ownership History log.'
      },
      {
        title: '15.4 Role-Based Permissions',
        content: '• Admin: Full access, including managing employees, portal access, and system settings.\n• Manager: Can manage clients, domains, and journals, but cannot delete verified records or manage other admins.\n• Employee: Can view and edit assigned records based on specific feature permissions.\n• Client: View-only access to their own journals, domains, and invoices.'
      },
      {
        title: '15.5 Audit & Activity Logs',
        content: 'The system maintains detailed logs for:\n• Employee status and role changes.\n• Domain ownership transfers.\n• Portal access modifications.\n• Unauthorized login attempts.'
      }
    ]
  }
];
