export const MODULE_FIELDS = {
  clients: [
    { id: 'name', label: 'Client Name' },
    { id: 'email', label: 'Email Address' },
    { id: 'phone', label: 'Phone Number' },
    { id: 'address', label: 'Physical Address' },
    { id: 'country', label: 'Country' },
    { id: 'status', label: 'Client Status' },
    { id: 'points', label: 'Reward Points' }
  ],
  journals: [
    { id: 'title', label: 'Journal Title' },
    { id: 'url', label: 'Website URL' },
    { id: 'status', label: 'Current Status' },
    { id: 'issnPrint', label: 'Print ISSN' },
    { id: 'issnOnline', label: 'Online ISSN' },
    { id: 'category', label: 'Major Category' },
    { id: 'chiefEditorName', label: 'Chief Editor' },
    { id: 'editorEmail', label: 'Editor Email' }
  ],
  domains: [
    { id: 'domainName', label: 'Domain Name' },
    { id: 'registrar', label: 'Domain Registrar' },
    { id: 'hostingProvider', label: 'Hosting Provider' },
    { id: 'status', label: 'Domain Status' },
    { id: 'expirationDate', label: 'Expiry Date' },
    { id: 'registrarCredentials', label: 'Registrar Login' },
    { id: 'hostingCredentials', label: 'Panel Login' }
  ],
  issn_requests: [
    { id: 'journalTitle', label: 'Journal Title' },
    { id: 'requestNo', label: 'Request Number' },
    { id: 'requestType', label: 'Request Type' },
    { id: 'issnLogin', label: 'ISSN Portal Login' },
    { id: 'issnPassword', label: 'ISSN Portal Password' },
    { id: 'status', label: 'Request Status' }
  ],
  tasks: [
    { id: 'title', label: 'Task Title' },
    { id: 'description', label: 'Task Description' },
    { id: 'priority', label: 'Task Priority' },
    { id: 'status', label: 'Task Status' },
    { id: 'dueDate', label: 'Deadline' },
    { id: 'points', label: 'Task Points' }
  ],
  employees: [
    { id: 'name', label: 'Full Name' },
    { id: 'email', label: 'Work Email' },
    { id: 'role', label: 'User Role' },
    { id: 'department', label: 'Department' },
    { id: 'modeOfWorking', label: 'Working Mode' },
    { id: 'joiningDate', label: 'Date of Joining' },
    { id: 'cnic', label: 'CNIC / ID Number' },
    { id: 'officialMailPassword', label: 'Mail Password' }
  ]
} as const;

export type PermissionModuleName = keyof typeof MODULE_FIELDS;
