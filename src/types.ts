export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Client';
export type ClientStatus = 'active' | 'inactive';
export type DomainStatus = 'active' | 'expiring_soon' | 'expired';
export type JournalStatus = 'complete' | 'pending_issn';
export type IndexingStatus = 'not_indexed' | 'applied' | 'pending' | 'indexed';

export interface IndexingAgency {
  id: string;
  name: string;
  logoUrl: string;
  searchLink: string;
  submissionLink: string;
  country: string;
  responseTime: string;
  createdAt: string;
}

export interface JournalIndexing {
  id: string;
  journalId: string;
  agencyId: string;
  status: IndexingStatus;
  journalPageUrl?: string;
  appliedAt?: string;
  indexedAt?: string;
  notes?: string;
  lastStatus?: IndexingStatus;
  lastJournalPageUrl?: string | null;
  lastIndexedAt?: any;
  lastAppliedAt?: string | null;
}
export type ISSNStatus = 'pending' | 'approved' | 'rejected' | 'Not Applied' | 'Payment Pending' | 'Draft';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue' | 'rework' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceType = 
  | 'Hosting' 
  | 'DOI' 
  | 'ISSN' 
  | 'OJS' 
  | 'Editorial' 
  | 'Indexing' 
  | 'Publisher' 
  | 'Domain' 
  | 'Domain (External)'
  | 'Hosting (External)'
  | 'Catalog Service'
  | 'Marketing'
  | 'Call for Papers'
  | 'Editorial Setup'
  | 'Reviewer Recruitment'
  | 'HEC Indexing'
  | 'DOAJ Indexing'
  | 'Scopus Indexing'
  | 'Journal Evaluation'
  | 'Impact Factor'
  | 'Site Score';

export type ServiceStatus = 'Not Started' | 'In Progress' | 'Waiting for Client' | 'Submitted' | 'Approved' | 'Delivered' | 'On Hold' | 'Cancelled';

export interface WorkflowTaskTemplate {
  id: string;
  name: string;
  description: string;
  assignedRole: UserRole;
  basePoints: number;
  complexityMultiplier: number;
  estimatedDays: number;
  dependencyTaskIds?: string[];
}

export interface WorkflowStage {
  id: string;
  name: string;
  orderIndex: number;
  tasks: WorkflowTaskTemplate[];
}

export interface WorkflowTemplate extends AuditFields {
  id: string;
  serviceId: string; // CatalogItem ID
  serviceName: string;
  name: string;
  stages: WorkflowStage[];
  isActive: boolean;
}

export type PricingPlan = 'Slow' | 'Normal' | 'Fast';

export interface PricingTier {
  plan: PricingPlan;
  multiplier: number;
  price: number;
  estimatedDays: number;
  priority: TaskPriority;
}

export type UniquenessRule = 'None' | 'Global' | 'Service' | 'Client';

export interface CatalogRequirement {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'file' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  uniquenessRule: UniquenessRule;
  isTemporary: boolean; // Not saved to core entity, only for workflow progress
  linkedField?: string; // e.g. "journals.issnPrint", "domains.domainName"
  options?: string[]; // For 'select' type
  description?: string;
  placeholder?: string;
  validationRegex?: string;
  value?: any; // To store the filled value
  status?: 'Pending' | 'Received' | 'Rejected' | 'completed' | 'pending';
  validationStatus?: 'valid' | 'invalid' | 'pending';
  comments?: string;
  fileUrl?: string;
}

export interface CatalogItem extends AuditFields {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  pricingTiers: PricingTier[];
  requirements: CatalogRequirement[];
  isActive: boolean;
  icon?: string;
}

export interface Order extends AuditFields {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  catalogItemId: string;
  catalogItemName: string;
  requirementsData: { [requirementId: string]: CatalogRequirement };
  deliverablesData: { [key: string]: any };
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  serviceStatus: ServiceStatus;
  progressPercentage: number;
  currentStep?: string;
  slaDeadline?: string;
  delayReason?: 'Client' | 'Internal' | 'External';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  pricingTier: PricingPlan;
  multiplier: number;
  basePrice: number;
  priority: TaskPriority | 'Standard' | 'Rush' | 'Express';
  totalAmount: number;
  paidAmount: number;
  currency: 'USD' | 'PKR';
  amountUSD: number;
  amountPKR: number;
  usdPkrRate: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  completedAt?: string;
  notes?: string;
  costPrice?: number;
  profit?: number;
}

export interface PointHistory {
  id: string;
  userId: string; // Can be client or employee
  userName: string;
  type: 'earned' | 'spent' | 'adjustment' | 'withdrawn' | 'recharged';
  points: number;
  reason: string;
  orderId?: string;
  taskId?: string;
  createdAt: string;
  createdById: string;
  createdBy: string;
  metadata?: any;
}

