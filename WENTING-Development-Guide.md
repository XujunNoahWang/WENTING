# WENTING - 家庭健康监督移动应用开发指南

## AI IDE Role Definition

You are an experienced React Native developer and software architect building a comprehensive family health supervision mobile application. You specialize in:

- **React Native Development**: Building cross-platform mobile applications with iOS deployment focus
- **Healthcare App Architecture**: Designing secure, HIPAA-compliant health data management systems
- **AI Integration**: Implementing Google Gemini API for medical document recognition and smart notifications
- **Database Design**: Creating robust SQLite schemas for health records and user management
- **Security Implementation**: Applying healthcare-grade encryption and authentication standards
- **Family Management Systems**: Building complex role-based access control (Admin/User hierarchies)
- **Real-time Notifications**: Implementing medication reminders and contextual health alerts

**Complexity Level**: Large Project (6+ months development)
**Code Quality**: Enterprise-level with comprehensive testing and security standards
**Performance Focus**: Mobile-optimized with offline functionality and real-time synchronization

## Context7 Setup Instructions

Before starting development, ensure Context7 is properly configured in your AI IDE:

```bash
# Install Context7 MCP server
npm install -g @upstash/context7
# or via Docker
docker run -p 8080:8080 upstash/context7
```

**CRITICAL**: Use "use context7" command before implementing any library-specific code:
- React Native components and navigation
- SQLite database operations
- Google Gemini API integration
- Push notification setup
- Biometric authentication
- Camera and file upload functionality

## Project Overview

**Application Name**: WENTING  
**Description**: 移动端家庭健康监督应用，用于监测和管理家庭成员的健康状况，提供用药提醒和个性化健康建议  
**Target Platform**: iOS (with future Android support)  
**Primary Users**: 家庭健康负责人(Admin)和家庭成员(Users)

### Core MVP Features

1. **用户认证系统**
   - 手机号/邮箱注册登录
   - Google账号集成
   - 生物识别认证

2. **家庭管理系统**
   - 创建和管理Household
   - 邀请系统(Admin邀请，用户同意)
   - 角色权限管理(Admin提升其他用户)

3. **健康档案管理**
   - 手动录入健康信息
   - 拍照上传医疗文档
   - AI识别医疗内容(Gemini API)
   - 用户审核确认机制

4. **智能提醒系统**
   - 用药提醒设置
   - 多用户通知(为老人等设置额外提醒人)
   - 基于天气的健康提醒
   - 过敏季节提醒

5. **健康日历**
   - 体检预约管理
   - 复查提醒
   - Google Calendar集成

### Future Features (v2.0预留)
- 商城功能(个性化商品推荐)
- 外部医护人员访问
- 设备集成(步数、心率监测)
- 高级健康分析

## Technical Architecture

### Technology Stack

```typescript
// Core Technologies
Frontend: React Native 0.73+
Database: SQLite with encryption
AI Service: Google Gemini API
Authentication: Firebase Auth + Biometric
Push Notifications: Firebase Cloud Messaging
State Management: Redux Toolkit + RTK Query
Navigation: React Navigation 6.x
UI Framework: React Native Elements + Styled Components
```

### Project Structure

```
WENTING/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Generic components
│   │   ├── forms/           # Form components
│   │   ├── health/          # Health-specific components
│   │   └── household/       # Family management components
│   ├── screens/             # Screen components
│   │   ├── auth/           # Authentication screens
│   │   ├── household/      # Family management
│   │   ├── health/         # Health records
│   │   ├── calendar/       # Health calendar
│   │   └── notifications/  # Reminder management
│   ├── services/           # Business logic layer
│   │   ├── api/           # API services
│   │   ├── database/      # SQLite operations
│   │   ├── gemini/        # AI integration
│   │   ├── notifications/ # Push notification service
│   │   └── security/      # Encryption & auth
│   ├── store/             # Redux store configuration
│   │   ├── slices/        # Redux slices
│   │   └── middleware/    # Custom middleware
│   ├── utils/             # Utility functions
│   │   ├── validation/    # Form validation
│   │   ├── encryption/    # Data encryption
│   │   ├── permissions/   # Role-based access
│   │   └── helpers/       # General helpers
│   ├── types/             # TypeScript definitions
│   ├── constants/         # App constants
│   ├── localization/      # i18n support (中文/English)
│   └── assets/            # Images, fonts, etc.
├── __tests__/             # Test files
├── android/               # Future Android support
├── ios/                   # iOS specific configuration
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

### Database Schema Design

```sql
-- Core Tables
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone_number TEXT UNIQUE,
    email TEXT UNIQUE,
    google_id TEXT,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    biometric_enabled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE household_members (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'member')) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(household_id, user_id)
);

