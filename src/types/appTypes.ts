// 应用内部类型定义，来自App-Simple.tsx

export enum HealthRecordType {
  MEDICATION = 'medication',
  DIAGNOSIS = 'diagnosis',
  ALLERGY = 'allergy',
  VACCINATION = 'vaccination',
  VITAL_SIGNS = 'vital_signs',
  LAB_RESULT = 'lab_result',
  MEDICAL_HISTORY = 'medical_history'
}

export interface FirebaseUser {
  uid?: string;
  email?: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  loginTime?: string;
  provider?: string;
  mode?: string;
}

export interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface HouseholdForm {
  name: string;
  description: string;
}

export interface ExtendedHouseholdMember extends HouseholdMember {
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

export interface MemberForm {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  role: 'admin' | 'member';
}

export interface MedicationData {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  duration?: string;
  instructions?: string;
  sideEffects?: string[];
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
  severity: string;
  symptoms?: string[];
  treatment?: string;
  notes?: string;
}

export interface ExtendedHealthRecordData extends HealthRecordData {
  aiAdvice?: string;
  aiAnalysis?: {
    suggestions: string[];
    warnings: string[];
    recommendations: string[];
  };
}

export interface LocalHealthRecord {
  id: string;
  title: string;
  description?: string;
  recordType: HealthRecordType;
  recordData: ExtendedHealthRecordData;
  memberName: string;
  memberId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LocalHealthRecordForm {
  title: string;
  description?: string;
  recordType: HealthRecordType;
  recordData: any;
}

// 重新导出原有类型
export type { UserRole, User, Household, HouseholdMember, HealthRecordData } from './index';