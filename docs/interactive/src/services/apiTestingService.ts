import axios, { AxiosResponse } from 'axios';
import { APITestRequest, APITestResponse } from '../types';

class APITestingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  }

  async executeRequest(request: APITestRequest): Promise<APITestResponse> {
    const startTime = Date.now();
    
    try {
      const response: AxiosResponse = await axios({
        method: request.method.toLowerCase() as any,
        url: request.url.startsWith('http') ? request.url : `${this.baseUrl}${request.url}`,
        headers: request.headers,
        data: request.body ? JSON.parse(request.body) : undefined,
        timeout: 30000, // 30 second timeout
        validateStatus: () => true // Don't throw on any status code
      });

      const duration = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        data: response.data,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status || 0,
          statusText: error.response?.statusText || 'Network Error',
          headers: error.response?.headers as Record<string, string> || {},
          data: error.response?.data || { error: error.message },
          duration
        };
      }

      return {
        status: 0,
        statusText: 'Unknown Error',
        headers: {},
        data: { error: error instanceof Error ? error.message : 'Unknown error occurred' },
        duration
      };
    }
  }

  generateCurlCommand(request: APITestRequest): string {
    let curl = `curl -X ${request.method}`;
    
    // Add headers
    Object.entries(request.headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });
    
    // Add body if present
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      curl += ` \\\n  -d '${request.body}'`;
    }
    
    // Add URL
    const url = request.url.startsWith('http') ? request.url : `${this.baseUrl}${request.url}`;
    curl += ` \\\n  "${url}"`;
    
    return curl;
  }

  generateJavaScriptCode(request: APITestRequest): string {
    const url = request.url.startsWith('http') ? request.url : `${this.baseUrl}${request.url}`;
    
    let code = `const response = await fetch('${url}', {\n`;
    code += `  method: '${request.method}',\n`;
    
    if (Object.keys(request.headers).length > 0) {
      code += `  headers: {\n`;
      Object.entries(request.headers).forEach(([key, value]) => {
        code += `    '${key}': '${value}',\n`;
      });
      code += `  }`;
    }
    
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (Object.keys(request.headers).length > 0) {
        code += `,\n`;
      }
      code += `  body: JSON.stringify(${request.body})`;
    }
    
    code += `\n});\n\n`;
    code += `const data = await response.json();\n`;
    code += `console.log(data);`;
    
    return code;
  }

  generatePythonCode(request: APITestRequest): string {
    const url = request.url.startsWith('http') ? request.url : `${this.baseUrl}${request.url}`;
    
    let code = `import requests\nimport json\n\n`;
    
    if (Object.keys(request.headers).length > 0) {
      code += `headers = {\n`;
      Object.entries(request.headers).forEach(([key, value]) => {
        code += `    '${key}': '${value}',\n`;
      });
      code += `}\n\n`;
    }
    
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      code += `data = ${request.body}\n\n`;
    }
    
    code += `response = requests.${request.method.toLowerCase()}(\n`;
    code += `    '${url}'`;
    
    if (Object.keys(request.headers).length > 0) {
      code += `,\n    headers=headers`;
    }
    
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      code += `,\n    json=data`;
    }
    
    code += `\n)\n\n`;
    code += `print(f"Status: {response.status_code}")\n`;
    code += `print(f"Response: {response.json()}")`;
    
    return code;
  }

  validateJSON(jsonString: string): { valid: boolean; error?: string } {
    try {
      JSON.parse(jsonString);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid JSON' 
      };
    }
  }

  formatJSON(jsonString: string): string {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch {
      return jsonString;
    }
  }
}

export const apiTestingService = new APITestingService();