export interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
  description?: string;
  example?: any;
}

export interface ResponseInfo {
  status: number;
  description: string;
  schema?: any;
  example?: any;
}

export interface CodeExample {
  language: string;
  code: string;
  description: string;
}

export interface RouteInfo {
  method: string;
  path: string;
  description?: string;
  parameters?: Parameter[];
  responses?: ResponseInfo[];
  examples?: CodeExample[];
  authentication?: boolean;
  tags?: string[];
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  routes: RouteInfo[];
  generatedAt: Date;
}

export interface DocumentationSection {
  id: string;
  title: string;
  category: 'api' | 'monitoring' | 'security' | 'deployment';
  content: string;
  lastUpdated: Date;
  tags: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  url: string;
  score: number;
}

export interface APITestRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface APITestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  duration: number;
}

export interface DocumentationVersion {
  version: string;
  date: Date;
  changes: string[];
  deprecated?: string[];
}