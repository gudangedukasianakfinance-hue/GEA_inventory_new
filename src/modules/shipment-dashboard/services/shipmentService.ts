/**
 * Shipment Service
 * Handles data fetching from Google Apps Script API via Vercel proxy
 * with 5-minute caching
 */

// Use Vercel API proxy to avoid CORS issues
const API_PROXY_URL = '/api/shipment';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ShipmentRecord {
  no?: number | string;
  tanggal?: string;
  no_surat_jalan?: string;
  kode_outlet?: string;
  nama_outlet?: string;
  ekspedisi?: string;
  no_resi?: string;
  nama_produk?: string;
  qty?: number;
  harga_otr?: number;
  total_otr?: number;
  status?: string;
}

interface ShipmentData {
  headers: string[];
  data: ShipmentRecord[];
  lastUpdated?: string;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}

class ShipmentService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_DURATION;
  }

  /**
   * Get cached data if valid
   */
  private getCachedData<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      const entry = this.cache.get(key) as CacheEntry<T>;
      return entry.data;
    }
    return null;
  }

  /**
   * Set data to cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear specific cache entry
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Fetch data from Google Apps Script API
   */
  async fetchShipmentData(forceRefresh = false): Promise<ServiceResponse<ShipmentData>> {
    const cacheKey = 'shipment_data';

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      const cachedData = this.getCachedData<ShipmentData>(cacheKey);
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          fromCache: true
        };
      }
    }

    try {
      const response = await fetch(API_PROXY_URL);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      
      // Transform data to standard format
      const shipmentData = this.transformData(rawData);
      
      // Cache the result
      this.setCache(cacheKey, shipmentData);
      
      return {
        success: true,
        data: shipmentData,
        fromCache: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error fetching shipment data:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Transform raw API response to standard format
   */
  private transformData(rawData: unknown): ShipmentData {
    // Handle different response formats
    if (Array.isArray(rawData)) {
      // Direct array format
      return {
        headers: rawData.length > 0 ? Object.keys(rawData[0]) : [],
        data: rawData as ShipmentRecord[]
      };
    }

    if (rawData && typeof rawData === 'object') {
      const obj = rawData as Record<string, unknown>;
      
      // Check for data property
      if (Array.isArray(obj.data)) {
        return {
          headers: obj.headers ? (obj.headers as string[]) : (obj.data.length > 0 ? Object.keys(obj.data[0]) : []),
          data: obj.data as ShipmentRecord[],
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Check for values property (Google Sheets format)
      if (Array.isArray(obj.values)) {
        const values = obj.values as unknown[][];
        if (values.length > 1) {
          const headers = values[0].map(h => String(h));
          const rows = values.slice(1).map(row => {
            const record: ShipmentRecord = {};
            headers.forEach((header, index) => {
              const key = this.normalizeHeader(header);
              record[key] = row[index];
            });
            return record;
          });
          return {
            headers,
            data: rows,
            lastUpdated: new Date().toISOString()
          };
        }
        return { headers: [], data: [], lastUpdated: new Date().toISOString() };
      }

      // Check for table property
      if (Array.isArray(obj.table)) {
        return {
          headers: Object.keys(obj.table[0] || {}),
          data: obj.table as ShipmentRecord[],
          lastUpdated: new Date().toISOString()
        };
      }
    }

    // Return empty data structure
    return {
      headers: [],
      data: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Normalize header names to snake_case
   */
  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { isValid: boolean; remainingTime?: number } {
    const cacheKey = 'shipment_data';
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return { isValid: false };
    }
    
    const elapsed = Date.now() - entry.timestamp;
    const remaining = CACHE_DURATION - elapsed;
    
    return {
      isValid: remaining > 0,
      remainingTime: remaining > 0 ? Math.ceil(remaining / 1000) : 0
    };
  }
}

// Export singleton instance
export const shipmentService = new ShipmentService();

// Export types
export type { ShipmentRecord, ShipmentData, ServiceResponse };
