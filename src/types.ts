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
}
export type ISSNStatus = 'pending' | 'approved' | 'rejected';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceType = 
  | 'Hosting' 
  | 'DOI' 
  | 'ISSN' 
  | 'OJS' 
  | 'Editorial' 
  | 'Indexing' 
  | 'Plagiarism' 
  | 'Domain' 
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

export interface PricingTier {
  priority: 'Standard' | 'Rush' | 'Express';
  price: number;
  estimatedDays: number;
}

export interface CatalogRequirement {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'file' | 'date' | 'number';
  required: boolean;
  options?: string[]; // For select type
  placeholder?: string;
  value?: any; // To store the filled value
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
  requirementsData: { [requirementId: string]: any };
  deliverablesData: { [key: string]: any };
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  priority: 'Standard' | 'Rush' | 'Express';
  totalAmount: number;
  paidAmount: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  completedAt?: string;
  notes?: string;
}

export interface PointHistory {
  id: string;
  userId: string; // Can be client or employee
  userName: string;
  type: 'earned' | 'spent' | 'adjustment';
  points: number;
  reason: string;
  orderId?: string;
  taskId?: string;
  createdAt: string;
  createdById: string;
  createdBy: string;
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
  photoURL?: string;
  subscriptions: Subscription[];
  createdAt: any;
  portalEnabled?: boolean;
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
  hostingProvider?: string;
  status: DomainStatus;
  expirationDate: string;
  registrationDate?: string;
  costPrice?: number;
  salePrice?: number;
  eppCode?: string;
  hostingCredentials?: {
    panelUrl?: string;
    username?: string;
    password?: string;
  };
  registrarHistory?: RegistrarHistory[];
  hostingHistory?: HostingMigrationLog[];
  ownershipHistory?: OwnershipHistory[];
  renewalHistory?: DomainRenewal[];
  isSubscribed?: boolean; // Legacy
  isDomainSubscribedFromUs?: boolean;
  isHostingSubscribedFromUs?: boolean;
}

export interface Journal extends AuditFields {
  id: string;
  clientId: string;
  publisherId?: string;
  domainId?: string;
  clientName?: string;
  title: string;
  url?: string;
  ojsVersion?: string;
  sslStatus?: 'Active' | 'Expired' | 'Pending' | 'None';
  issnPrint?: string;
  issnOnline?: string;
  invoiceNumber?: string;
  status: JournalStatus;
  chiefEditorName?: string;
  contactPersonName?: string;
  transferHistory?: JournalTransferRecord[];
  
  // New metadata fields
  category?: string;
  subCategory?: string;
  scope?: string[];
  apcAmount?: number;
  editorEmail?: string;
  
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
  credentials?: {
    email?: string;
    password?: string;
    loginLink?: string;
  };
  
  // Assignment
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  isSubscribed?: boolean; // Legacy
  isOjsSubscribedFromUs?: boolean;
  isIssnSubscribedFromUs?: boolean;
  isHecSubscribedFromUs?: boolean;
  isDoiSubscribedFromUs?: boolean;
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
  issnLogin?: string;
  issnPassword?: string;
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
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  clientId: string;
  clientName?: string;
  serviceType: ServiceType;
  title: string;
  description?: string;
  assignedTo: string; // User ID (Employee)
  assignedToName?: string;
  department?: 'Technical' | 'Accounts' | 'Editorial' | 'General';
  status: TaskStatus;
  priority: TaskPriority;
  points: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  isClientVisible: boolean;
  comments?: TaskComment[];
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
  officeSubscriptions?: OfficeSubscription[];
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
}

export interface EmploymentPeriod {
  joiningDate: string;
  endingDate?: string;
  remarks?: string;
}

export interface User {
  id: string;
  uid?: string;
  salutation?: string;
  name: string;
  email: string;
  role: UserRole;
  points: number;
  photoURL?: string;
  phone?: string;
  address?: string;
  status?: ClientStatus;
  subscriptions?: Subscription[];
  createdAt: any;
  updatedAt?: any;
  columnPreferences?: {
    [tabId: string]: string[];
  };
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
  whatsappPersonal?: string;
  homePhone?: string;
  qualification?: string;
  gender?: 'Male' | 'Female' | 'Other';
  remarks?: string;
  endingDate?: string;
  experience?: string;
  employmentHistory?: EmploymentPeriod[];
  officialMailPassword?: string;
  pcAllotted?: string;
  pcUsername?: string;
  pcPassword?: string;
  isOnline?: boolean;
  portalEnabled?: boolean;
  timezone?: string;
  attachments?: {
    cv?: string;
    photo?: string;
    cnicScanned?: string;
    otherDocs?: string[];
  };
}

export interface Publisher {
  id: string;
  clientId: string;
  name: string;
  ownerName: string;
  secpRegistration: string;
  ntn: string;
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
  status: 'active' | 'expiring' | 'missing';
  expirationDate: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  date: string;
  method: 'Bank Transfer' | 'Cash' | 'Online' | 'Cheque' | 'Adjustment';
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
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  balance: number;
  status: InvoiceStatus;
  billingType: 'one-time' | 'recurring';
  recurringDetails?: RecurringDetails;
  notes?: string;
  terms?: string;
  linkedExpenses?: string[]; // IDs of expenses linked to this invoice
  journalId?: string; // If the whole invoice is for one journal
  journalTitle?: string;
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
  action: string;
  details: string;
  timestamp: string;
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
  amount: number;
  currency: 'USD' | 'PKR';
  taxAmount: number;
  attachmentUrl?: string;
  notes?: string;
  updatedBy: string;
  isRecurring?: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly';
}
