// 性能监控工具
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private timers = new Map<string, number>();
  private metrics = new Map<string, number[]>();

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 开始计时
  startTimer(label: string): void {
    this.timers.set(label, Date.now());
    console.log(`⏱️ [Performance] Started: ${label}`);
  }

  // 结束计时并记录
  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`⚠️ [Performance] Timer not found: ${label}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    // 记录到历史数据
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    console.log(`✅ [Performance] Completed: ${label} - ${duration}ms`);
    return duration;
  }

  // 获取平均性能
  getAverageTime(label: string): number {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return 0;

    const sum = times.reduce((a, b) => a + b, 0);
    return Math.round(sum / times.length);
  }

  // 获取性能报告
  getReport(): Record<string, { average: number, count: number, latest: number }> {
    const report: Record<string, { average: number, count: number, latest: number }> = {};

    for (const [label, times] of this.metrics.entries()) {
      if (times.length > 0) {
        report[label] = {
          average: this.getAverageTime(label),
          count: times.length,
          latest: times[times.length - 1]
        };
      }
    }

    return report;
  }

  // 打印性能报告
  printReport(): void {
    const report = this.getReport();
    console.log('📊 [Performance Report]');
    console.table(report);
  }

  // 清除所有数据
  clear(): void {
    this.timers.clear();
    this.metrics.clear();
    console.log('🧹 [Performance] Cleared all metrics');
  }
}

// 便捷的装饰器函数
export function measurePerformance(label: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitor = PerformanceMonitor.getInstance();
      monitor.startTimer(label);
      
      try {
        const result = await method.apply(this, args);
        monitor.endTimer(label);
        return result;
      } catch (error) {
        monitor.endTimer(label);
        throw error;
      }
    };
  };
}

// 全局性能监控实例
export const performanceMonitor = PerformanceMonitor.getInstance();