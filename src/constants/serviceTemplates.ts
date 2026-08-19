import { ServiceTemplate } from '../types';

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate> = {
  'issn': {
    id: 'issn',
    name: 'ISSN Application',
    basePrice: 50,
    description: 'International Standard Serial Number application for your journal.',
    subItems: [
      { id: 'issn_print', name: 'Print ISSN Application', price: 25 },
      { id: 'issn_online', name: 'Online ISSN Application', price: 25 },
      { id: 'issn_barcode', name: 'Barcode Generation', price: 10 }
    ],
    requirements: [
      { id: 'journal_title', label: 'Journal Title', type: 'text', required: true, placeholder: 'e.g. Journal of Applied Sciences' },
      { id: 'sample_pdf', label: 'Sample Issue PDF', type: 'file', required: true },
      { id: 'editorial_details', label: 'Editorial Board Details', type: 'text', placeholder: 'Names and affiliations' }
    ],
    deliverables: [
      'Approved ISSN Number',
      'ISSN Certificate Copy',
      'Barcode Files'
    ]
  },
  'ojs': {
    id: 'ojs',
    name: 'OJS Setup & Management',
    basePrice: 200,
    description: 'Complete setup of Open Journal Systems (OJS) for publishing.',
    subItems: [
      { id: 'ojs_install', name: 'Base Installation', price: 100 },
      { id: 'ojs_theme', name: 'Custom Theme Setup', price: 50 },
      { id: 'ojs_config', name: 'Workflow Configuration', price: 50 },
      { id: 'ojs_training', name: 'Team Training Session', price: 75 }
    ],
    requirements: [
      { id: 'has_hosting', label: 'Already have Hosting?', type: 'toggle', required: true },
      { 
        id: 'hosting_url', 
        label: 'Hosting Login URL', 
        type: 'text', 
        dependsOn: { fieldId: 'has_hosting', value: true },
        placeholder: 'https://cpanel.yourdomain.com'
      },
      { 
        id: 'hosting_user', 
        label: 'Hosting Username', 
        type: 'text', 
        dependsOn: { fieldId: 'has_hosting', value: true } 
      },
      { id: 'journal_logo', label: 'Journal Logo', type: 'file' }
    ],
    deliverables: [
      'Fully Configured OJS Site',
      'Admin Credentials',
      'Setup Documentation'
    ]
  },
  'doi': {
    id: 'doi',
    name: 'DOI Registration',
    basePrice: 150,
    description: 'Digital Object Identifier registration for articles.',
    subItems: [
      { id: 'doi_prefix', name: 'DOI Prefix Setup', price: 100 },
      { id: 'doi_minting', name: 'Article Minting (Batch)', price: 50 },
      { id: 'doi_crossref', name: 'CrossRef Membership Setup', price: 50 }
    ],
    requirements: [
      { id: 'legal_info', label: 'Publisher Legal Info', type: 'text', required: true },
      { id: 'metadata_file', label: 'Article Metadata (XML/CSV)', type: 'file', required: true },
      { id: 'journal_url', label: 'Journal Website URL', type: 'text', placeholder: 'https://' }
    ],
    deliverables: [
      'DOI Prefix',
      'Assigned DOI Links',
      'CrossRef Active Status'
    ]
  },
  'domain': {
    id: 'domain',
    name: 'Domain Registration',
    basePrice: 15,
    description: 'Register a new domain name.',
    subItems: [
      { id: 'domain_com', name: '.com Registration (1 Year)', price: 15 },
      { id: 'domain_org', name: '.org Registration (1 Year)', price: 20 },
      { id: 'domain_net', name: '.net Registration (1 Year)', price: 18 },
      { id: 'domain_privacy', name: 'WHOIS Privacy Protection', price: 5 }
    ],
    requirements: [
      { id: 'domain_name', label: 'Preferred Domain Name', type: 'text', required: true, placeholder: 'myjournal.com' },
      { id: 'registrant_info', label: 'Registrant Contact Details', type: 'text', required: true }
    ],
    deliverables: [
      'Domain Registered with Full Control',
      'DNS Management Access'
    ]
  },
  'hosting': {
    id: 'hosting',
    name: 'Web Hosting',
    basePrice: 50,
    description: 'Active hosting for your journal website.',
    subItems: [
      { id: 'hosting_shared', name: 'Shared Hosting (Annual)', price: 50 },
      { id: 'hosting_vps', name: 'VPS Hosting (Annual)', price: 150 },
      { id: 'hosting_ssl', name: 'SSL Certificate (Premium)', price: 20 },
      { id: 'hosting_backup', name: 'Daily Backup Service', price: 15 }
    ],
    requirements: [
      { id: 'traffic_estimate', label: 'Estimated Monthly Traffic', type: 'number', placeholder: 'e.g. 5000' },
      { id: 'storage_gb', label: 'Storage Requirement (GB)', type: 'number', placeholder: 'e.g. 10' },
      { id: 'content_size', label: 'Existing Content Size (MB)', type: 'number' }
    ],
    deliverables: [
      'Active Hosting Plan',
      'Control Panel (cPanel/Plesk) Details',
      'Active SSL Certificate'
    ]
  },
  'hec_doaj': {
    id: 'hec_doaj',
    name: 'HEC / DOAJ Application',
    basePrice: 300,
    description: 'Professional application support for HEC & DOAJ indexing.',
    subItems: [
      { id: 'hec_app', name: 'HEC Recognition Support', price: 150 },
      { id: 'doaj_app', name: 'DOAJ Indexing Support', price: 150 },
      { id: 'policy_drafting', name: 'Policy Drafting (Ethics/Archive)', price: 100 }
    ],
    requirements: [
      { id: 'draft_policies', label: 'Journal Policies (Drafts)', type: 'file' },
      { id: 'editorial_list', label: 'Editorial Board List (Verified)', type: 'text' },
      { id: 'archive_links', label: 'Archive Links', type: 'text' }
    ],
    deliverables: [
      'Completed Application Submission',
      'Application Reference IDs',
      'Review Feedback Report'
    ]
  }
};
