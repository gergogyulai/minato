import { db } from "@project-minato/db"
import { initConfig, setupConfigSubscriber } from "@project-minato/config"

export async function bootstrap(): Promise<void> {
  await initConfig(db)
  setupConfigSubscriber(db)
}
