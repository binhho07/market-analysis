import IORedis from "ioredis";

let connection: IORedis | null | undefined;

export function getQueueConnection() {
  if (connection !== undefined) return connection;

  const url = process.env.REDIS_URL;
  if (!url) {
    connection = null;
    return null;
  }

  try {
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    connection.on("error", (error) => {
      console.warn("Redis queue error:", error.message);
    });
    return connection;
  } catch (error) {
    console.warn("Redis queue init failed:", error);
    connection = null;
    return null;
  }
}
