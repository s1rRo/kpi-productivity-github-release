import { Request, Response, NextFunction } from 'express';
import { gzipSync, deflateSync } from 'zlib';

export interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (1-9)
  filter?: (req: Request, res: Response) => boolean; // Custom filter function
}

/**
 * Response compression middleware
 * Compresses JSON responses using gzip or deflate based on Accept-Encoding header
 */
export function compressionMiddleware(options: CompressionOptions = {}) {
  const {
    threshold = 1024, // 1KB default threshold
    level = 6, // Default compression level
    filter = defaultFilter
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if custom filter returns false
    if (!filter(req, res)) {
      return next();
    }

    // Skip if no compression support
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    const supportsDeflate = acceptEncoding.includes('deflate');

    if (!supportsGzip && !supportsDeflate) {
      return next();
    }

    // Store original json method
    const originalJson = res.json;
    const originalSend = res.send;

    // Override json method
    res.json = function(data: any) {
      return compressAndSend.call(this, data, 'json');
    };

    // Override send method for other content
    res.send = function(data: any) {
      return compressAndSend.call(this, data, 'send');
    };

    function compressAndSend(this: Response, data: any, method: 'json' | 'send') {
      try {
        // Serialize data if it's an object
        let content: string;
        if (method === 'json') {
          content = JSON.stringify(data);
          this.setHeader('Content-Type', 'application/json; charset=utf-8');
        } else {
          content = typeof data === 'string' ? data : String(data);
        }

        const contentBuffer = Buffer.from(content, 'utf8');

        // Skip compression if content is too small
        if (contentBuffer.length < threshold) {
          if (method === 'json') {
            return originalJson.call(this, data);
          } else {
            return originalSend.call(this, data);
          }
        }

        // Compress the content
        let compressedBuffer: Buffer;
        let encoding: string;

        if (supportsGzip) {
          compressedBuffer = gzipSync(contentBuffer, { level });
          encoding = 'gzip';
        } else if (supportsDeflate) {
          compressedBuffer = deflateSync(contentBuffer, { level });
          encoding = 'deflate';
        } else {
          // Fallback to uncompressed
          if (method === 'json') {
            return originalJson.call(this, data);
          } else {
            return originalSend.call(this, data);
          }
        }

        // Set compression headers
        this.setHeader('Content-Encoding', encoding);
        this.setHeader('Content-Length', compressedBuffer.length.toString());
        this.setHeader('Vary', 'Accept-Encoding');

        // Add compression ratio header for debugging
        const ratio = ((contentBuffer.length - compressedBuffer.length) / contentBuffer.length * 100).toFixed(1);
        this.setHeader('X-Compression-Ratio', `${ratio}%`);

        // Send compressed data
        return this.end(compressedBuffer);

      } catch (error) {
        console.error('Compression error:', error);
        // Fallback to original method on error
        if (method === 'json') {
          return originalJson.call(this, data);
        } else {
          return originalSend.call(this, data);
        }
      }
    }

    next();
  };
}

/**
 * Default filter function - determines which responses should be compressed
 */
function defaultFilter(req: Request, res: Response): boolean {
  // Skip compression for certain routes
  const skipRoutes = [
    '/health',
    '/api/health'
  ];

  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return false;
  }

  // Skip compression for certain content types
  const contentType = res.getHeader('content-type') as string;
  if (contentType) {
    const skipTypes = [
      'image/',
      'video/',
      'audio/',
      'application/octet-stream'
    ];

    if (skipTypes.some(type => contentType.includes(type))) {
      return false;
    }
  }

  // Skip if already compressed
  if (res.getHeader('content-encoding')) {
    return false;
  }

  return true;
}

/**
 * JSON optimization middleware
 * Optimizes JSON serialization for better performance
 */
export function jsonOptimizationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(data: any) {
      try {
        // Optimize JSON serialization
        const optimizedData = optimizeJsonData(data);
        return originalJson.call(this, optimizedData);
      } catch (error) {
        console.error('JSON optimization error:', error);
        return originalJson.call(this, data);
      }
    };

    next();
  };
}

/**
 * Optimize JSON data by removing null values and empty arrays/objects
 */
function optimizeJsonData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data
      .map(item => optimizeJsonData(item))
      .filter(item => item !== null && item !== undefined);
  }

  if (typeof data === 'object') {
    const optimized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      const optimizedValue = optimizeJsonData(value);
      
      // Skip null/undefined values
      if (optimizedValue === null || optimizedValue === undefined) {
        continue;
      }
      
      // Skip empty arrays and objects
      if (Array.isArray(optimizedValue) && optimizedValue.length === 0) {
        continue;
      }
      
      if (typeof optimizedValue === 'object' && 
          !Array.isArray(optimizedValue) && 
          Object.keys(optimizedValue).length === 0) {
        continue;
      }
      
      optimized[key] = optimizedValue;
    }
    
    return optimized;
  }

  return data;
}

/**
 * Performance monitoring middleware for compression
 */
export function compressionMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Store original end method
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Log compression metrics
      const contentLength = res.getHeader('content-length');
      const contentEncoding = res.getHeader('content-encoding');
      const compressionRatio = res.getHeader('x-compression-ratio');
      
      if (contentEncoding && compressionRatio) {
        console.log(`Compression metrics - Route: ${req.path}, Duration: ${duration}ms, Size: ${contentLength}, Encoding: ${contentEncoding}, Ratio: ${compressionRatio}`);
      }
      
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

export default compressionMiddleware;