export interface ProfileUpdateRequest extends AuditFields {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  changes: {
    [field: string]: {
      oldValue: any;
      newValue: any;
    }
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: any;
  rejectionReason?: string;
}

export interface AuditFields {
  createdBy?: string;
  createdById?: string;
  createdAt: string;
  updatedBy?: string;
  updatedById?: string;
  updatedAt?: string;
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedById?: string;
  verifiedAt?: string;
}

export interface UserServiceSubscriptions {
  ojs?: boolean;
  issn?: boolean;
  hec?: boolean;
  doi?: boolean;
}

export interface Subscription {
  service: ServiceType;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  domainId?: string;
  domainName?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  subscriptionType?: 'one-time' | 'annual' | 'monthly';
  isManaged?: boolean; // "Subscribed with Us" toggle
  autoGeneratedInvoiceId?: string;
}

export interface DomainRegistrar extends AuditFields {
  id: string;
  name: string;
  url?: string;
  link?: string;
  email?: string;
  username?: string;
  password?: string;
  notes?: string;
}

export interface HostingAccount extends AuditFields {
  id: string;
  name: string;
  link?: string;
  email?: string;
  username?: string;
  password?: string;
  ip?: string;
  provider?: string;
  panelUrl?: string;
  notes?: string;
}

export interface Client {
  id: string;
  salutation?: string;
  name: string;
  careOf?: string;
  email: string;
  phone: string;
  address: string;
  country?: string;
  endingDate?: string;
  status: ClientStatus;
  points: number;
  totalEarnedPoints?: number;
  totalWithdrawnPoints?: number;
  photoURL?: string;
  subscriptions: Subscription[];
  serviceSubscriptions?: UserServiceSubscriptions;
  createdAt: any;
  portalEnabled?: boolean;
  isActive?: boolean;
  isHidden?: boolean;
}

export interface OwnershipHistory {
  id: string;
  clientId: string;
  clientName: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface RegistrarHistory {
  id: string;
  registrarName: string;
  date: string;
  notes?: string;
}

export interface HostingMigrationLog {
  id: string;
  date: string;
  fromServer?: string;
  toServer?: string;
  fromNS?: string[];
  toNS?: string[];
  notes?: string;
}

export interface JournalTransferRecord {
  id: string;
  oldClientId: string;
  oldClientName: string;
  newClientId: string;
  newClientName: string;
  date: string;
  notes?: string;
}

export interface DomainTransferRequest {
  id: string;
  clientId: string;
  clientName?: string;
  domainName: string;
  type: 'Transfer In' | 'Transfer Out';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  eppCode?: string;
  createdAt: string;
}

export interface DomainRenewal {
  id: string;
  date: string;
  costPrice: number;
  salePrice: number;
  expiryDate: string;
  notes?: string;
}

export interface Domain extends AuditFields {
  id: string;
  clientId: string;
  publisherId?: string;
  clientName?: string;
  domainName: string;
  registrar: string;
  registrarId?: string; // Link to DomainRegistrar
  hostingProvider?: string;
  status: DomainStatus;
  expirationDate: string;
  registrationDate?: string;
  costPrice?: number;
  salePrice?: number;
  eppCode?: string;
  registrarCredentials?: {
    username?: string;
    password?: string;
  };
  hostingCredentials?: {
    panelUrl?: string;
    username?: string;
    password?: string;
  };
  registrarHistory?: RegistrarHistory[];
  hostingHistory?: HostingMigrationLog[];
  ownershipHistory?: OwnershipHistory[];
  renewalHistory?: DomainRenewal[];
  registrationSource?: 'System' | 'External';
  isSubscribed?: boolean; // Legacy
  isDomainSubscribedFromUs?: boolean;
  isHostingSubscribedFromUs?: boolean;
  emails?: EmailCredential[];
  domainType?: 'Primary Domain' | 'Addon Domain' | 'Subdomain' | 'Parked Domain';
  parentDomainId?: string;
  hostingAccount?: string;
  hostingAccountId?: string;
  hostingStartDate?: string;
  hostingEndDate?: string;
}

export interface EmailCredential {
  id: string;
  email: string;
  username?: string;
  password?: string;
  loginLink?: string; // backwards compatibility
  webmailLink?: string;
  label?: string; // e.g. "Editor Email", "Support Email"
}

export interface JournalHealthScore {
  totalScore: number; // 0-100
  components: {
    issn: boolean;
    doi: boolean;
    ojs: boolean;
    indexed: boolean;
    security: boolean;
  };
  suggestions: string[];
}

export interface Journal extends AuditFields {
  id: string;
  clientId: string;
  publisherId?: string;
  domainId?: string;
  issnId?: string;
  doiId?: string;
  clientName?: string;
  title: string;
  abbreviation?: string;
  initials?: string;
  url?: string;
  ojsVersion?: string;
  sslStatus?: 'Active' | 'Expired' | 'Pending' | 'None';
  issnPrint?: string;
  issnOnline?: string;
  invoiceNumber?: string;
  status: JournalStatus;
  lifecycleStatus: JournalWorkflowStatus;
  lifecycleHistory: JournalLifecycleEvent[];
  chiefEditorName?: string;
  contactPersonName?: string;
  transferHistory?: JournalTransferRecord[];
  
