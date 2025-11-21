package com.blossombuds.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
    private static final Logger log = LoggerFactory.getLogger(MagickBridge.class);




    private MagickBridge() {}

    /**
     * Convert HEIC/HEIF bytes to JPEG bytes using ImageMagick.
     * Uses file-based conversion to handle corrupt metadata better.
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

            // Try conversion - decode with libheif directly, bypass corrupt metadata
            ProcessBuilder pb;
            if (magickCmd.equals("magick")) {
                pb = new ProcessBuilder("magick", "convert",
                        tempHeic.getAbsolutePath() + "[0]",  // Force first frame
                        "-define", "heic:ignore-metadata=true",  // Bypass metadata
                        "-colorspace", "sRGB",
                        "-quality", "85",
                        tempJpeg.getAbsolutePath());
            } else {
                pb = new ProcessBuilder(magickCmd,
                        tempHeic.getAbsolutePath() + "[0]",  // Force first frame
                        "-define", "heic:ignore-metadata=true",  // Bypass metadata
                        "-colorspace", "sRGB",
                        "-quality", "85",
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

            log.debug("HEIC conversion successful, output size: {} bytes", jpegBytes.length);
            return jpegBytes;

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("ImageMagick convert interrupted", ie);
        } finally {
            // Clean up temp files
            if (tempHeic != null && tempHeic.exists()) {
                tempHeic.delete();
            }
            if (tempJpeg != null && tempJpeg.exists()) {
                tempJpeg.delete();
            }
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
