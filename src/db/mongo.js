import mongoose from "mongoose";

export async function connectMongo(mongoUri) {
    if (!mongoUri) throw new Error("MONGODB_URI is required");

    mongoose.set("strictQuery", true);

    await mongoose.connect(mongoUri, {
        maxPoolSize: 20, // performance: connection pooling
        serverSelectionTimeoutMS: 5000,
    });

    return mongoose.connection;
}
