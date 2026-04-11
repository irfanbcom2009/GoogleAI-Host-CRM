import { FileCheck, Globe, Search, BookOpen, TrendingUp } from 'lucide-react';

export const SERVICES_CATALOG = [
  {
    id: 'issn',
    category: 'ISSN Registration & Compliance',
    items: [
      {
        title: 'ISSN Application (Print & Online)',
        description: 'Complete process to obtain ISSN for both print and online journal versions.',
        price: 25000,
        requirements: ['Journal title', 'Publisher details', 'Website URL', 'Sample issue (PDF)'],
        deliverables: ['ISSN approval (Print + Online)', 'Official ISSN certificate guidance', 'ISSN display setup on website']
      },
      {
        title: 'ISSN Modification / Correction',
        description: 'Update or correct existing ISSN records.',
        price: 10000,
        requirements: ['Existing ISSN details', 'Required changes'],
        deliverables: ['Updated ISSN record', 'Confirmation from ISSN authority']
      },
      {
        title: 'ISSN Consultation',
        description: 'Expert guidance for ISSN approval and compliance.',
        price: 5000,
        requirements: ['Basic journal idea'],
        deliverables: ['Step-by-step ISSN roadmap', 'Compliance checklist']
      }
    ]
  },
  {
    id: 'hosting',
    category: 'Journal Hosting & OJS Infrastructure',
    items: [
      {
        title: 'OJS Installation & Setup',
        description: 'Full Open Journal Systems installation and configuration.',
        price: 15000,
        requirements: ['Domain & hosting access'],
        deliverables: ['Fully working OJS website', 'Admin access + setup']
      },
      {
        title: 'OJS Hosting (Monthly)',
        description: 'Secure and optimized hosting for journal systems.',
        price: 5000,
        unit: 'month',
        requirements: ['Journal files (if migration)'],
        deliverables: ['Fast hosting server', 'Daily backups', 'Security monitoring']
      },
      {
        title: 'OJS Migration / Upgrade',
        description: 'Upgrade or migrate old OJS to latest version.',
        price: 12000,
        requirements: ['Old website access', 'Database backup'],
        deliverables: ['Updated OJS system', 'Data safely migrated']
      },
      {
        title: 'Website Design & Customization',
        description: 'Professional journal UI/UX design.',
        price: 10000,
        requirements: ['Logo / branding (optional)'],
        deliverables: ['Custom theme', 'Responsive design']
      }
    ]
  },
  {
    id: 'indexing',
    category: 'Journal Indexing & Global Visibility',
    items: [
      {
        title: 'Basic Indexing Package',
        description: 'Submission to multiple indexing platforms.',
        price: 10000,
        requirements: ['Journal website', 'Published articles'],
        deliverables: ['50+ indexing submissions', 'Submission report']
      },
      {
        title: 'Google Scholar Indexing',
        description: 'Setup and optimization for Google Scholar visibility.',
        price: 5000,
        requirements: ['Website access'],
        deliverables: ['Proper indexing setup', 'Search visibility improvement']
      },
      {
        title: 'Advanced Indexing Strategy',
        description: 'Strategy for Scopus, HEC, WoS readiness.',
        price: 15000,
        requirements: ['Active journal', 'Editorial board'],
        deliverables: ['Indexing roadmap', 'Gap analysis report']
      }
    ]
  },
  {
    id: 'editorial',
    category: 'Editorial & Publication Management',
    items: [
      {
        title: 'Article Processing & Publication',
        description: 'Manage article submission to publication.',
        price: 1000,
        unit: 'article',
        requirements: ['Article files'],
        deliverables: ['Published article on OJS', 'Metadata entry']
      },
      {
        title: 'Peer Review Management',
        description: 'Handle full peer review workflow.',
        price: 2000,
        unit: 'article',
        requirements: ['Reviewer list (optional)'],
        deliverables: ['Reviewer assignment', 'Review reports']
      },
      {
        title: 'Copyediting & Proofreading',
        description: 'Improve grammar, citations, and formatting.',
        price: 1500,
        unit: 'article',
        requirements: ['Article document'],
        deliverables: ['Edited version', 'Error-free manuscript']
      },
      {
        title: 'OJS Data Entry / Issue Publishing',
        description: 'Upload and publish full journal issues.',
        price: 5000,
        unit: 'issue',
        requirements: ['Final articles'],
        deliverables: ['Complete issue published', 'Structured content']
      },
      {
        title: 'Old Issue Migration',
        description: 'Upload past journal issues into OJS.',
        price: 8000,
        requirements: ['Old PDFs'],
        deliverables: ['All issues uploaded', 'Proper archive structure']
      }
    ]
  },
  {
    id: 'growth',
    category: 'Journal Growth & Impact Enhancement',
    items: [
      {
        title: 'Call for Papers Campaign',
        description: 'Promote journal to attract submissions.',
        price: 5000,
        requirements: ['Journal details'],
        deliverables: ['Designed CFP', 'Distribution campaign']
      },
      {
        title: 'Citation Growth Strategy',
        description: 'Improve journal citations and impact.',
        price: 10000,
        requirements: ['Published articles'],
        deliverables: ['Citation plan', 'Author engagement strategy']
      },
      {
        title: 'Editorial Board Development',
        description: 'Build strong international editorial board.',
        price: 8000,
        requirements: ['Existing board (if any)'],
        deliverables: ['Suggested experts', 'Board structure']
      },
      {
        title: 'Journal Branding & Promotion',
        description: 'Build professional journal identity.',
        price: 12000,
        requirements: ['Basic info'],
        deliverables: ['Branding kit', 'Promotional content']
      },
      {
        title: 'Full Journal Growth Plan',
        description: 'Complete roadmap to grow journal impact.',
        price: 20000,
        requirements: ['Active journal'],
        deliverables: ['Growth strategy document', 'Monthly action plan']
      }
    ]
  },
  {
    id: 'technical',
    category: 'Technical Support & Maintenance',
    items: [
      {
        title: 'SSL Certificate Installation',
        description: 'Secure your journal website with HTTPS.',
        price: 3000,
        requirements: ['Server access'],
        deliverables: ['Installed SSL', 'HTTPS redirection']
      },
      {
        title: 'OJS Plugin Installation',
        description: 'Add custom features to your OJS system.',
        price: 4000,
        requirements: ['OJS admin access'],
        deliverables: ['Configured plugin', 'Usage guide']
      },
      {
        title: 'Database Optimization',
        description: 'Improve website speed and performance.',
        price: 6000,
        requirements: ['Database access'],
        deliverables: ['Optimized tables', 'Performance report']
      }
    ]
  },
  {
    id: 'bundles',
    category: 'Service Bundles (Discounted)',
    items: [
      {
        title: 'Starter Journal Bundle',
        description: 'Perfect for new journals. Includes ISSN, OJS Setup, and Basic Indexing.',
        price: 40000, // Individual: 25k + 15k + 10k = 50k (20% discount)
        isBundle: true,
        bundleItems: [
          { id: 'issn_app', title: 'ISSN Application (Print & Online)', individualPrice: 25000 },
          { id: 'ojs_setup', title: 'OJS Installation & Setup', individualPrice: 15000 },
          { id: 'basic_indexing', title: 'Basic Indexing Package', individualPrice: 10000 }
        ],
        requirements: ['Journal title', 'Publisher details', 'Domain access'],
        deliverables: ['ISSN approval', 'OJS Website', '50+ Indexing submissions']
      },
      {
        title: 'Growth & Visibility Bundle',
        description: 'Boost your journal impact. Includes Google Scholar, Advanced Indexing, and Citation Strategy.',
        price: 25000, // Individual: 5k + 15k + 10k = 30k (16% discount)
        isBundle: true,
        bundleItems: [
          { id: 'gs_indexing', title: 'Google Scholar Indexing', individualPrice: 5000 },
          { id: 'adv_indexing', title: 'Advanced Indexing Strategy', individualPrice: 15000 },
          { id: 'cit_growth', title: 'Citation Growth Strategy', individualPrice: 10000 }
        ],
        requirements: ['Active journal website'],
        deliverables: ['Scholar setup', 'Indexing roadmap', 'Citation plan']
      }
    ]
  }
];
