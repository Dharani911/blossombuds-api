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
     */
    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        log.debug("Converting HEIC to JPEG, input size: {} bytes", heicBytes.length);

        ProcessBuilder pb;
        if (magickCmd.equals("magick")) {
            // ImageMagick 7: magick convert heic:- jpeg:-
            pb = new ProcessBuilder("magick", "convert", "heic:-", "-quality", "85", "jpeg:-");
        } else {
            // ImageMagick 6: convert heic:- jpeg:-
            pb = new ProcessBuilder(magickCmd, "heic:-", "-quality", "85", "jpeg:-");
        }

        pb.redirectErrorStream(false); // Keep stderr separate for error capture
        Process proc = pb.start();

        // Write HEIC to stdin
        try (OutputStream os = proc.getOutputStream()) {
            os.write(heicBytes);
        } catch (IOException e) {
            proc.destroyForcibly();
            throw new IOException("Failed to write HEIC data to ImageMagick stdin", e);
        }

        // Read JPEG from stdout
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // Capture stderr for error messages
        ByteArrayOutputStream err = new ByteArrayOutputStream();
        Thread stderrReader = new Thread(() -> {
            try (InputStream es = proc.getErrorStream()) {
                es.transferTo(err);
            } catch (IOException ignored) {}
        });
        stderrReader.setDaemon(true);
        stderrReader.start();

        // Read stdout
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        try {
            int code = proc.waitFor();
            stderrReader.join(2000); // Wait up to 2s for stderr

            if (code != 0 || out.size() == 0) {
                String errorMsg = err.toString(StandardCharsets.UTF_8).trim();
                log.error("ImageMagick conversion failed (exit {}): {}", code, errorMsg);
                throw new IOException(
                        String.format("ImageMagick convert failed (exit %d): %s", code, errorMsg)
                );
            }

            log.debug("HEIC conversion successful, output size: {} bytes", out.size());
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            proc.destroyForcibly();
            throw new IOException("ImageMagick convert interrupted", ie);
        }

        return out.toByteArray();
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
