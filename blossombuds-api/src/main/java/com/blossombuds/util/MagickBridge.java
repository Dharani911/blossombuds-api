package com.blossombuds.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
    private static final Logger log = LoggerFactory.getLogger(MagickBridge.class);

    private MagickBridge() {}

    /**
     * Convert HEIC/HEIF bytes to JPEG bytes using heif-convert + ImageMagick.
     * Two-step process handles corrupt HEIC metadata better.
     */
    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        log.debug("Converting HEIC to JPEG, input size: {} bytes", heicBytes.length);

        File tempHeic = null;
        File tempPng = null;
        File tempJpeg = null;

        try {
            // Create temp files
            tempHeic = File.createTempFile("heic-input-", ".heic");
            tempPng = File.createTempFile("heif-png-", ".png");
            tempJpeg = File.createTempFile("jpeg-output-", ".jpg");

            // Write HEIC data to temp file
            try (FileOutputStream fos = new FileOutputStream(tempHeic)) {
                fos.write(heicBytes);
            }

            // Step 1: Use heif-convert to extract raw image (handles corrupt metadata)
            log.debug("Step 1: Converting HEIC to PNG with heif-convert");
            ProcessBuilder heifPb = new ProcessBuilder("heif-convert",
                    tempHeic.getAbsolutePath(),
                    tempPng.getAbsolutePath());
            heifPb.redirectErrorStream(true);
            Process heifProc = heifPb.start();

            // Capture heif-convert output
            ByteArrayOutputStream heifOut = new ByteArrayOutputStream();
            try (InputStream is = heifProc.getInputStream()) {
                is.transferTo(heifOut);
            }

            int heifCode = heifProc.waitFor();

            if (heifCode != 0 || !tempPng.exists() || tempPng.length() == 0) {
                String heifError = heifOut.toString(StandardCharsets.UTF_8);
                log.error("heif-convert failed (exit {}): {}", heifCode, heifError);
                throw new IOException("heif-convert failed (exit " + heifCode + "): " + heifError);
            }

            log.debug("Step 1 complete: PNG size {} bytes", tempPng.length());

            // Step 2: Convert PNG to optimized JPEG with ImageMagick
            log.debug("Step 2: Converting PNG to JPEG with ImageMagick");
            ProcessBuilder pb;
            if (magickCmd.equals("magick")) {
                pb = new ProcessBuilder("magick", "convert",
                        tempPng.getAbsolutePath(),
                        "-quality", "85",
                        "-auto-orient",
                        tempJpeg.getAbsolutePath());
            } else {
                pb = new ProcessBuilder(magickCmd,
                        tempPng.getAbsolutePath(),
                        "-quality", "85",
                        "-auto-orient",
                        tempJpeg.getAbsolutePath());
            }

            pb.redirectErrorStream(false);
            Process proc = pb.start();

            // Capture stderr
            ByteArrayOutputStream err = new ByteArrayOutputStream();
            Thread stderrReader = new Thread(() -> {
                try (InputStream es = proc.getErrorStream()) {
                    es.transferTo(err);
                } catch (IOException ignored) {}
            });
            stderrReader.setDaemon(true);
            stderrReader.start();

            int code = proc.waitFor();
            stderrReader.join(2000);

            if (code != 0 || !tempJpeg.exists() || tempJpeg.length() == 0) {
                String errorMsg = err.toString(StandardCharsets.UTF_8).trim();
                log.error("ImageMagick conversion failed (exit {}): {}", code, errorMsg);
                throw new IOException(
                        String.format("ImageMagick convert failed (exit %d): %s", code, errorMsg)
                );
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
            if (tempPng != null && tempPng.exists()) tempPng.delete();
            if (tempJpeg != null && tempJpeg.exists()) tempJpeg.delete();
        }
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
