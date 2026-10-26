import mongoose from "mongoose";

export interface DatabaseConnectionOptions {
  uri: string;
  connectTimeoutMS?: number;
  socketTimeoutMS?: number;
}

/**
 * Connects to MongoDB via mongoose with resilient timeouts and graceful error handling.
 */
export async function connectDatabase(options: DatabaseConnectionOptions): Promise<typeof mongoose> {
  const { uri, connectTimeoutMS = 5000, socketTimeoutMS = 10000 } = options;

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    connectTimeoutMS,
    socketTimeoutMS,
    serverSelectionTimeoutMS: connectTimeoutMS
  });

  return mongoose;
}

/**
 * Disconnects from MongoDB gracefully.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Checks if the database is currently connected.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
