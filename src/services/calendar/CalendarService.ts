import {
  HealthCalendarEvent,
  AppointmentType,
  DoctorInfo,
  User,
  UserRole,
  ApiResponse,
} from '@types/index';
import DatabaseService from '@services/database/DatabaseService';
import NotificationService from '@services/notifications/NotificationService';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@constants/index';

export class CalendarService {
  private static instance: CalendarService;

  private constructor() {}

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  /**
   * Create a new health calendar event
   */
  async createCalendarEvent(
    eventData: Omit<HealthCalendarEvent, 'id' | 'createdAt'>,
    createdByUserId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthCalendarEvent>> {
    try {
      // Check permissions
      const canCreate = await this.checkCreatePermission(
        eventData.householdId,
        eventData.userId,
        createdByUserId,
        userRole
      );

      if (!canCreate.success) {
        return canCreate;
      }

      // Generate event ID
      const eventId = this.generateEventId();

      const calendarEvent: Omit<HealthCalendarEvent, 'createdAt'> = {
        ...eventData,
        id: eventId,
        createdBy: createdByUserId,
      };

      // Save to database
      await DatabaseService.createCalendarEvent(calendarEvent);

      // Schedule appointment reminders
      await NotificationService.scheduleAppointmentReminder(
        eventId,
        eventData.userId,
        eventData.scheduledDate,
        eventData.title,
        eventData.description
      );

      // Get the created event
      const createdEvent = await DatabaseService.getCalendarEventById(eventId);

      if (!createdEvent) {
        return {
          success: false,
          error: '日历事件创建失败'
        };
      }

      return {
        success: true,
        data: createdEvent,
        message: '健康日历事件已创建'
      };

    } catch (error: any) {
      console.error('Create calendar event error:', error);
      return {
        success: false,
        error: error.message || '创建日历事件失败'
      };
    }
  }

  /**
   * Get calendar events for a household
   */
  async getCalendarEvents(
    householdId: string,
    userId: string,
    userRole: UserRole,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<HealthCalendarEvent[]>> {
    try {
      const events = await DatabaseService.getCalendarEvents(
        householdId,
        userId,
        userRole,
        startDate,
        endDate
      );

      return {
        success: true,
        data: events
      };

    } catch (error: any) {
      console.error('Get calendar events error:', error);
      return {
        success: false,
        error: error.message || '获取日历事件失败'
      };
    }
  }

  /**
   * Get calendar event by ID
   */
  async getCalendarEventById(
    eventId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthCalendarEvent>> {
    try {
      const event = await DatabaseService.getCalendarEventById(eventId);

      if (!event) {
        return {
          success: false,
          error: '日历事件不存在'
        };
      }

      // Check view permissions
      const canView = await this.checkViewPermission(event, userId, userRole);
      if (!canView) {
        return {
          success: false,
          error: '没有权限查看此日历事件'
        };
      }

      return {
        success: true,
        data: event
      };

    } catch (error: any) {
      console.error('Get calendar event error:', error);
      return {
        success: false,
        error: error.message || '获取日历事件失败'
      };
    }
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(
    eventId: string,
    updates: Partial<HealthCalendarEvent>,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthCalendarEvent>> {
    try {
      // Get existing event
      const existingEvent = await this.getCalendarEventById(eventId, userId, userRole);
      
      if (!existingEvent.success || !existingEvent.data) {
        return existingEvent;
      }

      // Check update permissions
      const canUpdate = await this.checkUpdatePermission(existingEvent.data, userId, userRole);
      if (!canUpdate) {
        return {
          success: false,
          error: '没有权限修改此日历事件'
        };
      }

      // Update the event
      await DatabaseService.updateCalendarEvent(eventId, updates);

      // If scheduled date changed, update reminders
      if (updates.scheduledDate) {
        await NotificationService.cancelReminder(`appointment_${eventId}`);
        await NotificationService.scheduleAppointmentReminder(
          eventId,
          existingEvent.data.userId,
          updates.scheduledDate,
          updates.title || existingEvent.data.title,
          updates.description || existingEvent.data.description
        );
      }

      // Get updated event
      const updatedEvent = await this.getCalendarEventById(eventId, userId, userRole);

      return {
        success: true,
        data: updatedEvent.data!,
        message: '日历事件已更新'
      };

    } catch (error: any) {
      console.error('Update calendar event error:', error);
      return {
        success: false,
        error: error.message || '更新日历事件失败'
      };
    }
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(
    eventId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<void>> {
    try {
      // Get existing event to check permissions
      const existingEvent = await this.getCalendarEventById(eventId, userId, userRole);
      
      if (!existingEvent.success || !existingEvent.data) {
        return {
          success: false,
          error: '日历事件不存在'
        };
      }

      // Check delete permissions
      const canDelete = await this.checkDeletePermission(existingEvent.data, userId, userRole);
      if (!canDelete) {
        return {
          success: false,
          error: '没有权限删除此日历事件'
        };
      }

      // Cancel associated reminders
      await NotificationService.cancelReminder(`appointment_${eventId}`);

      // Delete the event
      await DatabaseService.deleteCalendarEvent(eventId);

      return {
        success: true,
        message: '日历事件已删除'
      };

    } catch (error: any) {
      console.error('Delete calendar event error:', error);
      return {
        success: false,
        error: error.message || '删除日历事件失败'
      };
    }
  }

  /**
   * Get upcoming appointments for a user
   */
  async getUpcomingAppointments(
    userId: string,
    userRole: UserRole,
    days: number = 7
  ): Promise<ApiResponse<HealthCalendarEvent[]>> {
    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const events = await DatabaseService.getUpcomingCalendarEvents(
        userId,
        userRole,
        startDate,
        endDate
      );

      return {
        success: true,
        data: events
      };

    } catch (error: any) {
      console.error('Get upcoming appointments error:', error);
      return {
        success: false,
        error: error.message || '获取即将到来的预约失败'
      };
    }
  }

  /**
   * Check for scheduling conflicts
   */
  async checkSchedulingConflicts(
    userId: string,
    scheduledDate: string,
    duration: number = 60 // minutes
  ): Promise<ApiResponse<HealthCalendarEvent[]>> {
    try {
      const appointmentStart = new Date(scheduledDate);
      const appointmentEnd = new Date(appointmentStart.getTime() + duration * 60 * 1000);

      // Get events on the same day
      const dayStart = new Date(appointmentStart);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(appointmentStart);
      dayEnd.setHours(23, 59, 59, 999);

      const existingEvents = await DatabaseService.getCalendarEventsByDateRange(
        userId,
        dayStart.toISOString(),
        dayEnd.toISOString()
      );

      // Check for conflicts
      const conflicts = existingEvents.filter(event => {
        const eventStart = new Date(event.scheduledDate);
        const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // Assume 1 hour duration

        return (
          (appointmentStart >= eventStart && appointmentStart < eventEnd) ||
          (appointmentEnd > eventStart && appointmentEnd <= eventEnd) ||
          (appointmentStart <= eventStart && appointmentEnd >= eventEnd)
        );
      });

      return {
        success: true,
        data: conflicts
      };

    } catch (error: any) {
      console.error('Check scheduling conflicts error:', error);
      return {
        success: false,
        error: error.message || '检查时间冲突失败'
      };
    }
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(
    householdId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<any>> {
    try {
      const events = await this.getCalendarEvents(householdId, userId, userRole);
      
      if (!events.success) {
        return events;
      }

      const allEvents = events.data!;
      const now = new Date();

      const stats = {
        total: allEvents.length,
        upcoming: allEvents.filter(e => new Date(e.scheduledDate) > now).length,
        past: allEvents.filter(e => new Date(e.scheduledDate) <= now).length,
        byType: {} as Record<string, number>,
        thisMonth: allEvents.filter(e => {
          const eventDate = new Date(e.scheduledDate);
          return eventDate.getMonth() === now.getMonth() && 
                 eventDate.getFullYear() === now.getFullYear();
        }).length,
        nextWeek: allEvents.filter(e => {
          const eventDate = new Date(e.scheduledDate);
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return eventDate >= now && eventDate <= nextWeek;
        }).length,
      };

      // Count by appointment type
      allEvents.forEach(event => {
        stats.byType[event.appointmentType] = (stats.byType[event.appointmentType] || 0) + 1;
      });

      return {
        success: true,
        data: stats
      };

    } catch (error: any) {
      console.error('Get calendar stats error:', error);
      return {
        success: false,
        error: error.message || '获取日历统计失败'
      };
    }
  }

  /**
   * Export calendar events
   */
  async exportCalendarEvents(
    householdId: string,
    userId: string,
    userRole: UserRole,
    format: 'json' | 'csv' | 'ical' = 'json'
  ): Promise<ApiResponse<string>> {
    try {
      const events = await this.getCalendarEvents(householdId, userId, userRole);
      
      if (!events.success) {
        return events;
      }

      const allEvents = events.data!;
      let exportString = '';

      switch (format) {
        case 'json':
          exportString = JSON.stringify(allEvents, null, 2);
          break;
          
        case 'csv':
          const headers = ['Title', 'Type', 'Date', 'Location', 'Description'];
          const rows = allEvents.map(event => [
            event.title,
            event.appointmentType,
            event.scheduledDate,
            event.location || '',
            event.description || '',
          ]);
          exportString = [headers, ...rows].map(row => row.join(',')).join('\n');
          break;
          
        case 'ical':
          exportString = this.generateICalendar(allEvents);
          break;
      }

      return {
        success: true,
        data: exportString,
        message: '日历事件已导出'
      };

    } catch (error: any) {
      console.error('Export calendar events error:', error);
      return {
        success: false,
        error: error.message || '导出日历事件失败'
      };
    }
  }

  /**
   * Sync with Google Calendar (placeholder for future implementation)
   */
  async syncWithGoogleCalendar(
    userId: string,
    calendarId: string
  ): Promise<ApiResponse<void>> {
    try {
      // This would be implemented with Google Calendar API
      // For now, just return a placeholder response
      
      console.log(`Syncing calendar for user ${userId} with Google Calendar ${calendarId}`);
      
      return {
        success: true,
        message: 'Google Calendar同步功能正在开发中'
      };

    } catch (error: any) {
      console.error('Google Calendar sync error:', error);
      return {
        success: false,
        error: error.message || 'Google Calendar同步失败'
      };
    }
  }

  /**
   * Permission checking methods
   */
  private async checkCreatePermission(
    householdId: string,
    targetUserId: string,
    createdByUserId: string,
    userRole: UserRole
  ): Promise<ApiResponse<boolean>> {
    // Admin can create events for anyone in the household
    if (userRole === UserRole.ADMIN) {
      return { success: true, data: true };
    }

    // Members can only create events for themselves
    if (targetUserId === createdByUserId) {
      return { success: true, data: true };
    }

    return {
      success: false,
      error: '没有权限为其他用户创建日历事件'
    };
  }

  private async checkViewPermission(
    event: HealthCalendarEvent,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can view all events in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only view their own events
    return event.userId === userId;
  }

  private async checkUpdatePermission(
    event: HealthCalendarEvent,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can update all events in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only update their own events
    return event.userId === userId;
  }

  private async checkDeletePermission(
    event: HealthCalendarEvent,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can delete all events in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only delete their own events
    return event.userId === userId;
  }

  /**
   * Utility methods
   */
  private generateEventId(): string {
    return `calendar_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateICalendar(events: HealthCalendarEvent[]): string {
    let ical = 'BEGIN:VCALENDAR\n';
    ical += 'VERSION:2.0\n';
    ical += 'PRODID:-//WENTING//Health Calendar//EN\n';
    ical += 'CALSCALE:GREGORIAN\n';

    events.forEach(event => {
      const startDate = new Date(event.scheduledDate);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      ical += 'BEGIN:VEVENT\n';
      ical += `UID:${event.id}@wenting.app\n`;
      ical += `DTSTART:${this.formatICalDate(startDate)}\n`;
      ical += `DTEND:${this.formatICalDate(endDate)}\n`;
      ical += `SUMMARY:${event.title}\n`;
      
      if (event.description) {
        ical += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
      }
      
      if (event.location) {
        ical += `LOCATION:${event.location}\n`;
      }
      
      ical += `CATEGORIES:${event.appointmentType.toUpperCase()}\n`;
      ical += 'END:VEVENT\n';
    });

    ical += 'END:VCALENDAR\n';
    return ical;
  }

  private formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
}

export default CalendarService.getInstance();