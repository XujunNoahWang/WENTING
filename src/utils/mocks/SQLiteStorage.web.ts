// Mock SQLite Storage for web platform
const SQLiteStorage = {
  openDatabase: (config: any) => Promise.resolve({
    executeSql: (query: string, params: any[] = []) => {
      console.log('SQLite mock: executing query:', query);
      return Promise.resolve([{ rows: { length: 0, item: () => null } }]);
    },
    close: () => Promise.resolve(),
  }),
  DEBUG: (enable: boolean) => {
    console.log(`SQLite DEBUG ${enable ? 'enabled' : 'disabled'} (web mock)`);
  },
  enablePromise: (enable: boolean) => {
    console.log(`SQLite Promise ${enable ? 'enabled' : 'disabled'} (web mock)`);
  },
};

export default SQLiteStorage;