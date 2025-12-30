import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import QRCode from "qrcode";

export function generateQrToken() {
    return crypto.randomBytes(24).toString("base64url");
}

export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Generates a QR PNG file and returns:
 * - token
 * - filename
 * - filePath
 */
export async function generateQrPngFile({ payloadString, bookingId }) {
    const token = generateQrToken();

    // Example filename: booking_<id>_<token>.png
    const filename = `booking_${bookingId}_${token}.png`;

    const qrDir = path.resolve(process.cwd(), "src/static/qrcodes");
    await ensureDir(qrDir);

    const filePath = path.join(qrDir, filename);

    await QRCode.toFile(filePath, payloadString, {
        type: "png",
        errorCorrectionLevel: "H",
        margin: 1,
        width: 512,
    });

    return { token, filename, filePath };
}
