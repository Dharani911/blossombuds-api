package com.blossombuds.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
    private static final Logger log = LoggerFactory.getLogger(MagickBridge.class);

    private MagickBridge() {}

    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        if (heicBytes == null || heicBytes.length == 0) {
            throw new IOException("HEIC payload is empty");
        }

        String cmd = (magickCmd == null || magickCmd.isBlank())
                ? "convert"        // sensible default
                : magickCmd.trim();

        log.info("[MAGICK][HEIC] Converting HEIC to JPEG using cmd='{}', input={} bytes",
                cmd, heicBytes.length);

        File tempHeic = null;
        File tempJpeg = null;

        try {
            tempHeic = File.createTempFile("heic-input-", ".heic");
            tempJpeg = File.createTempFile("jpeg-output-", ".jpg");

            try (FileOutputStream fos = new FileOutputStream(tempHeic)) {
                fos.write(heicBytes);
            }

            boolean success = tryImageMagick(tempHeic, tempJpeg, cmd);

            if (!success) {
                throw new IOException("ImageMagick failed to convert HEIC → JPEG");
            }

            byte[] jpegBytes = new byte[(int) tempJpeg.length()];
            try (FileInputStream fis = new FileInputStream(tempJpeg)) {
                int read = fis.read(jpegBytes);
                if (read != jpegBytes.length) {
                    throw new IOException("Short read of JPEG output");
                }
            }

            log.info("[MAGICK][HEIC] Conversion OK, output={} bytes", jpegBytes.length);
            return jpegBytes;

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("Conversion interrupted", ie);
        } finally {
            if (tempHeic != null && tempHeic.exists()) tempHeic.delete();
            if (tempJpeg != null && tempJpeg.exists()) tempJpeg.delete();
        }
    }


    private static boolean tryImageMagick(File input, File output, String cmd)
            throws IOException, InterruptedException {

        ProcessBuilder pb;
        if ("magick".equals(cmd)) {
            pb = new ProcessBuilder("magick", "convert",
                    input.getAbsolutePath(), "-quality", "85", output.getAbsolutePath());
        } else {
            pb = new ProcessBuilder(cmd,
                    input.getAbsolutePath(), "-quality", "85", output.getAbsolutePath());
        }

        pb.redirectErrorStream(true);
        Process proc = pb.start();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        int code = proc.waitFor();
        String outputLog = out.toString(StandardCharsets.UTF_8);

        log.info("[MAGICK][PROC] cmd='{}' exitCode={} output=\n{}", cmd, code, outputLog);

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
