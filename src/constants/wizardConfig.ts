import { 
  Hash, 
  Globe, 
  Server, 
  Database, 
  Award, 
  ShieldCheck, 
  FileCheck,
  CreditCard,
  Cloud,
  FileText,
  TrendingUp,
  Users,
  Calculator,
  GraduationCap,
  Wrench,
  Link2
} from 'lucide-react';

export interface WizardService {
  id: string;
  label: string;
  description: string;
  icon: any;
  basePrice: number;
  isOptional?: boolean;
  options: {
    label: string;
    price: number;
    id: string;
    category?: string;
  }[];
  clientFields: {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'radio' | 'file';
    placeholder?: string;
    options?: string[];
    required?: boolean;
    condition?: (data: any) => boolean;
    showFor?: 'subscribe' | 'already_have' | 'both';
  }[];
  employeeTasks: {
    label: string;
    reward: number; // Percentage of item price or fixed points
    days: number;
  }[];
}

export const WIZARD_SERVICES: WizardService[] = [
  {
    id: 'domain',
    label: 'Domain Registration',
    description: '.com, .org, or specific academic TLDs',
    icon: Globe,
    basePrice: 15,
    options: [],
    clientFields: [
      { id: 'journalName', label: 'Name of Journal', type: 'textarea', placeholder: 'Enter the full name of your academic journal...', required: true },
      { id: 'preferredDomain1', label: '1st Preferred Domain Name', type: 'text', placeholder: 'e.g. first-preference.com', required: true, showFor: 'subscribe' },
      { id: 'preferredDomain2', label: '2nd Preferred Domain Name', type: 'text', placeholder: 'e.g. second-preference.org (optional)', showFor: 'subscribe' },
      { id: 'preferredDomain3', label: '3rd Preferred Domain Name', type: 'text', placeholder: 'e.g. third-preference.net (optional)', showFor: 'subscribe' },
      { id: 'preferredDomain4', label: '4th Preferred Domain Name', type: 'text', placeholder: 'e.g. fourth-preference.biz (optional)', showFor: 'subscribe' },
      { id: 'tld', label: 'Preferred TLD', type: 'select', options: ['.com', '.org', '.net', '.edu.pk', '.org.pk', '.biz', '.edu', '.ac', '.ac.uk', '.ac.in'], required: true, showFor: 'subscribe' },
      
      { id: 'domainNameSelection', label: 'Domain Name', type: 'text', placeholder: 'Select from list or enter new...', required: true, showFor: 'already_have' },
      { id: 'registrarSelection', label: 'Registrar', type: 'text', placeholder: 'Select or add registrar...', required: true, showFor: 'already_have' },
      { id: 'registrationDate', label: 'Domain Registration Date', type: 'text', placeholder: 'e.g. YYYY-MM-DD', showFor: 'already_have' },
      { id: 'dns', label: 'Current DNS (Nameservers)', type: 'textarea', placeholder: 'e.g. ns1.nameservers.com\nns2.nameservers.com', showFor: 'already_have' },
      { id: 'password', label: 'Domain Panel Login Password', type: 'text', placeholder: 'Enter domain panel login password', showFor: 'already_have' }
    ],
    employeeTasks: [
      { label: 'Check availability', reward: 20, days: 1 },
      { label: 'Register domain', reward: 40, days: 1 },
      { label: 'Configure DNS with hosting', reward: 40, days: 1 }
    ]
  },
  {
    id: 'hosting',
    label: 'Managed Hosting',
    description: 'High-speed hosting with SSL',
    icon: Cloud,
    basePrice: 30,
    options: [
      { id: 'cloud', label: 'Cloud Hosting Upgrade', price: 30 },
      { id: 'ssl', label: 'SSL Setup & Installation', price: 10 },
      { id: 'ojs_migration', label: '📂 OJS Migration from Existing Server', price: 50 },
      { id: 'smtp', label: 'SMTP Configuration for OJS Email Delivery', price: 10 },
      { id: 'dns_nameserver', label: '📡 DNS & Nameserver Configuration', price: 5 },
      { id: 'hosting_opt', label: '📊 Hosting Environment Optimization for OJS', price: 20 },
      { id: 'error_logging', label: '📊 Error Logging & Debug Mode Configuration', price: 10 },
      { id: 'url_rewrite', label: '🔗 URL Rewrite (Clean URLs) Configuration', price: 10 }
    ],
    clientFields: [
      { 
        id: 'hostingPreference', 
        label: 'Hosting Preference', 
        type: 'radio', 
        options: [
          'Unlimited Shared OJS Hosting (50USD/Annual/Domain)', 
          'Dedicated Cloud Server OJS Hosting (150USD/Annual/Domain)',
          'Upgrade Existing Shared Hosting to Cloud Hosting (100USD/Annual/Domain)'
        ], 
        required: true,
        showFor: 'subscribe'
      },
      
      { id: 'hostingServerSelection', label: 'Add/Select Hosting Server', type: 'text', placeholder: 'Select from list or type custom...', required: true, showFor: 'already_have' },
      { id: 'startDate', label: 'Start Date', type: 'text', placeholder: 'e.g. YYYY-MM-DD', required: true, showFor: 'already_have' },
      { id: 'expiry', label: 'Expiry', type: 'text', placeholder: 'e.g. YYYY-MM-DD', required: true, showFor: 'already_have' },
      { id: 'hostingPassword', label: 'Hosting Login Password', type: 'text', placeholder: 'Enter hosting panel password', required: true, showFor: 'already_have' }
    ],
    employeeTasks: [
      { label: 'Setup hosting server', reward: 40, days: 1 },
      { label: 'Install SSL', reward: 30, days: 1 },
      { label: 'Deploy OJS', reward: 30, days: 1 }
    ]
  },
  {
    id: 'ojs',
    label: 'OJS Setup',
    description: 'Complete Open Journal Systems platform',
    icon: FileText,
    basePrice: 70,
    options: [
      { id: 'ojs_install', label: '⚙️ OJS Latest Version Installation', price: 10, category: 'Installation & Configuration' },
      { id: 'ojs_upgrade', label: '🔄 Upgrade Existing OJS to Latest Version', price: 20, category: 'Installation & Configuration' },
      { id: 'ojs_migrate', label: '📂 Migrate Existing OJS to New Server', price: 50, category: 'Installation & Configuration' },
      
      { id: 'custom_homepage', label: '🎨 Custom Journal Homepage Design', price: 75, category: 'Design & Branding' },
      { id: 'journal_branding', label: '🖼️ Journal Branding (Logo, Colors & Banner)', price: 35, category: 'Design & Branding' },
      { id: 'mobile_opt', label: '📱 Mobile Responsive Layout Optimization', price: 25, category: 'Design & Branding' },
      { id: 'dark_mode', label: '🌙 Dark Mode Theme (Compatible)', price: 20, category: 'Design & Branding' },
      
      { id: 'editorial_board', label: '👥 Editorial Board Configuration', price: 20, category: 'Editorial Setup' },
      { id: 'editorial_roles', label: '🏛️ Editorial Roles & Permissions Setup', price: 20, category: 'Editorial Setup' },
      { id: 'reviewer_workflow', label: '👨‍⚖️ Reviewer Workflow Configuration', price: 20, category: 'Editorial Setup' },
      
      { id: 'oai_pmh', label: '🔍 OAI-PMH Configuration', price: 20, category: 'Publishing Features' },
      
      { id: 'security_hardening', label: '🔒 OJS Security Hardening', price: 25, category: 'Security & Performance' },
      
      { id: 'live_training', label: '🎥 Live OJS Training (2 Hours)', price: 0, category: 'Training & Documentation' },
      { id: 'recorded_training', label: '🎬 Recorded Training Videos', price: 25, category: 'Training & Documentation' },
      { id: 'priority_support', label: '📞 Priority Setup Support (1 Year)', price: 30, category: 'Training & Documentation' }
    ],
    clientFields: [
      { id: 'editorialBoard', label: 'Editorial Board (Doc File)', type: 'file' },
      { id: 'logo', label: 'Journal Logo', type: 'file' },
      { id: 'sections', label: 'Sections (Articles, Reviews, etc.)', type: 'textarea', placeholder: 'List your desired sections...' },
      { id: 'about', label: 'About Journal / Policies', type: 'textarea' }
    ],
    employeeTasks: [
      { label: 'Install OJS', reward: 20, days: 1 },
      { label: 'Configure journal settings & OJS Config', reward: 20, days: 2 },
      { label: 'Setup submission workflow', reward: 20, days: 1 },
      { label: 'Add users (Editor, Reviewer)', reward: 10, days: 1 },
      { label: 'Customize theme', reward: 30, days: 2 }
    ]
  },
  {
    id: 'issn',
    label: 'ISSN Registration',
    description: 'Official ISSN Number for your journal',
    icon: Hash,
    basePrice: 100, // Total of Consultation + Fee + Processing
    options: [
      { id: 'fast_track', label: 'Fast-track Handling', price: 30 },
      { id: 'sample_issue', label: 'Sample Issue Fabrication', price: 10 },
    ],
    clientFields: [
      { id: 'title', label: 'Journal Title', type: 'text', required: true, showFor: 'subscribe' },
      { id: 'publisher', label: 'Publisher Name & Address', type: 'textarea', required: true, showFor: 'subscribe' },
      { id: 'email', label: 'Email', type: 'text', required: true, showFor: 'subscribe' },
      { id: 'phone', label: 'Phone', type: 'text', required: true, showFor: 'subscribe' },
      { id: 'url', label: 'Website URL (if exists)', type: 'text', showFor: 'subscribe' },
      
      { id: 'issnPrint', label: 'ISSN (Print)', type: 'text', showFor: 'already_have' },
      { id: 'issnOnline', label: 'ISSN (Online)', type: 'text', showFor: 'already_have' },
      { id: 'issnLogin', label: 'ISSN Portal Login Email / Username', type: 'text', placeholder: 'Enter ISSN portal username', required: true, showFor: 'already_have' },
      { id: 'issnPassword', label: 'ISSN Portal Password', type: 'text', placeholder: 'Enter ISSN portal password', required: true, showFor: 'already_have' },
      { id: 'issnCertificate', label: 'Upload Certificate', type: 'file', showFor: 'already_have' }
    ],
    employeeTasks: [
      { label: 'Verify journal scope & title uniqueness', reward: 10, days: 2 },
      { label: 'Create ISSN Portal and Deposit fee', reward: 10, days: 1 },
      { label: 'Prepare ISSN application form', reward: 15, days: 2 },
      { label: 'Update Journal Policies for ISSN', reward: 15, days: 2 },
      { label: 'Format sample issue properly', reward: 10, days: 2 },
      { label: 'Submit to ISSN Center', reward: 10, days: 1 },
      { label: 'Follow-up till approval', reward: 30, days: 14 }
    ]
  },
  {
    id: 'indexing',
    label: 'Indexing',
    description: "Help improve your journal's visibility by submitting it to suitable indexing databases. Choose the package that best fits your journal's goals and budget",
    icon: Database,
    basePrice: 10,
    options: [
      { id: 'express_processing', label: 'Express Processing', price: 20 },
      { id: 'google_scholar_opt', label: 'Google Scholar Optimization', price: 25 },
      { id: 'doaj_prep', label: 'DOAJ Preparation', price: 60 },
      { id: 'scopus_readiness', label: 'Scopus Readiness Review', price: 150 },
      { id: 'metadata_audit', label: 'Metadata Quality Audit', price: 20 },
      { id: 'citation_analysis', label: 'Journal Citation Analysis', price: 45 },
      { id: 'status_monitoring', label: 'Indexing Status Monitoring ($15/month)', price: 15 },
      { id: 'resubmission_support', label: 'Re-submission Support', price: 10 }
    ],
    clientFields: [
      { id: 'indexingPackage', label: 'Selected Package', type: 'radio', options: ['Starter Package (20 Indexing Applications)', 'Professional Package (40 Indexing Applications)', 'Premium Package (50 Indexing Applications)', 'Enterprise Package (Custom Indexing Campaign)'], required: true, showFor: 'subscribe' },
      { id: 'journal_website', label: 'Journal Website', type: 'text', placeholder: 'e.g. https://myjournal.com', required: true },
      { id: 'ojs_version', label: 'OJS Version', type: 'text', placeholder: 'e.g. OJS 3.3.0-14', required: true },
      { id: 'issn', label: 'ISSN', type: 'text', placeholder: 'e.g. 1234-5678', required: true },
      { id: 'eissn', label: 'eISSN', type: 'text', placeholder: 'e.g. 8765-4321', required: true },
      { id: 'publisher_name', label: 'Publisher Name', type: 'text', placeholder: 'e.g. Academic Press', required: true },
      { id: 'country', label: 'Country', type: 'text', placeholder: 'e.g. Pakistan', required: true },
      { id: 'subject_area', label: 'Subject Area', type: 'text', placeholder: 'e.g. Computer Science, Medicine', required: true },
      { id: 'existing_indexes', label: 'Existing Indexes', type: 'textarea', placeholder: 'List any databases your journal is already indexed in...', required: false },
      { id: 'target_indexes', label: 'Target Indexes', type: 'textarea', placeholder: 'e.g. Google Scholar, ResearchGate, ROAD, Copernicus', required: true },
      { id: 'special_instructions', label: 'Special Instructions', type: 'textarea', placeholder: 'Any specific requests or instructions...', required: false }
    ],
    employeeTasks: [
      { label: 'Verify metadata compliance', reward: 30, days: 3 },
      { label: 'Draft schema-ready meta structures', reward: 30, days: 2 },
      { label: 'Submit listing requests to fundamental indexes', reward: 40, days: 5 }
    ]
  },
  {
    id: 'hec',
    label: 'HEC Pakistan Recognition',
    description: 'Application prep and submission handling for Higher Education Commission recognition',
    icon: Award,
    basePrice: 100,
    options: [],
    clientFields: [
      { id: 'eb_cv', label: 'Editorial Board CV (1 Page)', type: 'file', required: true },
      { id: 'review_files', label: 'Plagiarism & Review Files', type: 'file', required: true },
      { id: 'ethics_policy', label: 'Ethics & Peer Review Policies', type: 'textarea', required: true }
    ],
    employeeTasks: [
      { label: 'Check HEC criteria compliance', reward: 25, days: 3 },
      { label: 'Prepare documentation package', reward: 25, days: 5 },
      { label: 'Submit application through portal', reward: 25, days: 1 },
      { label: 'Handle revisions & objections', reward: 25, days: 30 }
    ]
  },
  {
    id: 'doaj',
    label: 'DOAJ Indexing',
    description: 'Open access directory submission',
    icon: ShieldCheck,
    basePrice: 60,
    isOptional: true,
    options: [],
    clientFields: [
      { id: 'oa_policy', label: 'Open Access Policy', type: 'textarea', required: true },
      { id: 'license', label: 'Licensing Type', type: 'select', options: ['CC-BY', 'CC-BY-NC', 'CC-BY-SA'], required: true }
    ],
    employeeTasks: [
      { label: 'Ensure DOAJ compliance', reward: 30, days: 3 },
      { label: 'Metadata formatting', reward: 30, days: 2 },
      { label: 'Submit application', reward: 40, days: 1 }
    ]
  },
  {
    id: 'doi',
    label: 'DOI Registration (CrossRef)',
    description: 'Permanent identifiers for your articles',
    icon: Link2,
    basePrice: 30, // crossref setup
    isOptional: true,
    options: [
      { id: 'pkg1', label: 'Package 1 ($275 Annual + $1/DOI)', price: 275 },
      { id: 'pkg2', label: 'Package 2 ($2/DOI + Zero Annual)', price: 0 }
    ],
    clientFields: [
      { id: 'publisherName', label: 'Publisher Name', type: 'text', placeholder: 'Enter Publisher Name', required: true, showFor: 'subscribe' },
      { id: 'publisherAddress', label: 'Publisher Address', type: 'text', placeholder: 'Enter Publisher Address', required: true, showFor: 'subscribe' },
      { id: 'editorialMember1', label: 'Editorial team Name Affiliation, Email (Add at least 5 members)', type: 'text', placeholder: 'e.g. Dr. John Doe, Oxford University, john@oxford.edu', required: true, showFor: 'subscribe' },
      { id: 'editorialMember2', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Jane Smith, Harvard University, jane@harvard.edu', required: true, showFor: 'subscribe' },
      { id: 'editorialMember3', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Robert Lee, Stanford University, robert@stanford.edu', required: true, showFor: 'subscribe' },
      { id: 'editorialMember4', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Alice Johnson, MIT, alice@mit.edu', required: true, showFor: 'subscribe' },
      { id: 'editorialMember5', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Michael Brown, Cambridge, michael@cambridge.edu', required: true, showFor: 'subscribe' },
      
      { id: 'crossrefEmail', label: 'Crossref Email Address', type: 'text', placeholder: 'Enter Crossref login email', required: true, showFor: 'already_have' },
      { id: 'crossrefPassword', label: 'Crossref Password', type: 'text', placeholder: 'Enter Crossref account password', required: true, showFor: 'already_have' }
    ],
    employeeTasks: [
      { label: 'Register CrossRef account', reward: 30, days: 3 },
      { label: 'Assign DOI to articles', reward: 40, days: 2 },
      { label: 'Upload metadata XML', reward: 30, days: 1 }
    ]
  },
  {
    id: 'cfp_bhoosting',
    label: 'Call For Papers Bhoosting',
    description: 'Promotion and campaign setup to attract premium original articles',
    icon: TrendingUp,
    basePrice: 40,
    isOptional: true,
    options: [
      { id: 'social_reach', label: 'Extend to Social Communities', price: 15 },
      { id: 'scholar_direct', label: 'Direct Email Outreaches (150 Scholars)', price: 25 }
    ],
    clientFields: [
      { id: 'discipline', label: 'Subject / Focus Scope', type: 'text', placeholder: 'e.g. Applied AI, Medical Informatics', required: true },
      { id: 'target_deadline', label: 'Submission Target Date', type: 'text', placeholder: 'e.g. 2026-10-31' }
    ],
    employeeTasks: [
      { label: 'Design Call For Papers flyers & posters', reward: 30, days: 2 },
      { label: 'Manage email/campaign system dispatch', reward: 40, days: 3 },
      { label: 'Collate potential authors inquiry', reward: 30, days: 10 }
    ]
  },
  {
    id: 'call_board',
    label: 'Call for Editorail Board/ Advisory Board',
    description: 'Strategic planning and outreach lists to expand your scientific council',
    icon: Users,
    basePrice: 50,
    isOptional: true,
    options: [
      { id: 'certified_check', label: 'Verification of Scholar Credentials', price: 15 }
    ],
    clientFields: [
      { id: 'required_specialty', label: 'Desired Board Specialties/Sectors', type: 'textarea', placeholder: 'e.g. Experts in Clinical Virology and Machine Learning methods...', required: true }
    ],
    employeeTasks: [
      { label: 'Create board recruitment brochures', reward: 30, days: 4 },
      { label: 'Target and invite reputable researchers', reward: 40, days: 12 },
      { label: 'Confirm board profiles compliance to index rules', reward: 30, days: 5 }
    ]
  },
  {
    id: 'scopus_app',
    label: 'Scopus Application',
    description: 'Pre-evaluation assessment and complete dossier submission',
    icon: FileCheck,
    basePrice: 150,
    isOptional: true,
    options: [
      { id: 'pre_assessment', label: 'Comprehensive Gap Analysis Report', price: 50 }
    ],
    clientFields: [
      { id: 'scopus_history', label: 'Any previous Scopus feedback/dates', type: 'textarea', placeholder: 'Enter comments if you previously applied...' }
    ],
    employeeTasks: [
      { label: 'Evaluate previous 2 years editorial records', reward: 25, days: 5 },
      { label: 'Optimize OJS meta tagging formats to Scopus standards', reward: 25, days: 4 },
      { label: 'Prepare and hand over Scopus Application Dossier', reward: 50, days: 7 }
    ]
  },
  {
    id: 'citation_score',
    label: 'Journal Citation Score Calculation',
    description: 'Track citations, formulate h-index targets and optimize impact factors',
    icon: Calculator,
    basePrice: 45,
    isOptional: true,
    options: [],
    clientFields: [
      { id: 'tracking_profiles', label: 'Scholarly URL (e.g. Google Scholar, ResearchGate)', type: 'text', placeholder: 'https://', required: true }
    ],
    employeeTasks: [
      { label: 'Map existing citation chains', reward: 40, days: 6 },
      { label: 'Generate comprehensive citation boost plan', reward: 60, days: 4 }
    ]
  },
  {
    id: 'google_scholar_support',
    label: 'Google Schoalr Indexing Support',
    description: 'Metadata optimization, sitemap config, and Google Console tracking integration',
    icon: GraduationCap,
    basePrice: 25,
    isOptional: true,
    options: [],
    clientFields: [
      { id: 'ojs_link', label: 'Your active OJS website URL', type: 'text', placeholder: 'https://', required: true }
    ],
    employeeTasks: [
      { label: 'Install and optimize Dublin Core plugins on OJS', reward: 40, days: 2 },
      { label: 'Configure crawl pathways and Google Search console', reward: 60, days: 3 }
    ]
  },
  {
    id: 'ojs_debugging',
    label: 'OJS Debugging Service',
    description: 'Technical troubleshooting, SMTP email patch, and plugin conflict resolution',
    icon: Wrench,
    basePrice: 55,
    isOptional: true,
    options: [
      { id: 'urgent_patch', label: 'Urgent Debug (under 24 hours)', price: 35 }
    ],
    clientFields: [
      { id: 'error_details', label: 'Detailed issue description or error codes', type: 'textarea', placeholder: 'e.g. Emails are going to SPAM, upload errors size limit exceeded...', required: true }
    ],
    employeeTasks: [
      { label: 'Inspect server logs and configurations', reward: 30, days: 1 },
      { label: 'Apply hot-fix and code debug solutions securely', reward: 70, days: 2 }
    ]
  }
];
