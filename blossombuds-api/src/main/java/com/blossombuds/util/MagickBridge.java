package com.blossombuds.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
    private static final Logger log = LoggerFactory.getLogger(MagickBridge.class);

    private MagickBridge() {}

    /**
     * Convert HEIC/HEIF bytes to JPEG bytes.
     * Uses tifig (most forgiving) as fallback if ImageMagick fails.
     */
    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        log.debug("Converting HEIC to JPEG, input size: {} bytes", heicBytes.length);

        File tempHeic = null;
        File tempJpeg = null;

        try {
            // Create temp files
            tempHeic = File.createTempFile("heic-input-", ".heic");
            tempJpeg = File.createTempFile("jpeg-output-", ".jpg");

            // Write HEIC data to temp file
            try (FileOutputStream fos = new FileOutputStream(tempHeic)) {
                fos.write(heicBytes);
            }

            // Try ImageMagick first (fastest)
            boolean success = tryImageMagick(tempHeic, tempJpeg, magickCmd);

            // If ImageMagick fails, try tifig (handles corrupt files better)
            if (!success) {
                log.warn("ImageMagick failed, trying tifig as fallback");
                success = tryTifig(tempHeic, tempJpeg);
            }

            if (!success) {
                throw new IOException("All HEIC conversion methods failed");
            }

            // Read converted JPEG
            byte[] jpegBytes = new byte[(int) tempJpeg.length()];
            try (FileInputStream fis = new FileInputStream(tempJpeg)) {
                int read = fis.read(jpegBytes);
                if (read != jpegBytes.length) {
                    throw new IOException("Failed to read complete JPEG output");
                }
            }

            log.debug("HEIC conversion successful, final JPEG size: {} bytes", jpegBytes.length);
            return jpegBytes;

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("Conversion interrupted", ie);
        } finally {
            // Clean up temp files
            if (tempHeic != null && tempHeic.exists()) tempHeic.delete();
            if (tempJpeg != null && tempJpeg.exists()) tempJpeg.delete();
        }
    }

    private static boolean tryImageMagick(File input, File output, String magickCmd) throws IOException, InterruptedException {
        log.debug("Trying ImageMagick conversion");

        ProcessBuilder pb;
        if (magickCmd.equals("magick")) {
            pb = new ProcessBuilder("magick", "convert",
                    input.getAbsolutePath(),
                    "-quality", "85",
                    "-auto-orient",
                    output.getAbsolutePath());
        } else {
            pb = new ProcessBuilder(magickCmd,
                    input.getAbsolutePath(),
                    "-quality", "85",
                    "-auto-orient",
                    output.getAbsolutePath());
        }

        pb.redirectErrorStream(true);
        Process proc = pb.start();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        int code = proc.waitFor();

        if (code == 0 && output.exists() && output.length() > 0) {
            log.debug("ImageMagick succeeded");
            return true;
        }

        log.warn("ImageMagick failed (exit {}): {}", code, out.toString(StandardCharsets.UTF_8));
        return false;
    }

    private static boolean tryTifig(File input, File output) throws IOException, InterruptedException {
        log.debug("Trying tifig conversion");

        ProcessBuilder pb = new ProcessBuilder("tifig",
                "-i", input.getAbsolutePath(),
                "-o", output.getAbsolutePath(),
                "-q", "85");
        pb.redirectErrorStream(true);
        Process proc = pb.start();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        int code = proc.waitFor();

        if (code == 0 && output.exists() && output.length() > 0) {
            log.info("tifig conversion succeeded (fallback worked!)");
            return true;
        }

        log.error("tifig also failed (exit {}): {}", code, out.toString(StandardCharsets.UTF_8));
        return false;
    }

    public static boolean looksLikeHeic(String contentType, String filename) {
        if (contentType != null && contentType.toLowerCase().startsWith("image/hei")) return true;
        if (filename != null) {
            String n = filename.toLowerCase();
            return n.endsWith(".heic") || n.endsWith(".heif");
        }
        return false;
    }
}
