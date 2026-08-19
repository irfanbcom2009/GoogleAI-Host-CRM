import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Columns,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { HECCategory, HECCategoryType, User } from '../types';
import { cn } from '../lib/utils';

interface HECCategorySettingsProps {
  currentUser: User;
}

export const HECCategorySettings: React.FC<HECCategorySettingsProps> = ({ currentUser }) => {
  const [categories, setCategories] = useState<HECCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<HECCategoryType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<HECCategory | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['name', 'type', 'parent', 'status', 'actions']);

  const [formData, setFormData] = useState({
    name: '',
    type: 'main' as HECCategoryType,
    parentId: '',
    isActive: true
  });

  useEffect(() => {
    const q = query(collection(db, 'hec_categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HECCategory));
      setCategories(cats);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hec_categories');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!formData.name) return;

    // Check for duplicates under same parent
    const duplicate = categories.find(c => 
      c.name.toLowerCase() === formData.name.toLowerCase() && 
      c.type === formData.type && 
      c.parentId === formData.parentId
    );

    if (duplicate) {
      alert('A category with this name already exists under the selected parent.');
      return;
    }

    try {
      await addDoc(collection(db, 'hec_categories'), {
        ...formData,
        createdAt: serverTimestamp(),
        createdById: currentUser.id,
        createdBy: currentUser.name
      });
      setShowAddModal(false);
      setFormData({ name: '', type: 'main', parentId: '', isActive: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hec_categories');
    }
  };

  const handleUpdate = async () => {
    if (!editingCategory || !formData.name) return;

    try {
      await updateDoc(doc(db, 'hec_categories', editingCategory.id), {
        ...formData,
        updatedAt: serverTimestamp(),
        updatedById: currentUser.id,
        updatedBy: currentUser.name
      });
      setEditingCategory(null);
      setFormData({ name: '', type: 'main', parentId: '', isActive: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_categories');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? This will not delete children but they will lose their parent reference.')) return;

    try {
      await deleteDoc(doc(db, 'hec_categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hec_categories');
    }
  };

  const toggleStatus = async (category: HECCategory) => {
    try {
      await updateDoc(doc(db, 'hec_categories', category.id), {
        isActive: !category.isActive,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_categories');
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || cat.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' ? cat.isActive : !cat.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = categories.find(c => c.id === parentId);
    return parent ? parent.name : 'Unknown';
  };

  const mainCategories = categories.filter(c => c.type === 'main' && c.isActive);
  const subCategories = categories.filter(c => c.type === 'sub' && c.isActive);

  const handleBulkUpdate = async () => {
    const rawData = `Agriculture Sciences	Agricultural and Biological Sciences	Agricultural and Biological Sciences (miscellaneous)
Agriculture Sciences	Agricultural and Biological Sciences	Agronomy and Crop Science
Agriculture Sciences	Agricultural and Biological Sciences	Animal Science and Zoology
Agriculture Sciences	Agricultural and Biological Sciences	Aquatic Science
Agriculture Sciences	Agricultural and Biological Sciences	Ecology, Evolution, Behavior and Systematics
Agriculture Sciences	Agricultural and Biological Sciences	Food Science
Agriculture Sciences	Agricultural and Biological Sciences	Forestry
Agriculture Sciences	Agricultural and Biological Sciences	Horticulture
Agriculture Sciences	Agricultural and Biological Sciences	Insect Science
Agriculture Sciences	Agricultural and Biological Sciences	Plant Science
Agriculture Sciences	Agricultural and Biological Sciences	Soil Science
HJRS Categories	W Category	W
HJRS Categories	X Category	X
HJRS Categories	Y Category	Y
HJRS Categories	Z Category	Z
Arts and Humanities	Arts and Humanities	Arts and Humanities (miscellaneous)
Arts and Humanities	Arts and Humanities	History
Arts and Humanities	Arts and Humanities	Language and Linguistics
Arts and Humanities	Arts and Humanities	Archeology (arts and humanities)
Arts and Humanities	Arts and Humanities	Classics
Arts and Humanities	Arts and Humanities	Conservation
Arts and Humanities	Arts and Humanities	Literature and Literary Theory
Arts and Humanities	Arts and Humanities	Museology
Arts and Humanities	Arts and Humanities	Music
Arts and Humanities	Arts and Humanities	Philosophy
Arts and Humanities	Arts and Humanities	Religious Studies
Arts and Humanities	Arts and Humanities	Visual Arts and Performing Arts
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Aging
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Biochemistry
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Biochemistry, Genetics and Molecular Biology (miscellaneous)
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Biophysics
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Biotechnology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Cancer Research
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Cell Biology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Clinical Biochemistry
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Developmental Biology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Endocrinology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Genetics
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Molecular Biology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Molecular Medicine
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Physiology
Biological and Health Sciences	Biochemistry, Genetics and Molecular Biology	Structural Biology
Biological and Health Sciences	Immunology and Microbiology	Immunology and Microbiology (miscellaneous)
Biological and Health Sciences	Immunology and Microbiology	Applied Microbiology and Biotechnology
Biological and Health Sciences	Immunology and Microbiology	Immunology
Biological and Health Sciences	Immunology and Microbiology	Microbiology
Biological and Health Sciences	Immunology and Microbiology	Parasitology
Biological and Health Sciences	Immunology and Microbiology	Virology
Biological and Health Sciences	Medicine	Anatomy
Biological and Health Sciences	Medicine	Anesthesiology and Pain Medicine
Biological and Health Sciences	Medicine	Biochemistry (medical)
Biological and Health Sciences	Medicine	Cardiology and Cardiovascular Medicine
Biological and Health Sciences	Medicine	Complementary and Alternative Medicine
Biological and Health Sciences	Medicine	Critical Care and Intensive Care Medicine
Biological and Health Sciences	Medicine	Dermatology
Biological and Health Sciences	Medicine	Drug Guides
Biological and Health Sciences	Medicine	Embryology
Biological and Health Sciences	Medicine	Emergency Medicine
Biological and Health Sciences	Medicine	Endocrinology, Diabetes and Metabolism
Biological and Health Sciences	Medicine	Epidemiology
Biological and Health Sciences	Medicine	Family Practice
Biological and Health Sciences	Medicine	Gastroenterology
Biological and Health Sciences	Medicine	Genetics (clinical)
Biological and Health Sciences	Medicine	Geriatrics and Gerontology
Biological and Health Sciences	Medicine	Health Informatics
Biological and Health Sciences	Medicine	Health Policy
Biological and Health Sciences	Medicine	Hematology
Biological and Health Sciences	Medicine	Hepatology
Biological and Health Sciences	Medicine	Histology
Biological and Health Sciences	Medicine	Immunology and Allergy
Biological and Health Sciences	Medicine	Infectious Diseases
Biological and Health Sciences	Medicine	Internal Medicine
Biological and Health Sciences	Medicine	Medicine (miscellaneous)
Biological and Health Sciences	Medicine	Microbiology (medical)
Biological and Health Sciences	Medicine	Nephrology
Biological and Health Sciences	Medicine	Neurology (clinical)
Biological and Health Sciences	Medicine	Obstetrics and Gynecology
Biological and Health Sciences	Medicine	Oncology
Biological and Health Sciences	Medicine	Ophthalmology
Biological and Health Sciences	Medicine	Orthopedics and Sports Medicine
Biological and Health Sciences	Medicine	Otorhinolaryngology
Biological and Health Sciences	Medicine	Pathology and Forensic Medicine
Biological and Health Sciences	Medicine	Pediatrics, Perinatology and Child Health
Biological and Health Sciences	Medicine	Pharmacology (medical)
Biological and Health Sciences	Medicine	Physiology (medical)
Biological and Health Sciences	Medicine	Psychiatry and Mental Health
Biological and Health Sciences	Medicine	Public Health, Environmental and Occupational Health
Biological and Health Sciences	Medicine	Pulmonary and Respiratory Medicine
Biological and Health Sciences	Medicine	Radiology, Nuclear Medicine and Imaging
Biological and Health Sciences	Medicine	Rehabilitation
Biological and Health Sciences	Medicine	Reproductive Medicine
Biological and Health Sciences	Medicine	Reviews and References (medical)
Biological and Health Sciences	Medicine	Rheumatology
Biological and Health Sciences	Medicine	Surgery
Biological and Health Sciences	Medicine	Transplantation
Biological and Health Sciences	Medicine	Urology
Biological and Health Sciences	Neuroscience	Neuroscience (miscellaneous)
Biological and Health Sciences	Neuroscience	Behavioral Neuroscience
Biological and Health Sciences	Neuroscience	Biological Psychiatry
Biological and Health Sciences	Neuroscience	Cellular and Molecular Neuroscience
Biological and Health Sciences	Neuroscience	Cognitive Neuroscience
Biological and Health Sciences	Neuroscience	Developmental Neuroscience
Biological and Health Sciences	Neuroscience	Endocrine and Autonomic Systems
Biological and Health Sciences	Neuroscience	Neurology
Biological and Health Sciences	Neuroscience	Sensory Systems
Biological and Health Sciences	Nursing	Nursing (miscellaneous)
Biological and Health Sciences	Nursing	Advanced and Specialized Nursing
Biological and Health Sciences	Nursing	Assessment and Diagnosis
Biological and Health Sciences	Nursing	Care Planning
Biological and Health Sciences	Nursing	Community and Home Care
Biological and Health Sciences	Nursing	Critical Care Nursing
Biological and Health Sciences	Nursing	Emergency Nursing
Biological and Health Sciences	Nursing	Fundamentals and Skills
Biological and Health Sciences	Nursing	Gerontology
Biological and Health Sciences	Nursing	Issues, Ethics and Legal Aspects
Biological and Health Sciences	Nursing	Leadership and Management
Biological and Health Sciences	Nursing	LPN and LVN
Biological and Health Sciences	Nursing	Maternity and Midwifery
Biological and Health Sciences	Nursing	Medical and Surgical Nursing
Biological and Health Sciences	Nursing	Nurse Assisting
Biological and Health Sciences	Nursing	Nutrition and Dietetics
Biological and Health Sciences	Nursing	Oncology (nursing)
Biological and Health Sciences	Nursing	Pediatrics
Biological and Health Sciences	Nursing	Pharmacology (nursing)
Biological and Health Sciences	Nursing	Psychiatric Mental Health
Biological and Health Sciences	Nursing	Research and Theory
Biological and Health Sciences	Nursing	Review and Exam Preparation
Biological and Health Sciences	Pharmacology, Toxicology and Pharmaceutics	Pharmacology, Toxicology and Pharmaceutics (miscellaneous)
Biological and Health Sciences	Pharmacology, Toxicology and Pharmaceutics	Drug Discovery
Biological and Health Sciences	Pharmacology, Toxicology and Pharmaceutics	Pharmaceutical Science
Biological and Health Sciences	Pharmacology, Toxicology and Pharmaceutics	Pharmacology
Biological and Health Sciences	Pharmacology, Toxicology and Pharmaceutics	Toxicology
Biological and Health Sciences	Psychology	Psychology (miscellaneous)
Biological and Health Sciences	Psychology	Applied Psychology
Biological and Health Sciences	Psychology	Clinical Psychology
Biological and Health Sciences	Psychology	Developmental and Educational Psychology
Biological and Health Sciences	Psychology	Experimental and Cognitive Psychology
Biological and Health Sciences	Psychology	Neuropsychology and Physiological Psychology
Biological and Health Sciences	Psychology	Social Psychology
Biological and Health Sciences	Veterinary	Veterinary (miscellaneous)
Biological and Health Sciences	Veterinary	Equine
Biological and Health Sciences	Veterinary	Food Animals
Biological and Health Sciences	Veterinary	Small Animals
Biological and Health Sciences	Dentistry	Dentistry (miscellaneous)
Biological and Health Sciences	Dentistry	Dental Assisting
Biological and Health Sciences	Dentistry	Dental Hygiene
Biological and Health Sciences	Dentistry	Oral Surgery
Biological and Health Sciences	Dentistry	Orthodontics
Biological and Health Sciences	Dentistry	Periodontics
Biological and Health Sciences	Health Professions	Podiatry
Biological and Health Sciences	Health Professions	Radiological and Ultrasound Technology
Biological and Health Sciences	Health Professions	Respiratory Care
Biological and Health Sciences	Health Professions	Speech and Hearing
Biological and Health Sciences	Health Professions	Sports Science
Biological and Health Sciences	Health Professions	Health Professions (miscellaneous)
Biological and Health Sciences	Health Professions	Chiropractics
Biological and Health Sciences	Health Professions	Complementary and Manual Therapy
Biological and Health Sciences	Health Professions	Emergency Medical Services
Biological and Health Sciences	Health Professions	Health Information Management
Biological and Health Sciences	Health Professions	Medical Assisting and Transcription
Biological and Health Sciences	Health Professions	Medical Laboratory Technology
Biological and Health Sciences	Health Professions	Medical Terminology
Biological and Health Sciences	Health Professions	Occupational Therapy
Biological and Health Sciences	Health Professions	Optometry
Biological and Health Sciences	Health Professions	Pharmacy
Biological and Health Sciences	Health Professions	Physical Therapy, Sports Therapy and Rehabilitation
Business Education	Management Sciences	Human Resource Management/Human Resource Development
Business Education	Management Sciences	Financial Management
Business Education	Management Sciences	Marketing Management
Business Education	Management Sciences	Management
Business Education	Management Sciences	Quality Management
Business Education	Management Sciences	Project Management
Business Education	Management Sciences	Disaster and Risk Management
Business Education	Management Sciences	Hotel Management
Business Education	Management Sciences	Services Management
Education and HR	Multidisciplinary	Multidisciplinary
Engineering and Technology	Computer Science	Computer Science (miscellaneous)
Engineering and Technology	Computer Science	Artificial Intelligence
Engineering and Technology	Computer Science	Computational Theory and Mathematics
Engineering and Technology	Computer Science	Computer Graphics and Computer-Aided Design
Engineering and Technology	Computer Science	Computer Networks and Communications
Engineering and Technology	Computer Science	Computer Science Applications
Engineering and Technology	Computer Science	Computer Vision and Pattern Recognition
Engineering and Technology	Computer Science	Hardware and Architecture
Engineering and Technology	Computer Science	Human-Computer Interaction
Engineering and Technology	Computer Science	Information Systems
Engineering and Technology	Computer Science	Signal Processing
Engineering and Technology	Computer Science	Software
Engineering and Technology	Decision Sciences	Decision Sciences (miscellaneous)
Engineering and Technology	Decision Sciences	Information Systems and Management
Engineering and Technology	Decision Sciences	Management Science and Operations Research
Engineering and Technology	Decision Sciences	Statistics, Probability and Uncertainty
Engineering and Technology	Energy 	Energy (miscellaneous)
Engineering and Technology	Energy 	Energy Engineering and Power Technology
Engineering and Technology	Energy 	Fuel Technology
Engineering and Technology	Energy 	Nuclear Energy and Engineering
Engineering and Technology	Energy 	Renewable Energy, Sustainability and the Environment
Engineering and Technology	Engineering 	Engineering (miscellaneous)
Engineering and Technology	Engineering 	Aerospace Engineering
Engineering and Technology	Engineering 	Automotive Engineering
Engineering and Technology	Engineering 	Biomedical Engineering
Engineering and Technology	Engineering 	Civil and Structural Engineering
Engineering and Technology	Engineering 	Computational Mechanics
Engineering and Technology	Engineering 	Control and Systems Engineering
Engineering and Technology	Engineering 	Electrical and Electronic Engineering
Engineering and Technology	Engineering 	Industrial and Manufacturing Engineering
Engineering and Technology	Engineering 	Mechanical Engineering
Engineering and Technology	Engineering 	Mechanics of Materials
Engineering and Technology	Engineering 	Ocean Engineering
Engineering and Technology	Engineering 	Safety, Risk, Reliability and Quality
Engineering and Technology	Engineering 	Building and Construction
Engineering and Technology	Engineering 	Architecture
Engineering and Technology	Chemical Engineering	Process Chemistry and Technology
Engineering and Technology	Chemical Engineering	Chemical Engineering (miscellaneous)
Engineering and Technology	Chemical Engineering	Fluid Flow and Transfer Processes
Engineering and Technology	Chemical Engineering	Bioengineering
Engineering and Technology	Chemical Engineering	Filtration and Separation
Engineering and Technology	Chemical Engineering	Catalysis
Engineering and Technology	Chemical Engineering	Colloid and Surface Chemistry
Engineering and Technology	Chemical Engineering	Chemical Health and Safety
Engineering and Technology	Decision Sciences	
Engineering and Technology	Energy	Chemical Engineering (miscellaneous)
Engineering and Technology	Energy	Bioengineering
Engineering and Technology	Energy	Catalysis
Engineering and Technology	Energy	Chemical Health and Safety
Engineering and Technology	Energy	Colloid and Surface Chemistry
Engineering and Technology	Energy	Filtration and Separation
Engineering and Technology	Energy	Fluid Flow and Transfer Processes
Engineering and Technology	Energy	Process Chemistry and Technology
Engineering and Technology	Engineering	Engineering (miscellaneous)
Engineering and Technology	Engineering	Aerospace Engineering
Engineering and Technology	Engineering	Automotive Engineering
Engineering and Technology	Engineering	Biomedical Engineering
Engineering and Technology	Engineering	Civil and Structural Engineering
Engineering and Technology	Engineering	Computational Mechanics
Engineering and Technology	Engineering	Control and Systems Engineering
Engineering and Technology	Engineering	Electrical and Electronic Engineering
Engineering and Technology	Engineering	Industrial and Manufacturing Engineering
Engineering and Technology	Engineering	Mechanical Engineering
Engineering and Technology	Engineering	Mechanics of Materials
Engineering and Technology	Engineering	Ocean Engineering
Engineering and Technology	Engineering	Safety, Risk, Reliability and Quality
Engineering and Technology	Engineering	Media Technology
Engineering and Technology	Engineering	Building and Construction
Engineering and Technology	Engineering	Architecture
Management Sciences	Business, Management and Accounting	Business, Management and Accounting (miscellaneous)
Management Sciences	Business, Management and Accounting	Accounting
Management Sciences	Business, Management and Accounting	Business and International Management
Management Sciences	Business, Management and Accounting	Management Information Systems
Management Sciences	Business, Management and Accounting	Management of Technology and Innovation
Management Sciences	Business, Management and Accounting	Marketing
Management Sciences	Business, Management and Accounting	Organizational Behavior and Human Resource Management
Management Sciences	Business, Management and Accounting	Strategy and Management
Management Sciences	Business, Management and Accounting	Tourism, Leisure and Hospitality Management
Management Sciences	Business, Management and Accounting	Industrial Relations
Mathematical and Physical Sciences	Chemistry	Chemistry (miscellaneous)
Mathematical and Physical Sciences	Chemistry	Analytical Chemistry
Mathematical and Physical Sciences	Chemistry	Electrochemistry
Mathematical and Physical Sciences	Chemistry	Inorganic Chemistry
Mathematical and Physical Sciences	Chemistry	Organic Chemistry
Mathematical and Physical Sciences	Chemistry	Physical and Theoretical Chemistry
Mathematical and Physical Sciences	Chemistry	Spectroscopy (partially visible)
Mathematical and Physical Sciences	Earth and Planetary Sciences	Earth and Planetary Sciences (miscellaneous)
Mathematical and Physical Sciences	Earth and Planetary Sciences	Atmospheric Science
Mathematical and Physical Sciences	Earth and Planetary Sciences	Computers in Earth Sciences
Mathematical and Physical Sciences	Earth and Planetary Sciences	Earth-Surface Processes
Mathematical and Physical Sciences	Earth and Planetary Sciences	Economic Geology
Mathematical and Physical Sciences	Earth and Planetary Sciences	Geochemistry and Petrology
Mathematical and Physical Sciences	Earth and Planetary Sciences	Geology
Mathematical and Physical Sciences	Earth and Planetary Sciences	Geophysics
Mathematical and Physical Sciences	Earth and Planetary Sciences	Geotechnical Engineering and Engineering Geology
Mathematical and Physical Sciences	Earth and Planetary Sciences	Oceanography
Mathematical and Physical Sciences	Earth and Planetary Sciences	Paleontology
Mathematical and Physical Sciences	Earth and Planetary Sciences	Space and Planetary Science
Mathematical and Physical Sciences	Earth and Planetary Sciences	Stratigraphy
Mathematical and Physical Sciences	Environmental Science	Environmental Science (miscellaneous)
Mathematical and Physical Sciences	Environmental Science	Ecological Modeling
Mathematical many and Physical Sciences	Environmental Science	Ecology
Mathematical and Physical Sciences	Environmental Science	Environmental Chemistry
Mathematical and Physical Sciences	Environmental Science	Environmental Engineering
Mathematical and Physical Sciences	Environmental Science	Global and Planetary Change
Mathematical and Physical Sciences	Environmental Science	Health, Toxicology and Mutagenesis
Mathematical and Physical Sciences	Environmental Science	Management, Monitoring, Policy and Law
Mathematical and Physical Sciences	Environmental Science	Nature and Landscape Conservation
Mathematical and Physical Sciences	Environmental Science	Pollution
Mathematical and Physical Sciences	Environmental Science	Waste Management and Disposal
Mathematical and Physical Sciences	Environmental Science	Water Science and Technology
Mathematical and Physical Sciences	Materials Science	Materials Science (miscellaneous)
Mathematical and Physical Sciences	Materials Science	Biomaterials
Mathematical and Physical Sciences	Materials Science	Ceramics and Composites
Mathematical and Physical Sciences	Materials Science	Electronic, Optical and Magnetic Materials
Mathematical and Physical Sciences	Materials Science	Materials Chemistry
Mathematical and Physical Sciences	Materials Science	Metals and Alloys
Mathematical and Physical Sciences	Materials Science	Polymers and Plastics
Mathematical and Physical Sciences	Materials Science	Surfaces, Coatings and Films
Mathematical and Physical Sciences	Materials Science	Nanoscience and Nanotechnology
Mathematical and Physical Sciences	Mathematics	Mathematics (miscellaneous)
Mathematical and Physical Sciences	Mathematics	Algebra and Number Theory
Mathematical and Physical Sciences	Mathematics	Analysis
Mathematical and Physical Sciences	Mathematics	Applied Mathematics
Mathematical and Physical Sciences	Mathematics	Computational Mathematics
Mathematical and Physical Sciences	Mathematics	Control and Optimization
Mathematical and Physical Sciences	Mathematics	Discrete Mathematics and Combinatorics (partially visible)
Mathematical and Physical Sciences	Mathematics	Logic
Mathematical and Physical Sciences	Mathematics	Mathematical Physics
Mathematical and Physical Sciences	Mathematics	Modeling and Simulation
Mathematical and Physical Sciences	Mathematics	Numerical Analysis
Mathematical and Physical Sciences	Mathematics	Statistics and Probability
Mathematical and Physical Sciences	Mathematics	Theoretical Computer Science
Mathematical and Physical Sciences	Physics and Astronomy	Physics and Astronomy (miscellaneous)
Mathematical and Physical Sciences	Physics and Astronomy	Acoustics and Ultrasonics
Mathematical and Physical Sciences	Physics and Astronomy	Astronomy and Astrophysics
Mathematical and Physical Sciences	Physics and Astronomy	Condensed Matter Physics
Mathematical and Physical Sciences	Physics and Astronomy	Instrumentation
Mathematical and Physical Sciences	Physics and Astronomy	Nuclear and High Energy Physics
Mathematical and Physical Sciences	Physics and Astronomy	Atomic and Molecular Physics, and Optics
Mathematical and Physical Sciences	Physics and Astronomy	Radiation
Mathematical and Physical Sciences	Physics and Astronomy	Statistical and Nonlinear Physics
Mathematical and Physical Sciences	Physics and Astronomy	Surfaces and Interfaces
Social, Behavioral and Economic Sciences	Economics, Econometrics and Finance	Economics, Econometrics and Finance (miscellaneous)
Social, Behavioral and Economic Sciences	Economics, Econometrics and Finance	Economics and Econometrics
Social, Behavioral and Economic Sciences	Economics, Econometrics and Finance	Finance
Social, Behavioral and Economic Sciences	Social Sciences	Anthropology
Social, Behavioral and Economic Sciences	Social Sciences	Archeology
Social, Behavioral and Economic Sciences	Social Sciences	Communication
Social, Behavioral and Economic Sciences	Social Sciences	Cultural Studies
Social, Behavioral and Economic Sciences	Social Sciences	Demography
Social, Behavioral and Economic Sciences	Social Sciences	Development
Social, Behavioral and Economic Sciences	Social Sciences	E-learning
Social, Behavioral and Economic Sciences	Social Sciences	Education
Social, Behavioral and Economic Sciences	Social Sciences	Gender Studies
Social, Behavioral and Economic Sciences	Social Sciences	Geography, Planning and Development
Social, Behavioral and Economic Sciences	Social Sciences	Health (social science)
Social, Behavioral and Economic Sciences	Social Sciences	Human Factors and Ergonomics
Social, Behavioral and Economic Sciences	Social Sciences	Law
Social, Behavioral and Economic Sciences	Social Sciences	Library and Information Sciences
Social, Behavioral and Economic Sciences	Social Sciences	Life-span and Life-course Studies
Social, Behavioral and Economic Sciences	Social Sciences	Linguistics and Language
Social, Behavioral and Economic Sciences	Social Sciences	Political Science and International Relations
Social, Behavioral and Economic Sciences	Social Sciences	Public Administration
Social, Behavioral and Economic Sciences	Social Sciences	Safety Research
Social, Behavioral and Economic Sciences	Social Sciences	Social Sciences (miscellaneous)
Social, Behavioral and Economic Sciences	Social Sciences	Social Work
Social, Behavioral and Economic Sciences	Social Sciences	Sociology and Political Science
Social, Behavioral and Economic Sciences	Social Sciences	Transportation
Social, Behavioral and Economic Sciences	Social Sciences	Urban Studies`;

    if (!window.confirm('This will wipe all existing HEC categories and replace them with the verified categories list. Are you sure?')) return;

    setIsLoading(true);
    try {
      const colRef = collection(db, 'hec_categories');
      const lines = rawData.split('\n');
      
      // Map names to IDs to handle hierarchy
      const mainMap = new Map<string, string>();
      const subMap = new Map<string, string>();

      // Optional: Delete existing if desired, but here we'll just add
      // If we want a clean wipe:
      /*
      const existing = await getDocs(colRef);
      for (const d of existing.docs) {
        await deleteDoc(doc(db, 'hec_categories', d.id));
      }
      */

      let count = 0;
      for (const line of lines) {
        const [domain, discipline, category] = line.split('\t').map(s => s?.trim());
        if (!domain) continue;

        // Ensure Domain exists
        let mainId = mainMap.get(domain);
        if (!mainId) {
          const mainDoc = await addDoc(colRef, {
            name: domain,
            type: 'main',
            parentId: null,
            isActive: true,
            createdAt: serverTimestamp(),
            createdById: currentUser.id,
            createdBy: currentUser.name
          });
          mainId = mainDoc.id;
          mainMap.set(domain, mainId);
          count++;
        }

        if (!discipline) continue;

        // Ensure Discipline exists
        const subKey = `${discipline}:${mainId}`;
        let subId = subMap.get(subKey);
        if (!subId) {
          const subDoc = await addDoc(colRef, {
            name: discipline,
            type: 'sub',
            parentId: mainId,
            isActive: true,
            createdAt: serverTimestamp(),
            createdById: currentUser.id,
            createdBy: currentUser.name
          });
          subId = subDoc.id;
          subMap.set(subKey, subId);
          count++;
        }

        if (!category) continue;

        // Add Category
        await addDoc(colRef, {
          name: category,
          type: 'subject',
          parentId: subId,
          isActive: true,
          createdAt: serverTimestamp(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
        count++;
      }

      alert(`Successfully processed categories. Added/Verified ${count} entries.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_categories');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search categories..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="main">Main Category</option>
              <option value="sub">Sub Category</option>
              <option value="subject">Subject Category</option>
            </select>
            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="all">All Status</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === 'Admin' && (
            <button 
              onClick={handleBulkUpdate}
              className="p-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all flex items-center gap-2 font-bold text-xs"
              title="Bulk Import Categories"
            >
              <LayoutGrid size={18} />
              Bulk Sync
            </button>
          )}
          <button 
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Column Selection"
          >
            <Columns size={20} />
          </button>
          <button 
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', type: 'main', parentId: '', isActive: true });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Add Category
          </button>
        </div>
      </div>

      {showColumnSelector && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-4">
          <span className="text-sm font-bold text-slate-700 w-full mb-2">Visible Columns:</span>
          {['name', 'type', 'parent', 'status', 'actions'].map(col => (
            <label key={col} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={visibleColumns.includes(col)}
                onChange={(e) => {
                  if (e.target.checked) setVisibleColumns([...visibleColumns, col]);
                  else setVisibleColumns(visibleColumns.filter(c => c !== col));
                }}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm capitalize">{col}</span>
            </label>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-100">
              {visibleColumns.includes('name') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category Name</th>}
              {visibleColumns.includes('type') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>}
              {visibleColumns.includes('parent') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Parent</th>}
              {visibleColumns.includes('status') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>}
              {visibleColumns.includes('actions') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading categories...</p>
                  </div>
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-slate-500">No categories found matching your criteria.</p>
                </td>
              </tr>
            ) : (
              filteredCategories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                  {visibleColumns.includes('name') && (
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                    </td>
                  )}
                  {visibleColumns.includes('type') && (
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        cat.type === 'main' ? "bg-indigo-50 text-indigo-600" :
                        cat.type === 'sub' ? "bg-emerald-50 text-emerald-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {cat.type}
                      </span>
                    </td>
                  )}
                  {visibleColumns.includes('parent') && (
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{getParentName(cat.parentId)}</span>
                    </td>
                  )}
                  {visibleColumns.includes('status') && (
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(cat)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                          cat.isActive 
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {cat.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  )}
                  {visibleColumns.includes('actions') && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setFormData({
                              name: cat.name,
                              type: cat.type,
                              parentId: cat.parentId || '',
                              isActive: cat.isActive
                            });
                            setShowAddModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter category name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category Type</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.type || ''}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as HECCategoryType, parentId: '' })}
                  >
                    <option value="main">Main Category</option>
                    <option value="sub">Sub Category</option>
                    <option value="subject">Subject Category</option>
                  </select>
                </div>

                {formData.type !== 'main' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      {formData.type === 'sub' ? 'Parent Main Category' : 'Parent Sub Category'}
                    </label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.parentId || ''}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      required
                    >
                      <option value="">Select Parent</option>
                      {formData.type === 'sub' ? (
                        mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      ) : (
                        subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      )}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      formData.isActive ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      formData.isActive ? "right-1" : "left-1"
                    )} />
                  </button>
                  <span className="text-sm font-medium text-slate-700">Active Status</span>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={editingCategory ? handleUpdate : handleAdd}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {editingCategory ? 'Update' : 'Add Category'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
