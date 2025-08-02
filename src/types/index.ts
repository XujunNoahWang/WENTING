// Core Types
export interface User {
  id: string;
  phoneNumber?: string;
  email?: string;
  googleId?: string;
  fullName: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string;
  biometricEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  uid?: string;
  photoURL?: string;
  emailVerified?: boolean;
  providerData?: any[];
}

export interface Household {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
  user?: User;
  name?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  relationship?: string;
  displayName?: string;
  providerData?: any[];
}

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

// Health Records
export interface HealthRecord {
  id: string;
  userId: string;
  householdId: string;
  memberName?: string;
  title: string;
  description?: string;
  recordType: HealthRecordType;
  recordData: HealthRecordData;
  documentPath?: string;
  aiProcessedData?: AIProcessedData;
  verified?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export enum HealthRecordType {
  MEDICATION = 'medication',
  DIAGNOSIS = 'diagnosis',
  ALLERGY = 'allergy',
  VACCINATION = 'vaccination',
  VITAL_SIGNS = 'vital_signs',
  LAB_RESULT = 'lab_result',
  MEDICAL_HISTORY = 'medical_history'
}

export interface HealthRecordData {
  medication?: MedicationData;
  diagnosis?: DiagnosisData;
  allergy?: AllergyData;
  vitals?: VitalSignsData;
  aiAdvice?: string;
  aiAdviceGeneratedAt?: string;
  [key: string]: any;
}

export interface MedicationData {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  sideEffects?: string[];
}

export interface DiagnosisData {
  condition: string;
  severity?: string;
  diagnosedDate: string;
  doctor?: string;
  hospital?: string;
  notes?: string;
}

export interface AllergyData {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  symptoms: string[];
  treatment?: string;
}

export interface VitalSignsData {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bloodSugar?: number;
  oxygenSaturation?: number;
}

// AI Integration
export interface AIProcessedData {
  extractedText: string;
  structuredData: any;
  confidence: number;
  processingDate: string;
  needsReview: boolean;
}

export interface HealthDocumentAnalysis {
  patientName?: string;
  diagnosis?: string[];
  medications?: MedicationData[];
  doctorRecommendations?: string[];
  followUpDate?: string;
  notes?: string[];
  confidence: number;
}

// Reminders
export interface Reminder {
  id: string;
  userId: string;
  householdId: string;
  healthRecordId?: string;
  title: string;
  description?: string;
  reminderType: ReminderType;
  scheduleData: ScheduleData;
  notificationUsers: string[];
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export enum ReminderType {
  MEDICATION = 'medication',
  APPOINTMENT = 'appointment',
  HEALTH_TIP = 'health_tip',
  CHECKUP = 'checkup',
  CUSTOM = 'custom'
}

export interface ScheduleData {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:mm format
  days?: number[]; // 0-6 (Sunday-Saturday)
  startDate: string;
  endDate?: string;
  customPattern?: string; // Cron-like pattern
}


export interface DoctorInfo {
  name: string;
  specialty: string;
  phoneNumber?: string;
  email?: string;
  hospital?: string;
}

// Authentication
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Database
export interface DatabaseConfig {
  name: string;
  location: string;
  createFromLocation?: string;
  encryptionKey?: string;
}

export interface EncryptedData {
  encryptedData: string;
  salt: number[];
  iv: number[];
  algorithm: string;
}

// Security
export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyDerivation: string;
    saltLength: number;
    ivLength: number;
  };
  authentication: {
    biometric: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  dataProtection: {
    fieldLevelEncryption: string[];
    auditLogging: boolean;
    anonymization: boolean;
  };
}

// Permissions
export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Weather Data
export interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  windSpeed?: number;
  uvIndex?: number;
  airQuality?: string;
}

// Notification Types
export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  data?: any;
  sound?: string;
  badge?: number;
}

// Form Types
export interface LoginForm {
  phoneNumber?: string;
  email?: string;
  password?: string;
  useGoogle?: boolean;
}

export interface RegisterForm {
  fullName: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface HouseholdForm {
  name: string;
  description?: string;
}

export interface HealthRecordForm {
  title: string;
  description?: string;
  recordType: HealthRecordType;
  recordData: HealthRecordData;
}

// Redux Store Types
export interface RootState {
  auth: AuthState;
  household: HouseholdState;
  healthRecords: HealthRecordsState;
  reminders: RemindersState;
}

export interface HouseholdState {
  currentHousehold: Household | null;
  members: HouseholdMember[];
  isLoading: boolean;
  error: string | null;
}

export interface HealthRecordsState {
  records: HealthRecord[];
  isLoading: boolean;
  error: string | null;
}

export interface RemindersState {
  reminders: Reminder[];
  isLoading: boolean;
  error: string | null;
}


// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Profile: undefined;
  Household: undefined;
  HealthRecords: undefined;
  AddHealthRecord: { userId?: string };
  ViewHealthRecord: { recordId: string };
  Reminders: undefined;
  AddReminder: { recordId?: string };
  Settings: undefined;
};

// Localization
export interface LocalizationResources {
  en: {
    common: any;
    auth: any;
    household: any;
    health: any;
    reminders: any;
  };
  zh: {
    common: any;
    auth: any;
    household: any;
    health: any;
    reminders: any;
  };
}