  // New metadata fields
  category?: string;
  subCategory?: string;
  scope?: string[];
  apcAmount?: number;
  editorEmail?: string;
  useForCfp?: boolean;
  cfpDiscipline?: string;
  cfpDeadline?: string;
  editorialBoardMembers?: string[];
  googleScholarStatus?: string;
  
  // Enhanced metadata fields
  subjectCategory?: string;
  publisherCountry?: string;
  languages?: string;
  license?: 'CC BY' | 'CC BY-SA' | 'CC BY-ND' | 'CC BY-NC' | 'CC BY-NC-SA' | 'CC BY-NC-ND' | 'CC0' | 'Public Domain' | 'Publisher’s Own License';
  
  // HEC Managed Categories
  hecMainCategoryId?: string;
  hecSubCategoryId?: string;
  hecSubjectCategoryId?: string;
  
  // Credentials
  credentials?: EmailCredential[];
  
  // Health
  healthScore?: JournalHealthScore;

  // Assignment
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  isSubscribed?: boolean; // Legacy
  isOjsSubscribedFromUs?: boolean;
  isIssnSubscribedFromUs?: boolean;
  isHecSubscribedFromUs?: boolean;
  isDoiSubscribedFromUs?: boolean;

  // Dynamic Tabs and Managed Details
  subscribed_services?: string[]; // ['ISSN', 'HEC', 'DOAJ', 'Indexing', 'OJS']
  active_tabs?: string[];
  
  issn_details?: ISSNJournalDetails;
  hec_details?: HECJournalDetails;
  applied_details?: AppliedServiceDetails[];
  doaj_details?: DOAJJournalDetails;
  indexing_details?: IndexingJournalDetails;
  ojs_details?: OJSJournalDetails;
  domain_details?: {
    domainName?: string;
    registrar?: string;
    expirationDate?: string;
    nameservers?: string;
    autoRenew?: boolean;
    annualCost?: number;
    notes?: string;
  };
  hosting_details?: {
    provider?: string;
    ipAddress?: string;
    serverSpecs?: string;
    status?: string;
    renewalDate?: string;
    annualCost?: number;
    controlPanelUrl?: string;
    notes?: string;
  };
  
  // Secure Credential Vault IDs
  credentialVaultIds?: string[];

  // Managed Subscription Metadata
  is_subscribed_with_us?: boolean;
  subscription_id?: string;
  workflow_stage_id?: string;
  active_invoice_id?: string;
  subscription_source?: 'Journal' | 'Manual';
  costPrice?: number;
  salePrice?: number;
  profit?: number;
}

export interface GoogleScholarHistory {
  id: string;
  journalId: string;
  status: 'Indexed' | 'Not Indexed';
  date: string;
  lastAction: string;
  resultsAdded: string;
  createdAt: string;
}

export interface ISSNRequest extends AuditFields {
  id: string;
  clientId: string;
  journalId: string;
  clientName?: string;
  journalTitle?: string;
  requestNo: string;
  requestType: string;
  printIssn?: string;
  onlineIssn?: string;
  existingPrintIssn?: string;
  existingOnlineIssn?: string;
  issnLogin?: string;
  issnPassword?: string;
  issnLoginPassword?: string;
  alreadyHaveDetails?: boolean;
  journalUrl?: string;
  publisherName?: string;
  publisherAddress?: string;
  frequency?: string;
  contactName?: string;
  emailAddress?: string;
  paymentAmountPkr?: number;
  sentDate?: string;
  modifiedDate?: string;
  legacyInvoiceNumber?: string;
  language?: string;
  subject?: string;
  country?: string;
  issn?: string;
  type?: string;
  status: ISSNStatus;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  createdAt: string;
}

export interface SubTask {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  visibility: 'all' | 'client' | 'employee' | 'admin';
}

export interface Task {
  id: string;
  clientId: string;
  clientName?: string;
  journalId?: string;
  journalTitle?: string;
  domainId?: string;
  domainName?: string;
  linkedOrderId?: string;
  linkedServiceId?: string;
  serviceType: ServiceType | 'Catalog Service';
  title: string;
  description?: string;
  assignedTo: string; // User ID (Employee)
  assignedToName?: string;
  assignedRole?: UserRole;
  department?: 'Technical' | 'Accounts' | 'Editorial' | 'General';
  status: TaskStatus;
  priority: TaskPriority;
  points: number;
  order?: number;
  taskCost?: number; // Cost / expense incurred to complete task (-)
  