CREATE TABLE health_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    record_type TEXT NOT NULL, -- medication, diagnosis, allergy, etc.
    record_data JSON, -- Structured health data
    document_path TEXT, -- Path to uploaded document
    ai_processed_data JSON, -- Gemini API extracted data
    verified BOOLEAN DEFAULT 0, -- User verification status
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (household_id) REFERENCES households(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    household_id TEXT NOT NULL,
    health_record_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    reminder_type TEXT NOT NULL, -- medication, appointment, health_tip
    schedule_data JSON, -- Cron-like schedule configuration
    notification_users JSON, -- Array of user IDs to notify
    active BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (household_id) REFERENCES households(id),
    FOREIGN KEY (health_record_id) REFERENCES health_records(id)
);

CREATE TABLE health_calendar (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    household_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    appointment_type TEXT, -- checkup, follow_up, procedure
    scheduled_date TIMESTAMP NOT NULL,
    location TEXT,
    doctor_info JSON,
    google_calendar_event_id TEXT, -- For Google Calendar sync
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (household_id) REFERENCES households(id)
);
```

### Security Implementation

```typescript
// HIPAA-Compliant Encryption Configuration
interface SecurityConfig {
  encryption: {
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2';
    saltLength: 32;
    ivLength: 16;
  };
  authentication: {
    biometric: true;
    sessionTimeout: 30; // minutes
    maxLoginAttempts: 5;
  };
  dataProtection: {
    fieldLevelEncryption: string[]; // Sensitive fields
    auditLogging: boolean;
    anonymization: boolean;
  };
}

// Role-Based Access Control
enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    { resource: 'health_records', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'reminders', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'household_members', actions: ['create', 'read', 'update', 'delete'] }
  ],
  [UserRole.MEMBER]: [
    { resource: 'health_records', actions: ['create', 'read', 'update'] }, // Own records only
    { resource: 'reminders', actions: ['create', 'read', 'update'] } // Own reminders only
  ]
};
```

## Development Implementation Plan

### Phase 1: Foundation Setup (Weeks 1-2)

```bash
# Project initialization
npx react-native init WENTING --template typescript
cd WENTING

# Install core dependencies - Use "use context7" before implementation
npm install @reduxjs/toolkit react-redux
npm install react-navigation
npm install react-native-sqlite-storage
npm install react-native-encrypted-storage
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install react-native-image-picker
npm install react-native-permissions
```

#### Core Configuration Files

```json
// package.json additions
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "ios:build": "react-native run-ios --configuration Release",
    "android:build": "react-native run-android --variant=release"
  },
  "dependencies": {
    "@google/generative-ai": "^0.2.1",
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/auth": "^18.0.0",
    "@react-native-firebase/messaging": "^18.0.0",
    "@reduxjs/toolkit": "^1.9.7",
    "react-redux": "^8.1.3",
    "react-native-sqlite-storage": "^6.0.1",
    "react-native-encrypted-storage": "^4.0.3",
    "react-native-image-picker": "^7.0.0",
    "react-i18next": "^13.0.0"
  }
}
```

```typescript
// .env configuration
GEMINI_API_KEY=AIzaSyC-Iqd73MZClooMW5C3VwRJIxE5Gu-8lwI
FIREBASE_API_KEY=your_firebase_api_key
GOOGLE_CALENDAR_API_KEY=your_google_calendar_key
WEATHER_API_KEY=your_weather_api_key # Free tier from OpenWeatherMap
```

### Phase 2: Authentication & User Management (Weeks 3-4)

```typescript
// src/services/auth/AuthService.ts
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import TouchID from 'react-native-touch-id';

class AuthService {
  async signInWithPhone(phoneNumber: string): Promise<void> {
    // Implementation with context7 for latest Firebase auth patterns
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return confirmation;
  }

  async signInWithGoogle(): Promise<UserCredential> {
    // Use context7 for latest Google Sign-In implementation
    await GoogleSignin.hasPlayServices();
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    return auth().signInWithCredential(googleCredential);
  }

