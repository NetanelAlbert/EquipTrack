/**
 * Performance monitoring utility for inventory components
 * Tracks rendering performance, memory usage, and user interactions
 */

export interface PerformanceMetrics {
  renderTime: number;
  itemCount: number;
  interactionLatency: number;
  memoryUsage?: number;
  timestamp: number;
}

export interface SearchPerformanceMetrics extends PerformanceMetrics {
  searchTermLength: number;
  filteredResultCount: number;
  searchDuration: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private searchMetrics: SearchPerformanceMetrics[] = [];
  private isEnabled = false;

  constructor() {
    // Enable performance monitoring in development or when query param is present
    this.isEnabled = !this.isProduction() || this.hasPerformanceFlag();
  }

  /**
   * Start measuring render performance
   */
  startRenderMeasure(measureId: string): void {
    if (!this.isEnabled) return;

    if (performance.mark) {
      performance.mark(`${measureId}-start`);
    }
  }

  /**
   * End render measurement and record metrics
   */
  endRenderMeasure(measureId: string, itemCount: number): number {
    if (!this.isEnabled) return 0;

    let renderTime = 0;

    if (performance.mark && performance.measure) {
      try {
        performance.mark(`${measureId}-end`);
        performance.measure(
          measureId,
          `${measureId}-start`,
          `${measureId}-end`
        );

        const measure = performance.getEntriesByName(measureId)[0];
        renderTime = measure.duration;

        this.recordMetrics({
          renderTime,
          itemCount,
          interactionLatency: 0,
          memoryUsage: this.getMemoryUsage(),
          timestamp: Date.now(),
        });

        // Clean up performance entries
        performance.clearMarks(`${measureId}-start`);
        performance.clearMarks(`${measureId}-end`);
        performance.clearMeasures(measureId);
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }

    return renderTime;
  }

  /**
   * Measure search performance
   */
  measureSearchPerformance(
    searchTerm: string,
    totalItems: number,
    filteredCount: number,
    startTime: number
  ): void {
    if (!this.isEnabled) return;

    const searchDuration = performance.now() - startTime;

    const searchMetric: SearchPerformanceMetrics = {
      renderTime: 0,
      itemCount: totalItems,
      interactionLatency: 0,
      searchTermLength: searchTerm.length,
      filteredResultCount: filteredCount,
      searchDuration,
      timestamp: Date.now(),
    };

    this.searchMetrics.push(searchMetric);
    this.limitMetricsHistory();
  }

  /**
   * Measure interaction latency (e.g., expand/collapse, button clicks)
   */
  measureInteraction(startTime: number, actionType: string): number {
    if (!this.isEnabled) return 0;

    const latency = performance.now() - startTime;

    // Log slow interactions for debugging
    if (latency > 100) {
      console.warn(`Slow ${actionType} interaction: ${latency.toFixed(2)}ms`);
    }

    return latency;
  }

  /**
   * Get current memory usage (if available)
   */
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const perfMemory = (performance as any).memory;
      return perfMemory?.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    this.limitMetricsHistory();

    // Log performance warnings
    if (metrics.renderTime > 100) {
      console.warn(
        `Slow render detected: ${metrics.renderTime.toFixed(2)}ms for ${
          metrics.itemCount
        } items`
      );
    }
  }

  /**
   * Keep only recent metrics to prevent memory leaks
   */
  private limitMetricsHistory(): void {
    const maxHistory = 100;
    if (this.metrics.length > maxHistory) {
      this.metrics = this.metrics.slice(-maxHistory);
    }
    if (this.searchMetrics.length > maxHistory) {
      this.searchMetrics = this.searchMetrics.slice(-maxHistory);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    averageRenderTime: number;
    averageSearchTime: number;
    slowestRender: number;
    totalMeasurements: number;
    memoryTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  } {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        averageSearchTime: 0,
        slowestRender: 0,
        totalMeasurements: 0,
        memoryTrend: 'unknown',
      };
    }

    const renderTimes = this.metrics.map((m) => m.renderTime);
    const searchTimes = this.searchMetrics.map((m) => m.searchDuration);

    return {
      averageRenderTime:
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      averageSearchTime:
        searchTimes.length > 0
          ? searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length
          : 0,
      slowestRender: Math.max(...renderTimes),
      totalMeasurements: this.metrics.length,
      memoryTrend: this.getMemoryTrend(),
    };
  }

  /**
   * Analyze memory trend
   */
  private getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
    const recentMetrics = this.metrics.slice(-10);
    const memoryValues = recentMetrics
      .map((m) => m.memoryUsage)
      .filter((m) => m !== undefined) as number[];

    if (memoryValues.length < 3) return 'unknown';

    const first = memoryValues[0];
    const last = memoryValues[memoryValues.length - 1];
    const difference = last - first;
    const threshold = first * 0.1; // 10% threshold

    if (difference > threshold) return 'increasing';
    if (difference < -threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      !window.location.hostname.includes('dev')
    );
  }

  /**
   * Check for performance monitoring flag
   */
  private hasPerformanceFlag(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.location.search.includes('perf=true')
    );
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.searchMetrics = [];
  }

  /**
   * Log current performance stats to console
   */
  logStats(): void {
    if (!this.isEnabled) {
      console.log('Performance monitoring is disabled');
      return;
    }

    const stats = this.getStats();
    console.group('📊 Inventory Performance Stats');
    console.log(`Average render time: ${stats.averageRenderTime.toFixed(2)}ms`);
    console.log(`Average search time: ${stats.averageSearchTime.toFixed(2)}ms`);
    console.log(`Slowest render: ${stats.slowestRender.toFixed(2)}ms`);
    console.log(`Total measurements: ${stats.totalMeasurements}`);
    console.log(`Memory trend: ${stats.memoryTrend}`);
    console.groupEnd();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for components
export const startRender = (componentName: string) =>
  performanceMonitor.startRenderMeasure(componentName);

export const endRender = (componentName: string, itemCount: number) =>
  performanceMonitor.endRenderMeasure(componentName, itemCount);

export const measureSearch = (
  searchTerm: string,
  totalItems: number,
  filteredCount: number,
  startTime: number
) =>
  performanceMonitor.measureSearchPerformance(
    searchTerm,
    totalItems,
    filteredCount,
    startTime
  );

export const measureInteraction = (startTime: number, actionType: string) =>
  performanceMonitor.measureInteraction(startTime, actionType);

export const getPerformanceStats = () => performanceMonitor.getStats();

export const logPerformanceStats = () => performanceMonitor.logStats();

// Expose on window for debugging in development
if (typeof window !== 'undefined' && !performanceMonitor['isProduction']()) {
  (window as any).inventoryPerf = {
    getStats: getPerformanceStats,
    logStats: logPerformanceStats,
    monitor: performanceMonitor,
  };
}
