import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { APIDocumentation, DocumentationSection, DocumentationVersion } from '../types';
import { documentationService } from '../services/documentationService';

interface DocumentationContextType {
  apiDocumentation: APIDocumentation | null;
  sections: DocumentationSection[];
  versions: DocumentationVersion[];
  currentVersion: string;
  loading: boolean;
  error: string | null;
  refreshDocumentation: () => Promise<void>;
  setCurrentVersion: (version: string) => void;
}

const DocumentationContext = createContext<DocumentationContextType | undefined>(undefined);

interface DocumentationProviderProps {
  children: ReactNode;
}

export function DocumentationProvider({ children }: DocumentationProviderProps) {
  const [apiDocumentation, setApiDocumentation] = useState<APIDocumentation | null>(null);
  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [versions, setVersions] = useState<DocumentationVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load API documentation
      const apiDocs = await documentationService.getAPIDocumentation();
      setApiDocumentation(apiDocs);

      // Load documentation sections
      const docSections = await documentationService.getDocumentationSections();
      setSections(docSections);

      // Load version information
      const versionInfo = await documentationService.getVersions();
      setVersions(versionInfo);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDocumentation();
  }, [currentVersion]);

  const value: DocumentationContextType = {
    apiDocumentation,
    sections,
    versions,
    currentVersion,
    loading,
    error,
    refreshDocumentation,
    setCurrentVersion,
  };

  return (
    <DocumentationContext.Provider value={value}>
      {children}
    </DocumentationContext.Provider>
  );
}

export function useDocumentation() {
  const context = useContext(DocumentationContext);
  if (context === undefined) {
    throw new Error('useDocumentation must be used within a DocumentationProvider');
  }
  return context;
}