  // Points & Performance
  basePoints: number;
  complexityMultiplier: number;
  urgencyBonus: number;
  delayPenalty: number;
  reworkPenalty: number;
  qualityScore?: number; // 0-100 from reviewer
  finalPoints?: number;

  dueDate: string;
  deadline: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // High-precision time tracking
  estimatedTimeMinutes?: number;
  actualTimeMinutes?: number;
  expectedCompletionDate?: string;
  timeLogs?: {
    action: 'start' | 'pause' | 'resume' | 'complete';
    timestamp: string;
    userId: string;
    userName: string;
  }[];
  
  attachments?: string[];
  reviewerId?: string;
  reviewerName?: string;
  activityLogs: {
    text: string;
    userId: string;
    userName: string;
    timestamp: string;
  }[];

  isClientVisible: boolean;
  comments?: TaskComment[];
  dependencies?: string[]; // IDs of tasks that must be completed first
  price?: number;
  subTasks?: SubTask[];
}

export interface ServiceSubItem {
  id: string;
  name: string;
  price: number;
}

export interface ServiceRequirementField {
  id: string;
  label: string;
  type: 'text' | 'file' | 'select' | 'number' | 'toggle';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  dependsOn?: {
    fieldId: string;
    value: any;
  };
}

export interface ServiceTemplate {
  id: string;
  name: string;
  basePrice: number;
  description: string;
  subItems: ServiceSubItem[];
  requirements: ServiceRequirementField[];
  deliverables: string[];
}

export interface WorkflowSubTask {
  id: string;
  name: string;
  description: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  price: number;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Waiting for Client';
  updatedAt: string;
  deliverableUrl?: string;
}

export interface WorkflowMainTask {
  id: string;
  title: string;
  serviceId: string;
  clientId: string;
  clientName: string;
  userSelectionMode: 'already_have' | 'need' | 'partial';
  selectedSubItemIds: string[];
  requirements: {
    label: string;
    status: 'Pending' | 'Received' | 'Approved' | 'Rejected';
    fileUrl?: string;
    textValue?: string;
  }[];
  deliverables: {
    label: string;
    status: 'Pending' | 'Delivered';
    fileUrl?: string;
  }[];
  clientInstructions: string;
  employeeInstructions: string;
  subTasks: WorkflowSubTask[];
  status: 'Pending' | 'In Progress' | 'Completed' | 'Waiting for Client';
  deadline: string;
  createdAt: string;
  createdBy: string;
  totalPrice: number;
  progress: number;
  activityLog: {
    timestamp: string;
    user: string;
    action: string;
    details?: string;
  }[];
}

export interface TaskLog {
  id: string;
  taskId: string;
  action: 'created' | 'started' | 'completed' | 'revision' | 'rejected' | 'reassigned';
  by: string; // User ID
  userName: string;
  timestamp: any;
  details?: string;
}

export interface ServiceTaskRun {
  id: string;
  clientServiceId: string;
  executed: boolean;
  lastRun: any;
}

export interface JournalCategory {
  id: string;
  name: string;
  subCategories: string[];
}

export interface OfficeSubscription {
  id: string;
  name: string;
  expiryDate: string;
  cost: number;
  currency: 'USD' | 'PKR';
  status: 'active' | 'expiring' | 'expired';
}

export interface GlobalSettings {
  expenseHeads: string[];
  journalCategories: JournalCategory[];
  issnTypes: string[];
  issnSubjects: string[];
  frequencies: string[];
  departments: string[];
  modes: string[];
  journalScopes?: string[];
  activatableServices?: string[];
  officeSubscriptions?: OfficeSubscription[];
  uniquenessSettings?: {
    clientEmail?: boolean;
    clientPhone?: boolean;
    domainName?: boolean;
    issnNumber?: boolean;
    journalTitle?: boolean;
  };
  pointRate?: number; // Value of 1 point in PKR
  usdPkrRate?: number; // Exchange rate: 1 USD = X PKR
  branding?: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  updatedAt: any;
}

export interface RegistrationRequest extends AuditFields {
  id: string;
  name: string;
  email: string;
  organization: string;
  contactNumber: string;
  requiredServices: ServiceType[];
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface AccessLog {
  id: string;
  email: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'unauthorized' | 'authorized';
}

export interface ModulePermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  upload?: boolean;
  download?: boolean;
  approve?: boolean;
}

export interface UserPermissions {
  clients: ModulePermissions;
  journals: ModulePermissions;
  domains: ModulePermissions;
  issnRequests: ModulePermissions;
  tasks: ModulePermissions;
  invoices: ModulePermissions;
  expenses: ModulePermissions;
  publishers: ModulePermissions;
  hecApplications: ModulePermissions;
  indexingAgencies: ModulePermissions;
  doiManagement: ModulePermissions;
  dataTools: ModulePermissions;
  resources: ModulePermissions;
  notifications: ModulePermissions;
  trash: ModulePermissions;
  approvalRequests: ModulePermissions;
  settings: ModulePermissions;
  employees: ModulePermissions;
  doajApplications: ModulePermissions;
  serviceCatalog: ModulePermissions;
  payroll: ModulePermissions;
  accessLogs: ModulePermissions;
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  type?: 'one-time' | 'recurring';
}

export interface ServiceWorkflowConfig {
  autoGenerateInvoice: boolean;
  upfrontPaymentPercentage: number;
  generateTasksOnActivation: boolean;
  enableCommissions: boolean;
  employeeCommissionPercentage: number;
}

export interface ServiceStep {
  id: string;
  name: string;
  description: string;
  clientChecklist: CatalogRequirement[];
  employeeTasks: EmployeeTaskTemplate[];
  orderIndex: number;
}

export interface ServiceTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'PKR';
  steps?: ServiceStep[];
  options: ServiceOption[];
  employeeSharePercentage: number;
  clientChecklist: CatalogRequirement[];
  employeeChecklist: EmployeeTaskTemplate[];
  workflowConfig: ServiceWorkflowConfig;
}


export interface JournalLifecycleEvent {
  id: string;
  fromStatus: string;
  toStatus: string;
  timestamp: string;
  triggeredBy: string;
  triggeredById: string;
  notes?: string;
}

export type JournalWorkflowStatus = 
  | 'Draft' 
  | 'Submission' 
  | 'Review' 
  | 'Revision' 
  | 'Accepted' 
  | 'Copyediting' 
  | 'Production' 
  | 'Published' 
  | 'Archived';


export interface EmployeeTaskTemplate {
  id: string;
  label: string;
  department: 'Technical' | 'Accounts' | 'Editorial' | 'General';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  daysToComplete: number;
  assignedRole: UserRole;
  points: number;
  order: number;
}

export interface ServiceDefinition extends AuditFields {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  tiers: ServiceTier[];
  isActive: boolean;
}

export interface ClientService extends AuditFields {
  id: string;
  clientId: string;
  clientName: string;
  journalId?: string;
  serviceId: string;
  serviceName: string;
  tierId: string;
  tierName: string;
  selectedOptions?: string[]; // IDs of selected options
  status: 'Ordered' | 'In Progress' | 'Completed' | 'Pending Payment' | 'On Hold';
  currentStepIndex: number;
  progress: number;
  stepProgress: {
    [stepId: string]: {
      status: 'pending' | 'in_progress' | 'completed';
      clientChecklist: {
        [checklistId: string]: {
          status: 'pending' | 'completed';
          value?: string;
          fileUrl?: string;
          updatedAt: string;
        }
      };
      employeeTasks: {
        [taskId: string]: {
          status: 'pending' | 'completed' | 'revision';
          notes?: string;
          proofUrl?: string;
          updatedAt: string;
        }
      };
      completedAt?: string;
    }
  };
  clientChecklistProgress: { [key: string]: any };
  employeeTaskIds: string[];
  invoiceId?: string;
  isActivated: boolean;
  totalAmount: number;
  employeeEarnings: number;
  companyProfit: number;
  currency: 'USD' | 'PKR';
  workflowHistory: {
    action: string;
    timestamp: string;
    user: string;
    details: string;
  }[];
}

export interface Commission extends AuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  currency: 'USD' | 'PKR';
  sourceType: 'service' | 'referral' | 'other';
  sourceId: string; // ClientService ID or Order ID
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  notes?: string;
}

