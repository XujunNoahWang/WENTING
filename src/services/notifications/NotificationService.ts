import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  Reminder,
  ReminderType,
  ScheduleData,
  NotificationPayload,
  User,
  ApiResponse,
  WeatherData,
} from '@types/index';
import { NOTIFICATION_CHANNELS, ERROR_MESSAGES } from '@constants/index';
import DatabaseService from '@services/database/DatabaseService';
import GeminiService from '@services/gemini/GeminiService';
import EncryptedStorage from 'react-native-encrypted-storage';

export class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service
   */
  async initialize(): Promise<ApiResponse<boolean>> {
    try {
      if (this.isInitialized) {
        return { success: true, data: true };
      }

      // Request permissions
      const permissionResult = await this.requestPermissions();
      if (!permissionResult.success) {
        return permissionResult;
      }

      // Configure PushNotification
      this.configurePushNotification();

      // Setup Firebase messaging
      await this.setupFirebaseMessaging();

      this.isInitialized = true;

      return {
        success: true,
        data: true,
        message: '通知服务已初始化'
      };

    } catch (error: any) {
      console.error('Notification service initialization error:', error);
      return {
        success: false,
        error: error.message || '通知服务初始化失败'
      };
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<ApiResponse<boolean>> {
    try {
      if (Platform.OS === 'android') {
        // Request Android notification permission (API level 33+)
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return {
              success: false,
              error: '需要通知权限才能发送提醒'
            };
          }
        }
      }

      // Request Firebase messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        return {
          success: false,
          error: '用户拒绝了通知权限'
        };
      }

      return {
        success: true,
        data: true
      };

    } catch (error: any) {
      console.error('Request permissions error:', error);
      return {
        success: false,
        error: error.message || '权限请求失败'
      };
    }
  }

  /**
   * Configure PushNotification
   */
  private configurePushNotification(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
      },

      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
      },

      onAction: (notification) => {
        console.log('Notification action:', notification);
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (error) => {
        console.error('Push notification registration error:', error);
      },

      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    this.createNotificationChannels();
  }

  /**
   * Create notification channels (Android)
   */
  private createNotificationChannels(): void {
    Object.values(NOTIFICATION_CHANNELS).forEach(channel => {
      PushNotification.createChannel(
        {
          channelId: channel.id,
          channelName: channel.name,
          channelDescription: channel.description,
          soundName: 'default',
          importance: channel.importance === 'high' ? 4 : 3,
          vibrate: channel.importance === 'high',
        },
        (created) => console.log(`Channel ${channel.id} created:`, created)
      );
    });
  }

  /**
   * Setup Firebase messaging
   */
  private async setupFirebaseMessaging(): Promise<void> {
    try {
      // Get FCM token
      const token = await messaging().getToken();
      console.log('FCM Token:', token);

      // Store token for backend use
      await EncryptedStorage.setItem('fcm_token', token);

      // Handle token refresh
      messaging().onTokenRefresh(async (newToken) => {
        console.log('FCM Token refreshed:', newToken);
        await EncryptedStorage.setItem('fcm_token', newToken);
      });

      // Handle foreground messages
      messaging().onMessage(async (remoteMessage) => {
        console.log('Foreground message:', remoteMessage);
        this.showLocalNotification(remoteMessage);
      });

      // Handle background messages
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Background message:', remoteMessage);
      });

    } catch (error) {
      console.error('Firebase messaging setup error:', error);
    }
  }

  /**
   * Schedule medication reminder
   */
  async scheduleMedicationReminder(reminder: Reminder): Promise<ApiResponse<void>> {
    try {
      const notificationUsers = reminder.notificationUsers || [reminder.userId];
      
      for (const userId of notificationUsers) {
        const user = await DatabaseService.getUserById(userId);
        if (!user) continue;

        // Generate reminder text using AI
        let reminderText = reminder.description || `提醒服用${reminder.title}`;
        
        if (reminder.healthRecordId) {
          const encryptionKey = EncryptionManager.generateUserKey(userId);
          const healthRecord = await DatabaseService.getHealthRecordById(
            reminder.healthRecordId, encryptionKey
          );
          
          if (healthRecord?.recordData?.medication) {
            const aiResponse = await GeminiService.generateMedicationReminder(
              healthRecord.recordData.medication,
              user.fullName,
              this.getTimeOfDay()
            );
            
            if (aiResponse.success) {
              reminderText = aiResponse.data!;
            }
          }
        }

        // Schedule notification
        const notifications = this.calculateNotificationTimes(reminder.scheduleData);
        
        notifications.forEach((notificationTime, index) => {
          PushNotification.localNotificationSchedule({
            id: `${reminder.id}_${userId}_${index}`,
            channelId: NOTIFICATION_CHANNELS.MEDICATIONS.id,
            title: '用药提醒',
            message: reminderText,
            date: new Date(notificationTime),
            repeatType: this.getRepeatType(reminder.scheduleData),
            actions: ['已服药', '稍后提醒', '查看详情'],
            userInfo: {
              reminderId: reminder.id,
              userId: userId,
              householdId: reminder.householdId,
              type: 'medication',
              healthRecordId: reminder.healthRecordId,
            },
            playSound: true,
            soundName: 'default',
            importance: 'high',
            vibrate: true,
          });
        });
      }

      return {
        success: true,
        message: '用药提醒已设置'
      };

    } catch (error: any) {
      console.error('Schedule medication reminder error:', error);
      return {
        success: false,
        error: error.message || '设置用药提醒失败'
      };
    }
  }

  /**
   * Schedule appointment reminder
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    userId: string,
    appointmentDate: string,
    title: string,
    description?: string
  ): Promise<ApiResponse<void>> {
    try {
      const appointmentTime = new Date(appointmentDate);
      
      // Schedule multiple reminders: 1 day before, 1 hour before
      const reminderTimes = [
        new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        new Date(appointmentTime.getTime() - 60 * 60 * 1000), // 1 hour before
      ];

      reminderTimes.forEach((reminderTime, index) => {
        if (reminderTime > new Date()) { // Only schedule future reminders
          const timeDescription = index === 0 ? '明天' : '1小时后';
          
          PushNotification.localNotificationSchedule({
            id: `appointment_${appointmentId}_${index}`,
            channelId: NOTIFICATION_CHANNELS.APPOINTMENTS.id,
            title: '预约提醒',
            message: `${timeDescription}您有${title}预约${description ? `：${description}` : ''}`,
            date: reminderTime,
            actions: ['查看详情', '推迟提醒'],
            userInfo: {
              appointmentId,
              userId,
              type: 'appointment',
            },
            playSound: true,
            soundName: 'default',
            importance: 'high',
          });
        }
      });

      return {
        success: true,
        message: '预约提醒已设置'
      };

    } catch (error: any) {
      console.error('Schedule appointment reminder error:', error);
      return {
        success: false,
        error: error.message || '设置预约提醒失败'
      };
    }
  }

  /**
   * Send contextual health alert
   */
  async sendHealthAlert(
    users: User[],
    alertType: string,
    content: string,
    weatherData?: WeatherData
  ): Promise<ApiResponse<void>> {
    try {
      for (const user of users) {
        // Get user's health conditions for personalized alerts
        const userConditions = await this.getUserHealthConditions(user.id);
        
        // Generate personalized health tip if weather data is available
        let alertContent = content;
        if (weatherData && userConditions.length > 0) {
          const tipResponse = await GeminiService.generateHealthTip(
            userConditions,
            weatherData
          );
          
          if (tipResponse.success) {
            alertContent = tipResponse.data!;
          }
        }

        // Send local notification
        PushNotification.localNotification({
          id: `health_alert_${user.id}_${Date.now()}`,
          channelId: NOTIFICATION_CHANNELS.HEALTH_TIPS.id,
          title: this.getAlertTitle(alertType),
          message: alertContent,
          userInfo: {
            userId: user.id,
            alertType,
            type: 'health_alert',
          },
          playSound: false, // Health tips are usually not urgent
          importance: 'default',
        });

        // Also send FCM message if available
        await this.sendFCMMessage(user.id, {
          title: this.getAlertTitle(alertType),
          body: alertContent,
          data: {
            alertType,
            type: 'health_alert',
          },
        });
      }

      return {
        success: true,
        message: '健康提醒已发送'
      };

    } catch (error: any) {
      console.error('Send health alert error:', error);
      return {
        success: false,
        error: error.message || '发送健康提醒失败'
      };
    }
  }

  /**
   * Cancel scheduled reminder
   */
  async cancelReminder(reminderId: string): Promise<ApiResponse<void>> {
    try {
      // Get all scheduled notifications for this reminder
      PushNotification.getScheduledLocalNotifications((notifications) => {
        notifications.forEach((notification) => {
          if (notification.id.toString().startsWith(reminderId)) {
            PushNotification.cancelLocalNotifications({ id: notification.id.toString() });
          }
        });
      });

      return {
        success: true,
        message: '提醒已取消'
      };

    } catch (error: any) {
      console.error('Cancel reminder error:', error);
      return {
        success: false,
        error: error.message || '取消提醒失败'
      };
    }
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(): Promise<ApiResponse<any[]>> {
    return new Promise((resolve) => {
      PushNotification.getScheduledLocalNotifications((notifications) => {
        resolve({
          success: true,
          data: notifications
        });
      });
    });
  }

  /**
   * Send FCM message to specific user
   */
  private async sendFCMMessage(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      // In a real app, this would call your backend API to send FCM message
      // The backend would look up the user's FCM token and send the message
      console.log(`Would send FCM message to user ${userId}:`, payload);
    } catch (error) {
      console.error('Send FCM message error:', error);
    }
  }

  /**
   * Show local notification for received FCM message
   */
  private showLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    const { notification, data } = remoteMessage;
    
    if (notification) {
      PushNotification.localNotification({
        id: data?.id || Date.now().toString(),
        title: notification.title || 'WENTING',
        message: notification.body || '',
        userInfo: data,
        playSound: true,
        soundName: 'default',
        importance: 'high',
        channelId: this.getChannelIdForType(data?.type || 'general'),
      });
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: any): void {
    const { userInfo } = notification;
    
    // Navigate to appropriate screen based on notification type
    switch (userInfo?.type) {
      case 'medication':
        // Navigate to medication details
        console.log('Navigate to medication:', userInfo.healthRecordId);
        break;
      case 'appointment':
        // Navigate to appointment details
        console.log('Navigate to appointment:', userInfo.appointmentId);
        break;
      case 'health_alert':
        // Navigate to health tips or dashboard
        console.log('Navigate to health dashboard');
        break;
      default:
        console.log('Navigate to home screen');
    }
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(notification: any): void {
    const { action, userInfo } = notification;
    
    switch (action) {
      case '已服药':
        this.markMedicationTaken(userInfo.reminderId, userInfo.userId);
        break;
      case '稍后提醒':
        this.snoozeReminder(userInfo.reminderId, 30); // 30 minutes
        break;
      case '查看详情':
        this.handleNotificationTap(notification);
        break;
      case '推迟提醒':
        this.snoozeReminder(userInfo.appointmentId, 60); // 1 hour
        break;
    }
  }

  /**
   * Mark medication as taken
   */
  private async markMedicationTaken(reminderId: string, userId: string): Promise<void> {
    try {
      // Record medication adherence in database
      await DatabaseService.recordMedicationAdherence(reminderId, userId, new Date());
      console.log('Medication marked as taken:', reminderId);
    } catch (error) {
      console.error('Mark medication taken error:', error);
    }
  }

  /**
   * Snooze reminder
   */
  private snoozeReminder(reminderId: string, minutes: number): void {
    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);
    
    PushNotification.localNotificationSchedule({
      id: `${reminderId}_snooze_${Date.now()}`,
      title: '提醒',
      message: '您之前推迟的提醒',
      date: snoozeTime,
      playSound: true,
      soundName: 'default',
      importance: 'high',
    });
  }

  /**
   * Utility methods
   */
  private calculateNotificationTimes(scheduleData: ScheduleData): number[] {
    const times: number[] = [];
    const now = new Date();
    const startDate = new Date(scheduleData.startDate);
    const endDate = scheduleData.endDate ? new Date(scheduleData.endDate) : null;

    // Parse time (HH:mm)
    const [hours, minutes] = scheduleData.time.split(':').map(Number);

    switch (scheduleData.frequency) {
      case 'daily':
        for (let date = new Date(startDate); (!endDate || date <= endDate); date.setDate(date.getDate() + 1)) {
          if (date > now) {
            const notificationTime = new Date(date);
            notificationTime.setHours(hours, minutes, 0, 0);
            times.push(notificationTime.getTime());
          }
        }
        break;
      case 'weekly':
        if (scheduleData.days) {
          // Weekly reminders on specific days
          for (let week = 0; week < 52; week++) { // Max 1 year
            scheduleData.days.forEach(dayOfWeek => {
              const notificationDate = new Date(startDate);
              notificationDate.setDate(startDate.getDate() + week * 7 + (dayOfWeek - startDate.getDay()));
              notificationDate.setHours(hours, minutes, 0, 0);
              
              if (notificationDate > now && (!endDate || notificationDate <= endDate)) {
                times.push(notificationDate.getTime());
              }
            });
          }
        }
        break;
      case 'once':
        const onceTime = new Date(startDate);
        onceTime.setHours(hours, minutes, 0, 0);
        if (onceTime > now) {
          times.push(onceTime.getTime());
        }
        break;
    }

    return times.slice(0, 50); // Limit to 50 notifications
  }

  private getRepeatType(scheduleData: ScheduleData): string {
    switch (scheduleData.frequency) {
      case 'daily':
        return 'day';
      case 'weekly':
        return 'week';
      default:
        return 'none';
    }
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private getAlertTitle(alertType: string): string {
    const titleMap: Record<string, string> = {
      weather: '天气健康提醒',
      seasonal: '季节健康提醒',
      medication: '用药提醒',
      checkup: '体检提醒',
      emergency: '紧急健康提醒',
    };
    
    return titleMap[alertType] || '健康提醒';
  }

  private getChannelIdForType(type: string): string {
    const channelMap: Record<string, string> = {
      medication: NOTIFICATION_CHANNELS.MEDICATIONS.id,
      appointment: NOTIFICATION_CHANNELS.APPOINTMENTS.id,
      health_alert: NOTIFICATION_CHANNELS.HEALTH_TIPS.id,
    };
    
    return channelMap[type] || NOTIFICATION_CHANNELS.GENERAL.id;
  }

  private async getUserHealthConditions(userId: string): Promise<string[]> {
    try {
      const encryptionKey = EncryptionManager.generateUserKey(userId);
      const healthRecords = await DatabaseService.getHealthRecordsByUserId(userId, encryptionKey);
      
      const conditions: string[] = [];
      healthRecords.forEach(record => {
        if (record.recordType === 'diagnosis' && record.recordData.diagnosis) {
          conditions.push(record.recordData.diagnosis.condition);
        }
      });
      
      return [...new Set(conditions)]; // Remove duplicates
    } catch (error) {
      console.error('Get user health conditions error:', error);
      return [];
    }
  }
}

export default NotificationService.getInstance();