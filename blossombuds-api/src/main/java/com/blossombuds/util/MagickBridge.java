package com.blossombuds.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
    private static final Logger log = LoggerFactory.getLogger(MagickBridge.class);

    private MagickBridge() {}

    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        log.debug("Converting HEIC to JPEG, input size: {} bytes", heicBytes.length);

        File tempHeic = null;
        File tempJpeg = null;

        try {
            tempHeic = File.createTempFile("heic-input-", ".heic");
            tempJpeg = File.createTempFile("jpeg-output-", ".jpg");

            // Write HEIC to temp file
            try (FileOutputStream fos = new FileOutputStream(tempHeic)) {
                fos.write(heicBytes);
            }

            // Try ImageMagick conversion
            boolean success = tryImageMagick(tempHeic, tempJpeg, magickCmd);

            // If it fails, just return the original HEIC (modern browsers support it)
            if (!success) {
                log.warn("ImageMagick failed - returning original HEIC (browser will handle it)");
                return heicBytes;
            }

            // Read converted JPEG
            byte[] jpegBytes = new byte[(int) tempJpeg.length()];
            try (FileInputStream fis = new FileInputStream(tempJpeg)) {
                fis.read(jpegBytes);
            }

            log.debug("Conversion successful, JPEG size: {} bytes", jpegBytes.length);
            return jpegBytes;

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("Conversion interrupted", ie);
        } finally {
            if (tempHeic != null && tempHeic.exists()) tempHeic.delete();
            if (tempJpeg != null && tempJpeg.exists()) tempJpeg.delete();
        }
    }

    private static boolean tryImageMagick(File input, File output, String magickCmd)
            throws IOException, InterruptedException {

        ProcessBuilder pb;
        if (magickCmd.equals("magick")) {
            pb = new ProcessBuilder("magick", "convert",
                    input.getAbsolutePath(), "-quality", "85", output.getAbsolutePath());
        } else {
            pb = new ProcessBuilder(magickCmd,
                    input.getAbsolutePath(), "-quality", "85", output.getAbsolutePath());
        }

        pb.redirectErrorStream(true);
        Process proc = pb.start();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        int code = proc.waitFor();
        return (code == 0 && output.exists() && output.length() > 0);
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