export interface EmploymentPeriod {
  id: string;
  employeeId: string;
  joinDate: string;
  leaveDate: string | null;
  status: 'Active' | 'Closed';
  reason: 'First Join' | 'Rejoined' | 'Resigned' | 'Terminated' | 'Contract End';
  notes?: string;
  createdAt: any;
}

export interface EmployeePerformance {
  totalTasksCompleted: number;
  onTimeCompletionRate: number;
  averageTaskTimeDays: number;
  monthlyLeaderboardRank?: number;
  qualityAverage: number;
  reworkRate: number;
}

export interface PayrollRecord extends AuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  month: number; // 0-11
  year: number;
  pointsEarned: number;
  pointsValue: number; // pointsEarned * pointRate
  baseSalary: number;
  grossSalary: number; // max(pointsValue, baseSalary)
  bonus?: number;
  deductions?: number;
  netSalary: number; // gross + bonus - deductions
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
}

export interface SalaryPayment extends AuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  payrollId?: string; // Optional if it's a general advance
  amount: number;
  amountUSD: number;
  amountPKR: number;
  usdPkrRate: number;
  currency: 'USD' | 'PKR';
  date: string;
  type: 'salary' | 'advance' | 'bonus' | 'commission';
  method: 'Bank Transfer' | 'Cash' | 'Online' | 'Cheque';
  reference?: string;
  notes?: string;
}

