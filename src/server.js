import { buildApp } from "./app.js";
import { connectMongo } from "./db/mongo.js";
import { config } from "./config/index.js";

async function main() {
    await connectMongo(config.mongoUri);

    const app = buildApp();
    app.listen(config.port, () => {
        // Keep startup log minimal
        console.log(`Booking service listening on port ${config.port}`);
    });
}

main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
