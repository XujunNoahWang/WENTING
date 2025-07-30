import SQLite from 'react-native-sqlite-storage';
import { DATABASE_CONFIG } from '@constants/index';
import {
  User,
  Household,
  HouseholdMember,
  HealthRecord,
  Reminder,
  HealthCalendarEvent,
  UserRole,
  ApiResponse,
} from '@types/index';
import { EncryptionManager } from '@utils/encryption/EncryptionManager';

// Enable debugging
SQLite.DEBUG(true);
SQLite.enablePromise(true);

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: DATABASE_CONFIG.NAME,
        location: DATABASE_CONFIG.LOCATION,
        createFromLocation: 1,
      });

      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.USERS} (
        id TEXT PRIMARY KEY,
        phone_number TEXT UNIQUE,
        email TEXT UNIQUE,
        google_id TEXT UNIQUE,
        full_name TEXT NOT NULL,
        avatar_url TEXT,
        biometric_enabled BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Households table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )`,

      // Household members table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'member')) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (household_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS}(id),
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id),
        UNIQUE(household_id, user_id)
      )`,

      // Health records table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        household_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        record_type TEXT NOT NULL,
        record_data TEXT, -- JSON encrypted
        document_path TEXT,
        ai_processed_data TEXT, -- JSON encrypted
        verified BOOLEAN DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id),
        FOREIGN KEY (household_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS}(id),
        FOREIGN KEY (created_by) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )`,

      // Reminders table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.REMINDERS} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        household_id TEXT NOT NULL,
        health_record_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        reminder_type TEXT NOT NULL,
        schedule_data TEXT NOT NULL, -- JSON
        notification_users TEXT NOT NULL, -- JSON array of user IDs
        active BOOLEAN DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id),
        FOREIGN KEY (household_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS}(id),
        FOREIGN KEY (health_record_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS}(id),
        FOREIGN KEY (created_by) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )`,

      // Health calendar table
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        household_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        appointment_type TEXT NOT NULL,
        scheduled_date TIMESTAMP NOT NULL,
        location TEXT,
        doctor_info TEXT, -- JSON
        google_calendar_event_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id),
        FOREIGN KEY (household_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS}(id),
        FOREIGN KEY (created_by) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )`,

      // Audit logs table for security
      `CREATE TABLE IF NOT EXISTS ${DATABASE_CONFIG.TABLE_NAMES.AUDIT_LOGS} (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details TEXT, -- JSON
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )`,
    ];

    // Create indexes for performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_health_records_user_household 
       ON ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS}(user_id, household_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reminders_schedule 
       ON ${DATABASE_CONFIG.TABLE_NAMES.REMINDERS}(user_id, active, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_health_calendar_date 
       ON ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR}(scheduled_date)`,
      `CREATE INDEX IF NOT EXISTS idx_household_members_household 
       ON ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS}(household_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date 
       ON ${DATABASE_CONFIG.TABLE_NAMES.AUDIT_LOGS}(user_id, created_at)`,
    ];

    // Execute table creation queries
    for (const query of queries) {
      await this.db.executeSql(query);
    }

    // Create indexes
    for (const index of indexes) {
      await this.db.executeSql(index);
    }
  }

  // User management methods
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.USERS} 
      (id, phone_number, email, google_id, full_name, avatar_url, biometric_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.executeSql(query, [
      user.id,
      user.phoneNumber || null,
      user.email || null,
      user.googleId || null,
      user.fullName,
      user.avatarUrl || null,
      user.biometricEnabled ? 1 : 0,
    ]);

    await this.logAudit(user.id, 'CREATE', 'user', user.id, { action: 'User created' });
    return user.id;
  }

  async getUserById(userId: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.USERS} WHERE id = ?`;
    const [result] = await this.db.executeSql(query, [userId]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return this.mapRowToUser(row);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.USERS} WHERE email = ?`;
    const [result] = await this.db.executeSql(query, [email]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return this.mapRowToUser(row);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        const dbField = this.camelToSnake(key);
        fields.push(`${dbField} = ?`);
        
        if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.USERS} 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `;

    await this.db.executeSql(query, values);
    await this.logAudit(userId, 'UPDATE', 'user', userId, { updates });
  }

  // Household management methods
  async createHousehold(household: Omit<Household, 'createdAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS} 
      (id, name, description, created_by)
      VALUES (?, ?, ?, ?)
    `;

    await this.db.executeSql(query, [
      household.id,
      household.name,
      household.description || null,
      household.createdBy,
    ]);

    // Add creator as admin
    await this.addHouseholdMember({
      id: `${household.id}_${household.createdBy}`,
      householdId: household.id,
      userId: household.createdBy,
      role: UserRole.ADMIN,
      joinedAt: new Date().toISOString(),
    });

    await this.logAudit(household.createdBy, 'CREATE', 'household', household.id, 
      { action: 'Household created' });

    return household.id;
  }

  async getHouseholdById(householdId: string): Promise<Household | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS} WHERE id = ?`;
    const [result] = await this.db.executeSql(query, [householdId]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  async getUserHouseholds(userId: string): Promise<Household[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT h.* FROM ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS} h
      INNER JOIN ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} hm ON h.id = hm.household_id
      WHERE hm.user_id = ?
      ORDER BY h.created_at DESC
    `;

    const [result] = await this.db.executeSql(query, [userId]);
    const households: Household[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      households.push({
        id: row.id,
        name: row.name,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
      });
    }

    return households;
  }

  async addHouseholdMember(member: Omit<HouseholdMember, 'user'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} 
      (id, household_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.db.executeSql(query, [
      member.id,
      member.householdId,
      member.userId,
      member.role,
      member.joinedAt,
    ]);

    await this.logAudit(member.userId, 'CREATE', 'household_member', member.id, 
      { householdId: member.householdId, role: member.role });
  }

  async getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT hm.*, u.full_name, u.email, u.avatar_url 
      FROM ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} hm
      INNER JOIN ${DATABASE_CONFIG.TABLE_NAMES.USERS} u ON hm.user_id = u.id
      WHERE hm.household_id = ?
      ORDER BY hm.role DESC, hm.joined_at ASC
    `;

    const [result] = await this.db.executeSql(query, [householdId]);
    const members: HouseholdMember[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      members.push({
        id: row.id,
        householdId: row.household_id,
        userId: row.user_id,
        role: row.role as UserRole,
        joinedAt: row.joined_at,
        user: {
          id: row.user_id,
          fullName: row.full_name,
          email: row.email,
          avatarUrl: row.avatar_url,
          phoneNumber: '',
          biometricEnabled: false,
          createdAt: '',
          updatedAt: '',
        },
      });
    }

    return members;
  }

  // Health Records methods
  async createHealthRecord(record: Omit<HealthRecord, 'createdAt' | 'updatedAt'>, 
                          encryptionKey: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    // Encrypt sensitive data
    const encryptedRecordData = await EncryptionManager.encryptHealthData(
      record.recordData, encryptionKey);
    
    let encryptedAIData = null;
    if (record.aiProcessedData) {
      encryptedAIData = await EncryptionManager.encryptHealthData(
        record.aiProcessedData, encryptionKey);
    }

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} 
      (id, user_id, household_id, title, description, record_type, 
       record_data, document_path, ai_processed_data, verified, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.executeSql(query, [
      record.id,
      record.userId,
      record.householdId,
      record.title,
      record.description || null,
      record.recordType,
      JSON.stringify(encryptedRecordData),
      record.documentPath || null,
      encryptedAIData ? JSON.stringify(encryptedAIData) : null,
      record.verified ? 1 : 0,
      record.createdBy,
    ]);

    await this.logAudit(record.createdBy, 'CREATE', 'health_record', record.id, 
      { userId: record.userId, recordType: record.recordType });

    return record.id;
  }

  async getHealthRecords(householdId: string, userId: string, 
                        userRole: UserRole, encryptionKey: string): Promise<HealthRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS}
      WHERE household_id = ?
    `;
    const params = [householdId];

    // Members can only see their own records
    if (userRole === UserRole.MEMBER) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const [result] = await this.db.executeSql(query, params);
    const records: HealthRecord[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      
      // Decrypt sensitive data
      const encryptedRecordData = JSON.parse(row.record_data);
      const recordData = await EncryptionManager.decryptHealthData(
        encryptedRecordData, encryptionKey);

      let aiProcessedData = null;
      if (row.ai_processed_data) {
        const encryptedAIData = JSON.parse(row.ai_processed_data);
        aiProcessedData = await EncryptionManager.decryptHealthData(
          encryptedAIData, encryptionKey);
      }

      records.push({
        id: row.id,
        userId: row.user_id,
        householdId: row.household_id,
        title: row.title,
        description: row.description,
        recordType: row.record_type,
        recordData,
        documentPath: row.document_path,
        aiProcessedData,
        verified: row.verified === 1,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return records;
  }

  // Additional Household Management Methods
  async updateHousehold(householdId: string, updates: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'createdBy') {
        const dbField = this.camelToSnake(key);
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    values.push(householdId);

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLDS} 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `;

    await this.db.executeSql(query, values);
    await this.logAudit(null, 'UPDATE', 'household', householdId, { updates });
  }

  async updateHouseholdMemberRole(memberId: string, role: UserRole): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} 
      SET role = ? 
      WHERE id = ?
    `;

    await this.db.executeSql(query, [role, memberId]);
    await this.logAudit(null, 'UPDATE', 'household_member', memberId, { role });
  }

  async removeHouseholdMember(memberId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `DELETE FROM ${DATABASE_CONFIG.TABLE_NAMES.HOUSEHOLD_MEMBERS} WHERE id = ?`;
    await this.db.executeSql(query, [memberId]);
    await this.logAudit(null, 'DELETE', 'household_member', memberId, { action: 'Member removed' });
  }

  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.USERS} WHERE phone_number = ?`;
    const [result] = await this.db.executeSql(query, [phoneNumber]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return this.mapRowToUser(row);
  }

  // Additional Health Record Methods
  async getHealthRecordById(recordId: string, encryptionKey: string): Promise<HealthRecord | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} WHERE id = ?`;
    const [result] = await this.db.executeSql(query, [recordId]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    
    // Decrypt sensitive data
    const encryptedRecordData = JSON.parse(row.record_data);
    const recordData = await EncryptionManager.decryptHealthData(
      encryptedRecordData, encryptionKey);

    let aiProcessedData = null;
    if (row.ai_processed_data) {
      const encryptedAIData = JSON.parse(row.ai_processed_data);
      aiProcessedData = await EncryptionManager.decryptHealthData(
        encryptedAIData, encryptionKey);
    }

    return {
      id: row.id,
      userId: row.user_id,
      householdId: row.household_id,
      title: row.title,
      description: row.description,
      recordType: row.record_type,
      recordData,
      documentPath: row.document_path,
      aiProcessedData,
      verified: row.verified === 1,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateHealthRecord(recordId: string, updates: any, encryptionKey: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'recordData' && value) {
        // Encrypt record data
        const encryptedData = await EncryptionManager.encryptHealthData(value, encryptionKey);
        fields.push('record_data = ?');
        values.push(JSON.stringify(encryptedData));
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'createdBy') {
        const dbField = this.camelToSnake(key);
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(recordId);

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `;

    await this.db.executeSql(query, values);
    await this.logAudit(null, 'UPDATE', 'health_record', recordId, { updates });
  }

  async updateHealthRecordAIData(recordId: string, aiData: any, encryptionKey: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Encrypt AI data
    const encryptedAIData = await EncryptionManager.encryptHealthData(aiData, encryptionKey);

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} 
      SET ai_processed_data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    await this.db.executeSql(query, [JSON.stringify(encryptedAIData), recordId]);
    await this.logAudit(null, 'UPDATE', 'health_record', recordId, { action: 'AI data added' });
  }

  async verifyHealthRecord(recordId: string, verified: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} 
      SET verified = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    await this.db.executeSql(query, [verified ? 1 : 0, recordId]);
    await this.logAudit(null, 'UPDATE', 'health_record', recordId, { verified });
  }

  async deleteHealthRecord(recordId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `DELETE FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS} WHERE id = ?`;
    await this.db.executeSql(query, [recordId]);
    await this.logAudit(null, 'DELETE', 'health_record', recordId, { action: 'Health record deleted' });
  }

  async getHealthRecordsByUserId(userId: string, encryptionKey: string): Promise<HealthRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_RECORDS}
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

    const [result] = await this.db.executeSql(query, [userId]);
    const records: HealthRecord[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      
      // Decrypt sensitive data
      const encryptedRecordData = JSON.parse(row.record_data);
      const recordData = await EncryptionManager.decryptHealthData(
        encryptedRecordData, encryptionKey);

      let aiProcessedData = null;
      if (row.ai_processed_data) {
        const encryptedAIData = JSON.parse(row.ai_processed_data);
        aiProcessedData = await EncryptionManager.decryptHealthData(
          encryptedAIData, encryptionKey);
      }

      records.push({
        id: row.id,
        userId: row.user_id,
        householdId: row.household_id,
        title: row.title,
        description: row.description,
        recordType: row.record_type,
        recordData,
        documentPath: row.document_path,
        aiProcessedData,
        verified: row.verified === 1,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return records;
  }

  async recordMedicationAdherence(reminderId: string, userId: string, takenAt: Date): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create adherence log table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS medication_adherence (
        id TEXT PRIMARY KEY,
        reminder_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        taken_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reminder_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.REMINDERS}(id),
        FOREIGN KEY (user_id) REFERENCES ${DATABASE_CONFIG.TABLE_NAMES.USERS}(id)
      )
    `;

    await this.db.executeSql(createTableQuery);

    // Insert adherence record
    const adherenceId = `adherence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertQuery = `
      INSERT INTO medication_adherence (id, reminder_id, user_id, taken_at)
      VALUES (?, ?, ?, ?)
    `;

    await this.db.executeSql(insertQuery, [
      adherenceId,
      reminderId,
      userId,
      takenAt.toISOString(),
    ]);

    await this.logAudit(userId, 'CREATE', 'medication_adherence', adherenceId, 
      { reminderId, takenAt: takenAt.toISOString() });
  }

  // Calendar Event Methods
  async createCalendarEvent(event: Omit<HealthCalendarEvent, 'createdAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR} 
      (id, user_id, household_id, title, description, appointment_type, 
       scheduled_date, location, doctor_info, google_calendar_event_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.executeSql(query, [
      event.id,
      event.userId,
      event.householdId,
      event.title,
      event.description || null,
      event.appointmentType,
      event.scheduledDate,
      event.location || null,
      event.doctorInfo ? JSON.stringify(event.doctorInfo) : null,
      event.googleCalendarEventId || null,
      event.createdBy,
    ]);

    await this.logAudit(event.createdBy, 'CREATE', 'health_calendar', event.id, 
      { userId: event.userId, appointmentType: event.appointmentType });

    return event.id;
  }

  async getCalendarEventById(eventId: string): Promise<HealthCalendarEvent | null> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR} WHERE id = ?`;
    const [result] = await this.db.executeSql(query, [eventId]);

    if (result.rows.length === 0) return null;

    const row = result.rows.item(0);
    return this.mapRowToCalendarEvent(row);
  }

  async getCalendarEvents(
    householdId: string,
    userId: string,
    userRole: UserRole,
    startDate?: string,
    endDate?: string
  ): Promise<HealthCalendarEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR}
      WHERE household_id = ?
    `;
    const params = [householdId];

    // Members can only see their own events
    if (userRole === UserRole.MEMBER) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    // Add date filters if provided
    if (startDate) {
      query += ' AND scheduled_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND scheduled_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY scheduled_date ASC';

    const [result] = await this.db.executeSql(query, params);
    const events: HealthCalendarEvent[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      events.push(this.mapRowToCalendarEvent(row));
    }

    return events;
  }

  async getUpcomingCalendarEvents(
    userId: string,
    userRole: UserRole,
    startDate: string,
    endDate: string
  ): Promise<HealthCalendarEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR}
      WHERE scheduled_date >= ? AND scheduled_date <= ?
    `;
    const params = [startDate, endDate];

    // Members can only see their own events
    if (userRole === UserRole.MEMBER) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY scheduled_date ASC';

    const [result] = await this.db.executeSql(query, params);
    const events: HealthCalendarEvent[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      events.push(this.mapRowToCalendarEvent(row));
    }

    return events;
  }

  async getCalendarEventsByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<HealthCalendarEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      SELECT * FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR}
      WHERE user_id = ? AND scheduled_date >= ? AND scheduled_date <= ?
      ORDER BY scheduled_date ASC
    `;

    const [result] = await this.db.executeSql(query, [userId, startDate, endDate]);
    const events: HealthCalendarEvent[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      events.push(this.mapRowToCalendarEvent(row));
    }

    return events;
  }

  async updateCalendarEvent(eventId: string, updates: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'doctorInfo' && value) {
        fields.push('doctor_info = ?');
        values.push(JSON.stringify(value));
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'createdBy') {
        const dbField = this.camelToSnake(key);
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(eventId);

    const query = `
      UPDATE ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR} 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `;

    await this.db.executeSql(query, values);
    await this.logAudit(null, 'UPDATE', 'health_calendar', eventId, { updates });
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `DELETE FROM ${DATABASE_CONFIG.TABLE_NAMES.HEALTH_CALENDAR} WHERE id = ?`;
    await this.db.executeSql(query, [eventId]);
    await this.logAudit(null, 'DELETE', 'health_calendar', eventId, { action: 'Calendar event deleted' });
  }

  private mapRowToCalendarEvent(row: any): HealthCalendarEvent {
    return {
      id: row.id,
      userId: row.user_id,
      householdId: row.household_id,
      title: row.title,
      description: row.description,
      appointmentType: row.appointment_type,
      scheduledDate: row.scheduled_date,
      location: row.location,
      doctorInfo: row.doctor_info ? JSON.parse(row.doctor_info) : undefined,
      googleCalendarEventId: row.google_calendar_event_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  // Utility methods
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      phoneNumber: row.phone_number,
      email: row.email,
      googleId: row.google_id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      biometricEnabled: row.biometric_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private async logAudit(userId: string | null, action: string, resource: string, 
                        resourceId: string | null, details: any): Promise<void> {
    if (!this.db) return;

    const query = `
      INSERT INTO ${DATABASE_CONFIG.TABLE_NAMES.AUDIT_LOGS} 
      (id, user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.db.executeSql(query, [
        auditId,
        userId,
        action,
        resource,
        resourceId,
        JSON.stringify(details),
      ]);
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseService.getInstance();