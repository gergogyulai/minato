// Entrypoint the supervisor spawns. Resolved by name via
// `import.meta.resolve("@project-minato/skit/run")`.
import { run } from "./runtime";

await run();
