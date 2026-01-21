import { IStorage } from "./repositories";
import { MemStorage } from "./storage";

let storageInstance: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (storageInstance) {
    return storageInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const { DatabaseStorage } = await import("./database/db-storage");
      const { testConnection } = await import("./database/connection");
      
      const connected = await testConnection();
      if (connected) {
        console.log("Using PostgreSQL database storage");
        const dbStorage = new DatabaseStorage();
        await dbStorage.initDefaults();
        storageInstance = dbStorage;
        return storageInstance;
      } else {
        console.warn("Database connection failed, falling back to in-memory storage");
      }
    } catch (error) {
      console.warn("Failed to initialize database storage, falling back to in-memory storage:", error);
    }
  }

  console.log("Using in-memory storage");
  const memStorage = new MemStorage();
  await memStorage.initDefaults();
  storageInstance = memStorage;
  return storageInstance;
}

export function resetStorage(): void {
  storageInstance = null;
}

export async function initializeStorage(): Promise<IStorage> {
  return getStorage();
}

export function getCurrentStorage(): IStorage {
  if (!storageInstance) {
    throw new Error("Storage not initialized. Call getStorage() first.");
  }
  return storageInstance;
}

export { storageInstance };
