import { ServiceType, TaskStatus, TaskPriority, Task } from '../types';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface TaskTemplate {
  title: string;
  description: string;
  department: 'Technical' | 'Accounts' | 'Editorial' | 'General';
  priority: TaskPriority;
  daysToComplete: number;
}

const SERVICE_TASK_TEMPLATES: Record<ServiceType, TaskTemplate[]> = {
  'Hosting': [
    { title: 'Arrange Hosting', description: 'Setup server and hosting environment.', department: 'Technical', priority: 'high', daysToComplete: 2 },
    { title: 'Record Hosting Details', description: 'Enter panel URL, username, and password in CRM.', department: 'Technical', priority: 'medium', daysToComplete: 3 }
  ],
  'DOI': [
    { title: 'Register DOI', description: 'Apply for DOI prefix and setup registration.', department: 'Technical', priority: 'high', daysToComplete: 5 }
  ],
  'ISSN': [
    { title: 'Prepare Journal for ISSN', description: 'Review journal metadata and policies for ISSN application.', department: 'Editorial', priority: 'high', daysToComplete: 7 },
    { title: 'Submit ISSN Request', description: 'Submit official request to ISSN portal.', department: 'Editorial', priority: 'medium', daysToComplete: 10 }
  ],
  'OJS': [
    { title: 'Install OJS', description: 'Install and configure Open Journal Systems.', department: 'Technical', priority: 'high', daysToComplete: 3 },
    { title: 'Setup OJS Roles', description: 'Configure manager and editor accounts.', department: 'Technical', priority: 'medium', daysToComplete: 4 }
  ],
  'Editorial': [
    { title: 'Arrange Articles', description: 'Collect and organize articles for the next issue.', department: 'Editorial', priority: 'medium', daysToComplete: 14 },
    { title: 'Format & Upload Content', description: 'Format articles according to journal style and upload to OJS.', department: 'Editorial', priority: 'high', daysToComplete: 21 }
  ],
  'Indexing': [
    { title: 'Submit to Indexing Agencies', description: 'Submit journal to relevant databases (DOAJ, Google Scholar, etc.).', department: 'Editorial', priority: 'medium', daysToComplete: 30 }
  ],
  'Plagiarism': [
    { title: 'Run Plagiarism Check', description: 'Check submitted articles for originality.', department: 'Editorial', priority: 'high', daysToComplete: 2 }
  ],
  'Domain': [
    { title: 'Purchase Domain', description: 'Register the requested domain name.', department: 'Technical', priority: 'high', daysToComplete: 1 },
    { title: 'Record Domain Invoice', description: 'Upload domain purchase invoice and record expense.', department: 'Technical', priority: 'medium', daysToComplete: 2 }
  ],
  'Catalog Service': [
    { title: 'Setup Catalog', description: 'Configure journal catalog and metadata.', department: 'Editorial', priority: 'medium', daysToComplete: 5 }
  ],
  'Marketing': [
    { title: 'Marketing Campaign', description: 'Launch journal marketing and boost campaign.', department: 'Technical', priority: 'medium', daysToComplete: 15 }
  ],
  'Call for Papers': [
    { title: 'Call for Papers', description: 'Design and distribute call for papers.', department: 'Technical', priority: 'medium', daysToComplete: 7 }
  ],
  'Editorial Setup': [
    { title: 'Editorial Team Setup', description: 'Recruit and setup editorial team.', department: 'Technical', priority: 'high', daysToComplete: 14 }
  ],
  'Reviewer Recruitment': [
    { title: 'Reviewer Recruitment', description: 'Identify and recruit peer reviewers.', department: 'Technical', priority: 'medium', daysToComplete: 10 }
  ],
  'HEC Indexing': [
    { title: 'HEC Application', description: 'Prepare and submit HEC recognition application.', department: 'Technical', priority: 'high', daysToComplete: 30 }
  ],
  'DOAJ Indexing': [
    { title: 'DOAJ Application', description: 'Prepare and submit DOAJ indexing application.', department: 'Technical', priority: 'medium', daysToComplete: 20 }
  ],
  'Scopus Indexing': [
    { title: 'Scopus Application', description: 'Prepare and submit Scopus indexing application.', department: 'Technical', priority: 'high', daysToComplete: 60 }
  ],
  'Journal Evaluation': [
    { title: 'Journal Evaluation', description: 'Perform comprehensive journal evaluation.', department: 'Technical', priority: 'medium', daysToComplete: 7 }
  ],
  'Impact Factor': [
    { title: 'Impact Factor Assessment', description: 'Evaluate journal impact factor potential.', department: 'Technical', priority: 'medium', daysToComplete: 5 }
  ],
  'Site Score': [
    { title: 'Site Score Analysis', description: 'Analyze and report journal site score.', department: 'Technical', priority: 'low', daysToComplete: 3 }
  ]
};

export const generateTasksForService = async (
  clientId: string, 
  clientName: string, 
  service: ServiceType,
  serviceId?: string
) => {
  const templates = SERVICE_TASK_TEMPLATES[service] || [];
  
  for (const template of templates) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.daysToComplete);
    
    await addDoc(collection(db, 'tasks'), {
      clientId,
      clientName,
      serviceType: service,
      serviceId: serviceId || '',
      title: template.title,
      description: template.description,
      department: template.department,
      status: 'pending',
      priority: template.priority,
      points: template.priority === 'high' ? 50 : template.priority === 'medium' ? 30 : 10,
      dueDate: dueDate.toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isClientVisible: true
    });
  }
};