export interface DashboardCardConfig {
  id: string;
  isVisible: boolean;
  order: number;
}

export interface User {
  id: string;
  uid?: string;
  salutation?: string;
  name: string;
  email: string;
  role: UserRole;
  points: number;
  totalEarnedPoints?: number;
  totalWithdrawnPoints?: number;
  photoURL?: string;
  phone?: string;
  address?: string;
  status?: ClientStatus;
  subscriptions?: Subscription[];
  serviceSubscriptions?: UserServiceSubscriptions;
  createdAt: any;
  updatedAt?: any;
  columnPreferences?: {
    [tabId: string]: string[];
  };
  dashboardConfig?: DashboardCardConfig[];
  // DOI specific preferences
  doiColumnPreferences?: string[];
  // Employee specific fields
  employeeId?: string;
  joiningDate?: string;
  modeOfWorking?: string;
  department?: string;
  assignments?: string;
  officialMail?: string;
  personalEmail?: string;
  cnic?: string;
  permissions?: UserPermissions;
  performance?: EmployeePerformance;
  whatsappPersonal?: string;
  homePhone?: string;
  qualification?: string;
  gender?: 'Male' | 'Female' | 'Other';
  remarks?: string;
  endingDate?: string;
  experience?: string;
  employmentHistory?: EmploymentPeriod[];
  baseSalary?: number;
  baseSalaryCurrency?: 'USD' | 'PKR';
  officialMailPassword?: string;
  pcAllotted?: string;
  pcUsername?: string;
  pcPassword?: string;
  isOnline?: boolean;
  portalEnabled?: boolean;
  isActive?: boolean;
  isHidden?: boolean;
  timezone?: string;
  attachments?: {
    cv?: string;
    photo?: string;
    cnicScanned?: string;
    otherDocs?: string[];
  };
}

export interface CredentialVaultRecord extends AuditFields {
  id: string;
  journalId?: string;
  domainId?: string;
  label: string;
  vaultType: 'Domain' | 'Hosting' | 'OJS' | 'Email' | 'Other';
  username: string;
  password: string; // Should be handled via encryption service
  loginLink?: string;
  notes?: string;
  accessLogs: {
    userId: string;
    userName: string;
    timestamp: string;
    action: string;
  }[];
}

export interface ISSNJournalDetails {
  printISSN?: string;
  onlineISSN?: string;
  registrationDate?: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  certificateUrl?: string;
}

export interface HECJournalDetails {
  category?: 'X' | 'Y' | 'Z' | 'W';
  recognitionStatus?: string;
  approvalDate?: string;
  expiryDate?: string;
  documents?: string[];
}

export interface HECWorkflowStage {
  stageId: number;
  name: string;
  description: string;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  status: 'Pending' | 'Completed';
  completedAt?: string;
  notes?: string;
}

export interface HECApplicationWorkflow extends AuditFields {
  id: string;
  journalId: string;
  journalTitle: string;
  clientId: string;
  clientName: string;
  currentStage: number; // 1-10
  status: 'Incomplete' | 'Completed';
  stages: HECWorkflowStage[];
  payment: {
    status: 'Paid' | 'Unpaid';
    screenshotUrl?: string;
    psid?: string;
    verifiedAt?: string;
    verifiedBy?: string;
    verifiedById?: string;
    amount?: number;
  };
  loginCredentials?: {
    username: string;
    password: string;
  };
}

export interface AppliedServiceDetails {
  serviceName: string; // ISSN, HEC, DOAJ, etc.
  applicationDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Submitted' | 'In Review';
  notes?: string;
}

