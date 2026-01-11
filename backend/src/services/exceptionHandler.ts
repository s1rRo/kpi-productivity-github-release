import { ExceptionType } from '../types';

/**
 * Exception Handler Service
 * Manages exception days and their exclusion from KPI calculations
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

export interface ExceptionData {
  type: ExceptionType;
  note?: string;
  date: Date;
  userId: string;
}

export interface ExceptionTypeInfo {
  type: ExceptionType;
  label: string;
  description: string;
  color: string;
  icon: string;
}

export class ExceptionHandler {
  // Predefined exception types (requirement 9.3)
  static readonly EXCEPTION_TYPES: ExceptionTypeInfo[] = [
    {
      type: 'illness',
      label: 'Болезнь',
      description: 'Болезнь, плохое самочувствие, восстановление после болезни',
      color: '#ef4444', // red-500
      icon: '🤒'
    },
    {
      type: 'travel',
      label: 'Перелет/Путешествие',
      description: 'Перелеты, смена часовых поясов, путешествия',
      color: '#3b82f6', // blue-500
      icon: '✈️'
    },
    {
      type: 'emergency',
      label: 'Форс-мажор',
      description: 'Экстренные ситуации, неотложные дела, семейные обстоятельства',
      color: '#f59e0b', // amber-500
      icon: '🚨'
    },
    {
      type: 'technical',
      label: 'Технические проблемы',
      description: 'Проблемы с интернетом, поломка оборудования, системные сбои',
      color: '#6b7280', // gray-500
      icon: '🔧'
    }
  ];

  /**
   * Get exception type information
   */
  static getExceptionTypeInfo(type: ExceptionType): ExceptionTypeInfo | undefined {
    return this.EXCEPTION_TYPES.find(et => et.type === type);
  }

  /**
   * Get all available exception types
   */
  static getAllExceptionTypes(): ExceptionTypeInfo[] {
    return this.EXCEPTION_TYPES;
  }

  /**
   * Validate exception data
   */
  static validateExceptionData(data: Partial<ExceptionData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.type) {
      errors.push('Exception type is required');
    } else if (!this.EXCEPTION_TYPES.find(et => et.type === data.type)) {
      errors.push('Invalid exception type');
    }

    if (data.note && data.note.length > 500) {
      errors.push('Exception note cannot exceed 500 characters');
    }

    if (!data.date || isNaN(data.date.getTime())) {
      errors.push('Valid date is required');
    }

    if (!data.userId) {
      errors.push('User ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a date should be excluded from calculations
   * Requirements: 9.1, 9.2
   */
  static shouldExcludeFromCalculations(exceptionType: ExceptionType | null): boolean {
    // All exception types exclude the day from calculations (requirement 9.2)
    return exceptionType !== null;
  }

  /**
   * Get calendar display color for exception days
   * Requirement: 9.4
   */
  static getCalendarColor(exceptionType: ExceptionType | null): string {
    if (!exceptionType) {
      return '#10b981'; // green-500 for normal days
    }

    const typeInfo = this.getExceptionTypeInfo(exceptionType);
    return typeInfo?.color || '#6b7280'; // gray-500 as fallback
  }

  /**
   * Format exception for display
   */
  static formatExceptionDisplay(exceptionType: ExceptionType | null, note?: string): string {
    if (!exceptionType) {
      return '';
    }

    const typeInfo = this.getExceptionTypeInfo(exceptionType);
    const label = typeInfo?.label || exceptionType;
    
    if (note && note.trim()) {
      return `${typeInfo?.icon || '⚠️'} ${label}: ${note}`;
    }
    
    return `${typeInfo?.icon || '⚠️'} ${label}`;
  }

  /**
   * Calculate statistics excluding exception days
   * Requirement: 9.2
   */
  static calculateStatsExcludingExceptions<T>(
    records: Array<T & { exceptionType?: ExceptionType | null | undefined }>,
    calculator: (validRecords: T[]) => any
  ): any {
    // Filter out exception days completely (requirement 9.2)
    const validRecords = records.filter(record => !this.shouldExcludeFromCalculations(record.exceptionType || null));
    
    return calculator(validRecords);
  }

  /**
   * Get exception summary for a period
   */
  static getExceptionSummary(
    records: Array<{ exceptionType?: ExceptionType | null; date: Date }>
  ): {
    totalExceptionDays: number;
    exceptionsByType: Record<ExceptionType, number>;
    exceptionDates: Date[];
  } {
    const exceptionRecords = records.filter(r => r.exceptionType);
    
    const exceptionsByType = exceptionRecords.reduce((acc, record) => {
      if (record.exceptionType) {
        acc[record.exceptionType] = (acc[record.exceptionType] || 0) + 1;
      }
      return acc;
    }, {} as Record<ExceptionType, number>);

    return {
      totalExceptionDays: exceptionRecords.length,
      exceptionsByType,
      exceptionDates: exceptionRecords.map(r => r.date)
    };
  }

  /**
   * Validate exception note content
   */
  static validateExceptionNote(note: string): { isValid: boolean; error?: string } {
    if (!note) {
      return { isValid: true };
    }

    if (note.length > 500) {
      return { 
        isValid: false, 
        error: 'Exception note cannot exceed 500 characters' 
      };
    }

    // Basic content validation - no harmful content
    const forbiddenPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(note)) {
        return { 
          isValid: false, 
          error: 'Exception note contains invalid content' 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate exception report for analytics
   */
  static generateExceptionReport(
    records: Array<{ 
      date: Date; 
      exceptionType?: ExceptionType | null; 
      exceptionNote?: string | null;
      totalKpi?: number | null;
    }>,
    startDate: Date,
    endDate: Date
  ): {
    period: { start: Date; end: Date };
    totalDays: number;
    validDays: number;
    exceptionDays: number;
    exceptionRate: number;
    exceptionsByType: Array<{
      type: ExceptionType;
      count: number;
      percentage: number;
      info: ExceptionTypeInfo;
    }>;
    averageKpiExcludingExceptions: number;
  } {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const exceptionRecords = records.filter(r => r.exceptionType);
    const validRecords = records.filter(r => !r.exceptionType && r.totalKpi !== null);
    
    const exceptionsByType = this.EXCEPTION_TYPES.map(typeInfo => {
      const count = exceptionRecords.filter(r => r.exceptionType === typeInfo.type).length;
      return {
        type: typeInfo.type,
        count,
        percentage: totalDays > 0 ? (count / totalDays) * 100 : 0,
        info: typeInfo
      };
    }).filter(item => item.count > 0);

    const averageKpiExcludingExceptions = validRecords.length > 0
      ? validRecords.reduce((sum, r) => sum + (r.totalKpi || 0), 0) / validRecords.length
      : 0;

    return {
      period: { start: startDate, end: endDate },
      totalDays,
      validDays: validRecords.length,
      exceptionDays: exceptionRecords.length,
      exceptionRate: totalDays > 0 ? (exceptionRecords.length / totalDays) * 100 : 0,
      exceptionsByType,
      averageKpiExcludingExceptions
    };
  }
}