  async enableBiometric(): Promise<boolean> {
    // Use context7 for latest TouchID/FaceID patterns
    const biometryType = await TouchID.isSupported();
    if (biometryType) {
      await TouchID.authenticate('Authenticate for WENTING access');
      return true;
    }
    return false;
  }
}
```

### Phase 3: Database Layer & Health Records (Weeks 5-8)

```typescript
// src/services/database/DatabaseService.ts
import SQLite from 'react-native-sqlite-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initDatabase(): Promise<void> {
    // Use context7 for latest SQLite patterns
    this.db = await SQLite.openDatabase({
      name: 'wenting.db',
      location: 'default',
      createFromLocation: '~www/wenting.db'
    });

    await this.createTables();
    await this.setupEncryption();
  }

  async createHealthRecord(record: HealthRecord): Promise<string> {
    // Implementation with field-level encryption
    const encryptedData = await this.encryptSensitiveFields(record);
    
    const query = `
      INSERT INTO health_records (id, user_id, household_id, title, description, 
                                  record_type, record_data, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db?.executeSql(query, [
      record.id,
      record.userId,
      record.householdId,
      record.title,
      record.description,
      record.recordType,
      JSON.stringify(encryptedData),
      record.createdBy
    ]);

    return record.id;
  }
}
```

### Phase 4: AI Integration & Document Processing (Weeks 9-10)

```typescript
// src/services/gemini/GeminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeHealthDocument(imageBase64: string): Promise<HealthDocumentAnalysis> {
    // Use context7 for latest Gemini API patterns
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const prompt = `
      分析这份医疗文档，提取以下信息（以JSON格式返回）：
      - 患者姓名
      - 诊断结果
      - 开具药物及用法用量
      - 医生建议
      - 复查时间
      - 注意事项
      
      请确保信息准确，如果某些信息不清楚或不存在，请标注为null。
    `;

    const result = await model.generateContent([prompt, { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }]);
    
    return JSON.parse(result.response.text());
  }

  async generateHealthTip(userConditions: string[], weatherData: WeatherData): Promise<string> {
    // Smart health tips based on conditions and weather
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      基于用户健康状况：${userConditions.join(', ')}
      和当前天气：温度${weatherData.temperature}°C，湿度${weatherData.humidity}%，${weatherData.description}
      
      生成一条个性化的健康建议，要求：
      1. 针对性强，考虑用户的具体健康状况
      2. 结合天气情况给出实用建议
      3. 语言温馨友好，不超过100字
      4. 如果是特殊天气（如高温、低温、高湿度等），重点提醒
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
```

### Phase 5: Notification System (Weeks 11-12)

```typescript
// src/services/notifications/NotificationService.ts
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';

class NotificationService {
  async setupPushNotifications(): Promise<void> {
    // Use context7 for latest Firebase messaging patterns
    const authStatus = await messaging().requestPermission();
    
    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
      const token = await messaging().getToken();
      await this.registerDeviceToken(token);
    }

    messaging().onMessage(async remoteMessage => {
      this.showLocalNotification(remoteMessage);
    });
  }

  async scheduleReminder(reminder: Reminder): Promise<void> {
    // Schedule local notifications for medication reminders
    const notificationUsers = reminder.notificationUsers || [reminder.userId];
    
    notificationUsers.forEach(async (userId) => {
      const user = await this.getUserById(userId);
      
      PushNotification.localNotificationSchedule({
        id: reminder.id,
        title: reminder.title,
        message: reminder.description,
        date: this.calculateNextReminderTime(reminder.scheduleData),
        repeatType: this.getRepeatType(reminder.scheduleData),
        actions: ['查看详情', '已服药', '稍后提醒'],
        userInfo: {
          reminderId: reminder.id,
          userId: userId,
          householdId: reminder.householdId
        }
      });
    });
  }

  async sendContextualHealthAlert(users: User[], alertType: string, content: string): Promise<void> {
    // Send weather-based or seasonal health alerts
    const payload = {
      notification: {
        title: this.getAlertTitle(alertType),
        body: content
      },
      data: {
        alertType,
        timestamp: Date.now().toString()
      }
    };

    for (const user of users) {
      if (user.deviceTokens && user.deviceTokens.length > 0) {
        await messaging().sendToDevice(user.deviceTokens, payload);
      }
    }
  }
}
```

### Phase 6: Testing Strategy

```typescript
// __tests__/services/DatabaseService.test.ts
import { DatabaseService } from '../../src/services/database/DatabaseService';

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    dbService = new DatabaseService();
    await dbService.initDatabase();
  });

  afterEach(async () => {
    await dbService.closeDatabase();
  });

  describe('Health Records', () => {
    test('should create encrypted health record', async () => {
      const record: HealthRecord = {
        id: 'test-record-1',
        userId: 'user-1',
        householdId: 'household-1',
        title: '高血压药物',
        description: '每日早晚各一片',
        recordType: 'medication',
        recordData: {
          medication: '氨氯地平',
          dosage: '5mg',
          frequency: '每日两次'
        },
        createdBy: 'user-1'
      };

      const recordId = await dbService.createHealthRecord(record);
      expect(recordId).toBe('test-record-1');

      const retrievedRecord = await dbService.getHealthRecord(recordId);
      expect(retrievedRecord.title).toBe('高血压药物');
      expect(retrievedRecord.recordData.medication).toBe('氨氯地平');
    });
  });

  describe('Role-based Access Control', () => {
    test('admin can access all household health records', async () => {
      const adminUser = { id: 'admin-1', role: 'admin' };
      const memberUser = { id: 'member-1', role: 'member' };
      
      const adminRecords = await dbService.getHealthRecords('household-1', adminUser);
      const memberRecords = await dbService.getHealthRecords('household-1', memberUser);
      
      expect(adminRecords.length).toBeGreaterThan(memberRecords.length);
    });
  });
});

// __tests__/services/GeminiService.test.ts
import { GeminiService } from '../../src/services/gemini/GeminiService';

describe('GeminiService', () => {
  let geminiService: GeminiService;

  beforeEach(() => {
    geminiService = new GeminiService(process.env.GEMINI_API_KEY!);
  });

  test('should analyze health document and extract structured data', async () => {
    const mockImageBase64 = 'base64encodedimagecontent';
    
    const analysis = await geminiService.analyzeHealthDocument(mockImageBase64);
    
    expect(analysis).toHaveProperty('patientName');
    expect(analysis).toHaveProperty('diagnosis');
    expect(analysis).toHaveProperty('medications');
    expect(analysis).toHaveProperty('followUpDate');
  });

  test('should generate contextual health tips', async () => {
    const userConditions = ['高血压', '糖尿病'];
    const weatherData = {
      temperature: 35,
      humidity: 80,
      description: '高温高湿'
    };

    const healthTip = await geminiService.generateHealthTip(userConditions, weatherData);
    
    expect(healthTip).toContain('高温');
    expect(typeof healthTip).toBe('string');
    expect(healthTip.length).toBeLessThan(100);
  });
});
```

## Security & Privacy Implementation

### HIPAA Compliance Checklist

```typescript
// src/utils/security/HIPAACompliance.ts
export class HIPAACompliance {
  // Administrative Safeguards
  static readonly ADMINISTRATIVE_CONTROLS = {
    ACCESS_MANAGEMENT: 'Role-based access control implemented',
    WORKFORCE_TRAINING: 'Security awareness training required',
    INCIDENT_RESPONSE: 'Security incident procedures defined',
    AUDIT_CONTROLS: 'Access logs and audit trails maintained'
  };

  // Physical Safeguards
  static readonly PHYSICAL_CONTROLS = {
    DEVICE_SECURITY: 'Biometric authentication for device access',
    DATA_ENCRYPTION: 'AES-256 encryption for data at rest',
    SECURE_DISPOSAL: 'Secure data deletion procedures'
  };

  // Technical Safeguards
  static readonly TECHNICAL_CONTROLS = {
    ACCESS_CONTROL: 'Unique user identification and automatic logoff',
    AUDIT_LOGS: 'Comprehensive audit trail system',
    INTEGRITY: 'Data integrity verification mechanisms',
    TRANSMISSION_SECURITY: 'End-to-end encryption for data in transit'
  };

  static validateCompliance(): ComplianceReport {
    // Implementation of compliance validation
    return {
      administrative: this.checkAdministrativeControls(),
      physical: this.checkPhysicalControls(),
      technical: this.checkTechnicalControls(),
      overallScore: this.calculateComplianceScore()
    };
  }
}
```

### Data Encryption Strategy

```typescript
// src/utils/encryption/EncryptionManager.ts
import CryptoJS from 'crypto-js';
import { generateSecureRandom } from 'react-native-securerandom';

export class EncryptionManager {
  private static readonly ALGORITHM = 'AES-256-GCM';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;

  static async encryptHealthData(data: any, userKey: string): Promise<EncryptedData> {
    const salt = await generateSecureRandom(32);
    const iv = await generateSecureRandom(16);
    
    // Derive key using PBKDF2
    const key = CryptoJS.PBKDF2(userKey, salt, {
      keySize: 256/32,
      iterations: 100000
    });

    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
      iv: CryptoJS.lib.WordArray.create(iv),
      mode: CryptoJS.mode.GCM
    });

    return {
      encryptedData: encrypted.toString(),
      salt: Array.from(salt),
      iv: Array.from(iv),
      algorithm: this.ALGORITHM
    };
  }

  static async decryptHealthData(encryptedData: EncryptedData, userKey: string): Promise<any> {
    const salt = new Uint8Array(encryptedData.salt);
    const iv = new Uint8Array(encryptedData.iv);

    const key = CryptoJS.PBKDF2(userKey, CryptoJS.lib.WordArray.create(salt), {
      keySize: 256/32,
      iterations: 100000
    });

    const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedData, key, {
      iv: CryptoJS.lib.WordArray.create(iv),
      mode: CryptoJS.mode.GCM
    });

    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  }
}
```

## Performance Optimization

### Mobile Performance Standards

```typescript
// src/utils/performance/PerformanceOptimizer.ts
export class PerformanceOptimizer {
  // Image optimization for health document uploads
  static optimizeHealthDocumentImage(imageUri: string): Promise<OptimizedImage> {
    return new Promise((resolve) => {
      ImageResizer.createResizedImage(
        imageUri,
        1200, // Max width
        1600, // Max height  
        'JPEG',
        80, // Quality
        0, // Rotation
        null,
        false,
        { mode: 'contain', onlyScaleDown: true }
      ).then(response => {
        resolve({
          uri: response.uri,
          width: response.width,
          height: response.height,
          size: response.size
        });
      });
    });
  }

  // Lazy loading for health records
  static setupVirtualizedHealthRecords() {
    return {
      windowSize: 10,
      maxToRenderPerBatch: 5,
      updateCellsBatchingPeriod: 100,
      initialNumToRender: 10,
      removeClippedSubviews: true,
      getItemLayout: (data: any[], index: number) => ({
        length: 120, // Item height
        offset: 120 * index,
        index
      })
    };
  }

  // Database query optimization
  static optimizeHealthRecordQueries(): QueryOptimization {
    return {
      indexes: [
        'CREATE INDEX idx_health_records_user_household ON health_records(user_id, household_id)',
        'CREATE INDEX idx_reminders_schedule ON reminders(scheduled_date, active)',
        'CREATE INDEX idx_health_calendar_date ON health_calendar(scheduled_date)'
      ],
      caching: {
        recentHealthRecords: '24h',
        userPreferences: '7d',
        householdData: '1h'
      }
    };
  }
}
```

## Deployment Instructions

### iOS App Store Deployment

```bash
# Pre-deployment checklist
# 1. Update version numbers
# 2. Generate release build
# 3. Test on physical devices
# 4. Validate HIPAA compliance
# 5. Review privacy policy

# Build for iOS
cd ios
pod install
cd ..

# Generate release build
npx react-native run-ios --configuration Release

# Create archive for App Store
xcodebuild -workspace ios/WENTING.xcworkspace \
           -scheme WENTING \
           -configuration Release \
           -archivePath build/WENTING.xcarchive \
           archive

# Export for App Store
xcodebuild -exportArchive \
           -archivePath build/WENTING.xcarchive \
           -exportPath build/ \
           -exportOptionsPlist ios/ExportOptions.plist
```

### Environment Configuration

```typescript
// src/config/environment.ts
interface EnvironmentConfig {
  geminiApiKey: string;
  firebaseConfig: FirebaseConfig;
  googleCalendarApiKey: string;
  weatherApiKey: string;
  encryptionKey: string;
  hipaaComplianceLevel: 'development' | 'production';
}

const developmentConfig: EnvironmentConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY!,
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY!,
    authDomain: "wenting-dev.firebaseapp.com",
    projectId: "wenting-dev"
  },
  googleCalendarApiKey: process.env.GOOGLE_CALENDAR_API_KEY!,
  weatherApiKey: process.env.WEATHER_API_KEY!,
  encryptionKey: process.env.ENCRYPTION_KEY!,
  hipaaComplianceLevel: 'development'
};

const productionConfig: EnvironmentConfig = {
  // Production configuration with enhanced security
  geminiApiKey: process.env.GEMINI_API_KEY_PROD!,
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY_PROD!,
    authDomain: "wenting-prod.firebaseapp.com",
    projectId: "wenting-prod"
  },
  googleCalendarApiKey: process.env.GOOGLE_CALENDAR_API_KEY_PROD!,
  weatherApiKey: process.env.WEATHER_API_KEY_PROD!,
  encryptionKey: process.env.ENCRYPTION_KEY_PROD!,
  hipaaComplianceLevel: 'production'
};
```

## Monitoring & Analytics

### Health Data Analytics (Privacy-Preserving)

```typescript
// src/services/analytics/HealthAnalytics.ts
export class HealthAnalytics {
  // Anonymized analytics for app improvement
  static async trackMedicationAdherence(householdId: string): Promise<AdherenceMetrics> {
    const anonymizedData = await this.anonymizeHealthData(householdId);
    
    return {
      adherenceRate: this.calculateAdherenceRate(anonymizedData),
      commonMissedMedications: this.identifyCommonIssues(anonymizedData),
      reminderEffectiveness: this.analyzeReminderSuccess(anonymizedData)
    };
  }

  static async generateFamilyHealthInsights(householdId: string): Promise<HealthInsights> {
    // AI-powered insights while maintaining privacy
    const geminiService = new GeminiService(process.env.GEMINI_API_KEY!);
    const aggregatedData = await this.getAggregatedHealthData(householdId);
    
    const insights = await geminiService.generateHealthInsights(aggregatedData);
    
    return {
      insights,
      confidenceScore: this.calculateInsightConfidence(insights),
      recommendations: await this.generateActionableRecommendations(insights)
    };
  }
}
```

## Additional Notes

### Context7 Usage Reminders

**CRITICAL**: Always use "use context7" before implementing:

1. **React Native Navigation**: Get latest navigation patterns
2. **SQLite Operations**: Fetch current database integration methods  
3. **Firebase Integration**: Ensure compatibility with latest SDK versions
4. **Google Gemini API**: Get up-to-date API documentation and best practices
5. **Push Notifications**: Verify current Firebase messaging implementation
6. **Biometric Authentication**: Check latest TouchID/FaceID integration methods
7. **Image Processing**: Get current react-native-image-picker usage patterns

### Development Best Practices

1. **Privacy by Design**: All health data encrypted at field level
2. **Offline-First**: App functions without internet connectivity
3. **Accessibility**: Full VoiceOver and accessibility support
4. **Internationalization**: Chinese and English language support
5. **Error Handling**: Comprehensive error boundaries and user feedback
6. **Testing**: Minimum 80% code coverage requirement
7. **Performance**: Sub-3-second app startup time
8. **Security**: Regular security audits and penetration testing

### Future Considerations (v2.0)

- **Device Integration**: HealthKit/Google Fit integration
- **Advanced AI**: Predictive health analytics
- **Telemedicine**: Video consultation integration  
- **Wearable Devices**: Apple Watch and fitness tracker support
- **Marketplace**: In-app health product recommendations
- **Professional Access**: Healthcare provider dashboard

### Compliance and Legal

- **HIPAA Compliance**: Full Business Associate Agreement support
- **Data Retention**: Configurable data retention policies
- **User Consent**: Granular privacy consent management
- **Audit Trails**: Complete user action logging
- **Data Export**: User data portability (GDPR compliance)
- **Breach Notification**: Automated security incident reporting

---

**Generated Development Guide Version**: 1.0  
**Target Completion**: 6 months (24 weeks)  
**Estimated Team Size**: 3-4 developers (1 React Native lead, 1 Backend specialist, 1 UI/UX developer, 1 QA engineer)  
**Budget Estimate**: $120,000 - $180,000 (based on complexity and security requirements)

Remember to use Context7 extensively throughout development to ensure all implementations use the latest APIs and best practices.