export interface DOAJJournalDetails {
  doajId?: string;
  inclusionDate?: string;
  status?: string;
  metadataCompliance?: boolean;
  link?: string;
}

export interface IndexingJournalDetails {
  indexedIn?: string[]; // Scopus, WoS, etc.
  status?: string;
  startYear?: string;
  documents?: string[];
}

export interface OJSJournalDetails {
  url?: string;
  adminUrl?: string;
  version?: string;
  installationDate?: string;
  hostingStatus?: 'Active' | 'Inactive' | 'Pending' | string;
  adminCredentials?: {
    username?: string;
    password?: string;
  };
  supportStatus?: string;
  phpVersion?: string;
  databaseName?: string;
  notes?: string;
}

export interface ClientHistoryEntry {
  clientId: string;
  clientName?: string;
  startDate: string;
  endDate?: string;
  remarks?: string;
}

export interface Publisher {
  id: string;
  clientId: string;
  name: string;
  ownerName: string;
  email?: string;
  phone?: string;
  address?: string;
  secpRegistration: string;
  ntn: string;
  secpLoginUrl?: string;
  loginUsername?: string;
  usernameForPublisher?: string;
  loginPassword?: string;
  documents: {
    aoa?: string;
    moa?: string;
    cnicFront?: string;
    cnicBack?: string;
    ntn?: string;
    secp?: string;
    certificates?: string[];
  };
  createdAt: string;
  clientHistory?: ClientHistoryEntry[];
}

export interface DOAJApplication extends AuditFields {
  id: string;
  invoiceNo: string;
  clientId: string;
  clientName?: string;
  journalName: string;
  journalLink: string;
  submissionDate: string;
  doajLoginEmail: string;
  doajPassword?: string;
  editorEmailLogin: string;
  editorPassword?: string;
  status: 'Pending' | 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected';
  objectionReason?: string;
  objectionDate?: string;
  remarks?: string;
  journalId?: string;
}

export interface HECEntry extends AuditFields {
  id: string;
  journalId: string;
  journalTitle?: string;
  year: number;
  frequency: string;
  loginCredentials: {
    username: string;
    password: string;
  };
  appNo: string;
  psid: string;
  ownerInfo: string;
  discipline: string;
  subjectArea: string;
  subCategory: string;
  status: 'active' | 'expiring' | 'missing' | 'Approved' | 'Rejected' | 'Pending';
  category?: string;
  points?: number;
  fees?: number;
  feesPaid?: number;
  applicationDate?: string;
  expirationDate: string;
}

