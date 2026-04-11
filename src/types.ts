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
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceType = 'Hosting' | 'DOI' | 'ISSN' | 'OJS' | 'Editorial' | 'Indexing' | 'Plagiarism' | 'Domain';

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
  subscriptionType?: 'one-time' | 'annual' | 'monthly';
}

export interface Client {
  id: string;
  salutation?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: ClientStatus;
  points: number;
  subscriptions: Subscription[];
  createdAt: any;
  portalEnabled?: boolean;
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
  fromServer: string;
  toServer: string;
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
  renewalHistory?: DomainRenewal[];
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
  scope?: string;
  apcAmount?: number;
  editorEmail?: string;
  
  // Credentials
  credentials?: {
    email?: string;
    password?: string;
    loginLink?: string;
  };
  
  // Assignment
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
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
  officeSubscriptions?: OfficeSubscription[];
  updatedAt: any;
}

export interface UserPermissions {
  approvalRequests: boolean;
  journals: boolean;
  indexingAgencies: boolean;
  publishers: boolean;
  hecApplications: boolean;
  issnRequests: boolean;
  doiManagement: boolean;
  dataTools: boolean;
  invoices: boolean;
  expenses: boolean;
  resources: boolean;
  notifications: boolean;
  trash: boolean;
}

export interface User {
  id: string;
  salutation?: string;
  name: string;
  email: string;
  role: UserRole;
  points: number;
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

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice extends AuditFields {
  id: string;
  clientId: string;
  clientName?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'paid' | 'unpaid' | 'overdue';
  dueDate: string;
  invoiceNumber?: string;
  journalId?: string;
  journalTitle?: string;
  taskId?: string;
  taskTitle?: string;
  date?: string;
  amount?: number;
  notes?: string;
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
  type: 'text' | 'order';
  orderData?: {
    serviceType: ServiceType;
    amount: number;
    description: string;
  };
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
