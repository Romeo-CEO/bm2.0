import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Company, Application } from '@/types';
import { apiGetUsers, apiUpdateUser, apiDeleteUser, apiGetApplications, apiCreateApplication, apiUpdateApplication, apiDeleteApplication, FrontendUser, FrontendApplication } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface DataContextType {
  // Users
  users: User[];
  addUser: (user: User) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // Applications
  applications: Application[];
  addApplication: (application: Application) => void;
  updateApplication: (id: string, application: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  
  // Templates  
  templates: Application[];
  addTemplate: (template: Application) => void;
  updateTemplate: (id: string, template: Partial<Application>) => void;
  deleteTemplate: (id: string) => void;
  
  // Companies
  companies: Company[];
  addCompany: (company: Company) => void;
  updateCompany: (id: string, company: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);

  const [companies, setCompanies] = useState<Company[]>([
    {
      id: '1',
      name: 'TechCorp Solutions',
      domain: 'techcorp.com',
      ownerId: '2',
      createdAt: new Date('2023-01-15'),
      isActive: true
    },
    {
      id: '2',
      name: 'RetailPlus Inc',
      domain: 'retailplus.com',
      ownerId: '3',
      createdAt: new Date('2023-03-10'),
      isActive: true
    },
    {
      id: '3',
      name: 'Consulting Group',
      domain: 'consulting.com',
      ownerId: '4',
      createdAt: new Date('2023-02-20'),
      isActive: false
    },
    {
      id: '4',
      name: 'Example Company',
      domain: 'example.com',
      ownerId: '5',
      createdAt: new Date('2023-04-01'),
      isActive: true
    }
  ]);

  const [applications, setApplications] = useState<Application[]>([]);

  const [templates, setTemplates] = useState<Application[]>([]);

  const { user: authUser } = useAuth();

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) return; // Skip fetching when not authenticated
      const [u, apps, tmpls] = await Promise.all([
        apiGetUsers(),
        apiGetApplications('application'),
        apiGetApplications('template'),
      ]);
      if (u.success && u.data) setUsers(u.data as unknown as User[]);
      if (apps.success && apps.data) setApplications(apps.data as unknown as Application[]);
      if (tmpls.success && tmpls.data) setTemplates(tmpls.data as unknown as Application[]);
    })();
  }, [authUser]);

  // User methods
  const addUser = (user: User) => {
    setUsers(prev => [...prev, user]);
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    const res = await apiUpdateUser(id, userData as any);
    if (res.success) {
      setUsers(prev => prev.map(user => 
        user.id === id ? { ...user, ...userData } : user
      ));
    }
  };

  const deleteUser = async (id: string) => {
    const res = await apiDeleteUser(id);
    if (res.success) {
      setUsers(prev => prev.filter(user => user.id !== id));
    }
  };

  // Application methods
  const addApplication = async (application: Application) => {
    const res = await apiCreateApplication(application as unknown as FrontendApplication);
    if (res.success && res.data) {
      setApplications(prev => [...prev, { ...application, id: res.data! }]);
    }
  };

  const updateApplication = async (id: string, applicationData: Partial<Application>) => {
    const res = await apiUpdateApplication(id, applicationData as any);
    if (res.success) {
      setApplications(prev => prev.map(app => 
        app.id === id ? { ...app, ...applicationData } : app
      ));
    }
  };

  const deleteApplication = async (id: string) => {
    const res = await apiDeleteApplication(id);
    if (res.success) {
      setApplications(prev => prev.filter(app => app.id !== id));
    }
  };

  // Template methods
  const addTemplate = (template: Application) => {
    setTemplates(prev => [...prev, template]);
  };

  const updateTemplate = (id: string, templateData: Partial<Application>) => {
    setTemplates(prev => prev.map(template => 
      template.id === id ? { ...template, ...templateData } : template
    ));
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(template => template.id !== id));
  };

  // Company methods
  const addCompany = (company: Company) => {
    setCompanies(prev => [...prev, company]);
  };

  const updateCompany = (id: string, companyData: Partial<Company>) => {
    setCompanies(prev => prev.map(company => 
      company.id === id ? { ...company, ...companyData } : company
    ));
  };

  const deleteCompany = (id: string) => {
    setCompanies(prev => prev.filter(company => company.id !== id));
  };

  const value: DataContextType = {
    users,
    addUser,
    updateUser,
    deleteUser,
    applications,
    addApplication,
    updateApplication,
    deleteApplication,
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};