export interface EmployeeFieldPermission {
  id: string;
  employeeId: string;
  moduleName: string;
  fieldName: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export interface PaymentReceived extends AuditFields {
  id: string;
  clientId?: string;
  clientName?: string;
  journalId?: string;
  journalTitle?: string;
  taskId?: string;
  taskTitle?: string;
  amount: number; // positive (+)
  currency?: 'USD' | 'PKR';
  date: string;
  method?: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'Cheque' | 'Online/Stripe' | 'Adjustment' | 'Other';
  reference?: string;
  category?: 'Subscription' | 'OJS Setup' | 'ISSN' | 'ISSN Application' | 'DOI' | 'DOI Registration' | 'Hosting/Domain' | 'Hosting / Domain' | 'Editorial' | 'Editorial Services' | 'Other Revenue' | 'Other' | string;
  notes?: string;
  recordedBy?: string;
  recordedById?: string;
  status?: 'Cleared' | 'Pending' | 'Refunded';
}

export interface TaskCostRecord extends AuditFields {
  id: string;
  taskId?: string;
  taskTitle?: string;
  clientId?: string;
  clientName?: string;
  journalId?: string;
  journalTitle?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  costAmount: number; // cost (-)
  costDate: string;
  category?: 'Employee Task Fee' | 'OJS Setup' | 'ISSN Application' | 'DOI Registration' | 'Hosting / Domain' | 'Editorial Services' | 'Hosting/Server' | 'Domain Renewal' | 'Indexing Fee' | 'Editorial/Design' | 'Outsourcing' | 'Third-party Vendor' | 'Other' | string;
  notes?: string;
  recordedBy?: string;
  recordedById?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  amountUSD?: number;
  amountPKR?: number;
  usdPkrRate?: number;
  date: string;
  method: 'Bank Transfer' | 'Cash' | 'Online' | 'Cheque' | 'Adjustment';
  currency: 'USD' | 'PKR';
  reference: string;
  notes?: string;
  recordedBy: string;
  recordedById: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number; // percentage
  discountRate: number; // percentage
  taxAmount: number;
  discountAmount: number;
  total: number;
  serviceType?: ServiceType;
  journalId?: string;
  domainId?: string;
  billingType: 'one-time' | 'recurring';
  interval?: 'monthly' | 'quarterly' | 'annually';
  nextRenewalDate?: string;
  isActive?: boolean;
}

export interface RecurringDetails {
  interval: 'monthly' | 'quarterly' | 'annually';
  startDate: string;
  endDate?: string;
  nextGenerationDate: string;
  isActive: boolean;
}

export interface Invoice extends AuditFields {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  issueDate: string;
  dueDate: string;
  date: string; // fallback for issueDate
  currency: 'USD' | 'PKR';
  amountUSD: number;
  amountPKR: number;
  usdPkrRate: number;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  balance: number;
  balanceUSD?: number;
  balancePKR?: number;
  status: InvoiceStatus;
  billingType: 'one-time' | 'recurring';
  recurringDetails?: RecurringDetails;
  notes?: string;
  terms?: string;
  linkedExpenses?: string[]; // IDs of expenses linked to this invoice
  journalId?: string; // If the whole invoice is for one journal
  journalTitle?: string;
  subscription_source?: 'Journal' | 'Manual';
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  clientId: string;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  folderId: string | null;
  clientId: string;
  taskId?: string;
  uploadedBy: string;
  createdAt: string;
}

export interface FileRequest {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'cancelled';
  clientId: string;
  taskId?: string;
  assignedTo: string; // User ID
  assignedRole: 'Client' | 'Employee';
  requestedBy: string; // User ID
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  action: string;
  details: string;
  timestamp: string;
  isRead?: boolean;
  isHidden?: boolean;
}

export interface TrashItem {
  id: string;
  originalCollection: string;
  data: any;
  deletedAt: string;
  deletedBy: string;
}

export interface DOIApplication extends AuditFields {
  id: string;
  clientId: string;
  clientName?: string;
  publisherId: string;
  publisherName?: string;
  journalId: string;
  journalTitle?: string;
  memberName: string;
  doiPrefix: string;
  role: string;
  password?: string;
  ticketNo?: string;
  otherEmails?: string;
  domainName: string; // Strict Rule: 1 Email and 1 Domain per unique Application/Prefix
  contactEmail: string;
  
  // Crossref Metadata
  sponsoringOrgName?: string;
  orgUrl?: string;
  orgPubUrl?: string;
  remarks?: string;
  
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  members?: { name: string; affiliation: string; email: string; phone: string; }[];
}

export interface DOI {
  id: string;
  clientId: string;
  journalId: string;
  publisherId?: string;
  journalName?: string;
  url: string;
  status: 'pending' | 'activated';
  activationDate?: string;
  createdAt: string;
  
  // New fields for DOI Application System
  memberName: string;
  doiPrefix: string;
  role: string;
  password?: string;
  ticketNo?: string;
  otherEmails?: string[];
  domainName: string;
  
  // Crossref Metadata
  sponsoringOrgName?: string;
  sponsoringOrgUrl?: string;
  sponsoringOrgPubUrl?: string;
  remarks?: string;
  members?: { name: string; affiliation: string; email: string; phone: string; }[];
}

export interface DOIPayment {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  screenshotUrl?: string;
  notes?: string;
  createdAt: string;
}

export type HECCategoryType = 'main' | 'sub' | 'subject';

export interface HECCategory extends AuditFields {
  id: string;
  name: string;
  type: HECCategoryType;
  parentId: string | null;
  isActive: boolean;
}

export interface Stat {
  label: string;
  value: string | number;
  change: number;
  icon: string;
}

export interface ChartData {
  name: string;
  submissions?: number;
  revenue?: number;
  clients?: number;
  tasks?: number;
}

export interface Policy {
  id: string;
  title: string;
  content: string;
  category: 'General' | 'Financial' | 'Technical';
  lastUpdated: string;
  updatedBy: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
  type: 'text' | 'order' | 'file';
  orderData?: {
    serviceType: ServiceType;
    amount: number;
    description: string;
  };
  fileData?: string;
}

export interface ChatSession {
  id: string; // Usually the clientId
  clientId: string;
  clientName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  updatedAt: string;
}

export interface Expense extends AuditFields {
  id: string;
  head: string;
  date: string;
  endDate?: string;
  amount: number;
  currency: 'USD' | 'PKR';
  amountUSD: number;
  amountPKR: number;
  usdPkrRate: number;
  taxAmount: number;
  attachmentUrl?: string;
  notes?: string;
  updatedBy: string;
  isRecurring?: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  recurringCustomDays?: number;
  nextDueDate?: string;
}
