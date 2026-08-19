import { 
  Globe, 
  FileText, 
  Hash, 
  Award, 
  Database, 
  Server, 
  Settings,
  ShieldCheck,
  Cloud,
  Layers
} from 'lucide-react';

export interface DynamicFormField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'radio' | 'file' | 'textarea' | 'number';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  condition?: (data: any) => boolean;
}

export interface ServiceDefinition {
  id: string;
  label: string;
  icon: any;
  description: string;
  fields: {
    subscribe: DynamicFormField[];
    alreadyHave: DynamicFormField[];
  };
}

export const SERVICE_REQUEST_CONFIG: ServiceDefinition[] = [
  {
    id: 'domain',
    label: 'Domain Registration',
    icon: Globe,
    description: 'Register a new domain or manage your existing one',
    fields: {
      subscribe: [
        { id: 'journalName', label: 'Name of Journal', type: 'textarea', placeholder: 'Enter the full name of your academic journal...', required: true },
        { id: 'preferredDomain1', label: '1st Preferred Domain Name', type: 'text', placeholder: 'e.g. first-preference.com', required: true },
        { id: 'preferredDomain2', label: '2nd Preferred Domain Name', type: 'text', placeholder: 'e.g. second-preference.org (optional)' },
        { id: 'preferredDomain3', label: '3rd Preferred Domain Name', type: 'text', placeholder: 'e.g. third-preference.net (optional)' },
        { id: 'preferredDomain4', label: '4th Preferred Domain Name', type: 'text', placeholder: 'e.g. fourth-preference.biz (optional)' },
        { id: 'tld', label: 'Preferred TLD', type: 'select', options: ['.com', '.org', '.net', '.edu.pk', '.org.pk', '.biz', '.edu', '.ac', '.ac.uk', '.ac.in'], required: true }
      ],
      alreadyHave: [
        { id: 'journalName', label: 'Name of Journal', type: 'textarea', placeholder: 'Enter the full name of your academic journal...', required: true },
        { id: 'domainNameSelection', label: 'Domain Name', type: 'text', placeholder: 'Select from list or enter new...', required: true },
        { id: 'registrarSelection', label: 'Registrar', type: 'text', placeholder: 'Select or add registrar...', required: true },
        { id: 'registrationDate', label: 'Domain Registration Date', type: 'text', placeholder: 'e.g. YYYY-MM-DD' },
        { id: 'dns', label: 'Current DNS (Nameservers)', type: 'textarea', placeholder: 'e.g. ns1.nameservers.com\nns2.nameservers.com' },
        { id: 'password', label: 'Domain Panel Login Password', type: 'text', placeholder: 'Enter domain panel login password' }
      ]
    }
  },
  {
    id: 'ojs',
    label: 'OJS Setup',
    icon: FileText,
    description: 'Open Journal Systems installation and configuration',
    fields: {
      subscribe: [
        { id: 'journalName', label: 'Journal Name', type: 'text', required: true },
        { id: 'websiteUrl', label: 'Existing Website URL (if any)', type: 'text' },
        { id: 'hostingAvailable', label: 'Hosting Available?', type: 'radio', options: ['Yes', 'No'], required: true },
        { id: 'domainLinked', label: 'Domain Linked?', type: 'radio', options: ['Yes', 'No'], required: true },
        { id: 'adminEmail', label: 'Admin Email', type: 'text', required: true },
        { id: 'serviceType', label: 'Required Action', type: 'select', options: ['New Installation', 'Migration', 'Upgrade'], required: true }
      ],
      alreadyHave: [
        { id: 'ojsUrl', label: 'OJS URL', type: 'text', required: true },
        { id: 'version', label: 'OJS Version', type: 'text' },
        { id: 'adminCredentials', label: 'Admin Credentials', type: 'textarea', required: true }
      ]
    }
  },
  {
    id: 'issn',
    label: 'ISSN Registration',
    icon: Hash,
    description: 'International Standard Serial Number registration',
    fields: {
      subscribe: [
        { id: 'journalTitle', label: 'Journal Title', type: 'text', required: true },
        { id: 'publisherName', label: 'Publisher Name', type: 'text', required: true },
        { id: 'country', label: 'Country', type: 'text', required: true },
        { id: 'websiteUrl', label: 'Website URL', type: 'text', required: true },
        { id: 'alreadyApplied', label: 'Already Applied?', type: 'radio', options: ['Yes', 'No'], required: true },
        { id: 'documents', label: 'Upload Required Documents (PDF)', type: 'file', required: true }
      ],
      alreadyHave: [
        { id: 'issnPrint', label: 'ISSN (Print)', type: 'text' },
        { id: 'issnOnline', label: 'ISSN (Online)', type: 'text' },
        { id: 'issnLogin', label: 'ISSN Portal Login Email / Username', type: 'text', placeholder: 'Enter ISSN portal username', required: true },
        { id: 'issnPassword', label: 'ISSN Portal Password', type: 'text', placeholder: 'Enter ISSN portal password', required: true },
        { id: 'issnCertificate', label: 'Upload Certificate', type: 'file' }
      ]
    }
  },
  {
    id: 'hec',
    label: 'HEC Recognition',
    icon: Award,
    description: 'Higher Education Commission (Pakistan) journal recognition',
    fields: {
      subscribe: [
        { id: 'journalName', label: 'Journal Name', type: 'text', required: true },
        { id: 'issn', label: 'ISSN Number', type: 'text', required: true },
        { id: 'ojsUrl', label: 'OJS URL', type: 'text', required: true },
        { id: 'currentCategory', label: 'Current HEC Category (if any)', type: 'select', options: ['None', 'W', 'X', 'Y', 'Z'], required: true },
        { id: 'requiredCategory', label: 'Required Category', type: 'select', options: ['W', 'X', 'Y'], required: true }
      ],
      alreadyHave: [
        { id: 'hecCategory', label: 'Current Recognized Category', type: 'select', options: ['W', 'X', 'Y', 'Z'], required: true },
        { id: 'lastReviewDate', label: 'Last Review Date', type: 'text' }
      ]
    }
  },
  {
    id: 'doi',
    label: 'DOI Registration (CrossRef)',
    icon: Database,
    description: 'Permanent identifiers for your articles',
    fields: {
      subscribe: [
        { id: 'publisherName', label: 'Publisher Name', type: 'text', placeholder: 'Enter Publisher Name', required: true },
        { id: 'publisherAddress', label: 'Publisher Address', type: 'text', placeholder: 'Enter Publisher Address', required: true },
        { id: 'editorialMember1', label: 'Editorial team Name Affiliation, Email (Add at least 5 members)', type: 'text', placeholder: 'e.g. Dr. John Doe, Oxford University, john@oxford.edu', required: true },
        { id: 'editorialMember2', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Jane Smith, Harvard University, jane@harvard.edu', required: true },
        { id: 'editorialMember3', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Robert Lee, Stanford University, robert@stanford.edu', required: true },
        { id: 'editorialMember4', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Alice Johnson, MIT, alice@mit.edu', required: true },
        { id: 'editorialMember5', label: 'Editorial team Name Affiliation, Email', type: 'text', placeholder: 'e.g. Dr. Michael Brown, Cambridge, michael@cambridge.edu', required: true }
      ],
      alreadyHave: [
        { id: 'crossrefEmail', label: 'Crossref Email', type: 'text', placeholder: 'Enter Crossref login email', required: true },
        { id: 'crossrefPassword', label: 'Crossref Password', type: 'text', placeholder: 'Enter Crossref account password', required: true }
      ]
    }
  },
  {
    id: 'hosting',
    label: 'Managed Hosting',
    icon: Server,
    description: 'High-speed hosting with SSL',
    fields: {
      subscribe: [
        { 
          id: 'hostingPreference', 
          label: 'Hosting Preference', 
          type: 'radio', 
          options: [
            'Unlimited Shared OJS Hosting (50USD/Annual/Domain)', 
            'Dedicated Cloud Server OJS Hosting (150USD/Annual/Domain)',
            'Upgrade Existing Shared Hosting to Cloud Hosting (100USD/Annual/Domain)'
          ], 
          required: true 
        }
      ],
      alreadyHave: [
        { id: 'hostingServerSelection', label: 'Add/Select Hosting Server', type: 'text', placeholder: 'Select from list or type custom...', required: true },
        { id: 'startDate', label: 'Start Date', type: 'text', placeholder: 'e.g. YYYY-MM-DD', required: true },
        { id: 'expiry', label: 'Expiry', type: 'text', placeholder: 'e.g. YYYY-MM-DD', required: true },
        { id: 'hostingPassword', label: 'Hosting Login Password', type: 'text', placeholder: 'Enter hosting panel password', required: true }
      ]
    }
  },
  {
    id: 'other',
    label: 'Other Services',
    icon: Layers,
    description: 'Custom requirements and additional services',
    fields: {
      subscribe: [
        { id: 'serviceDescription', label: 'Describe Your Requirement', type: 'textarea', required: true },
        { id: 'budget', label: 'Estimated Budget', type: 'text' }
      ],
      alreadyHave: []
    }
  }
];
