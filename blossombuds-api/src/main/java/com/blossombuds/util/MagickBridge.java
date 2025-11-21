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
     * Requires the configured ImageMagick command ("magick" or full path) to be available.
     */
    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        ProcessBuilder pb;
        if (magickCmd.equals("magick")) {
            // ImageMagick 7: magick convert heic:- jpeg:-
            pb = new ProcessBuilder("magick", "convert", "heic:-", "-quality", "85", "jpeg:-");
        } else {
            // ImageMagick 6: convert heic:- jpeg:-
            pb = new ProcessBuilder(magickCmd, "heic:-", "-quality", "85", "jpeg:-");
        }

        // Do not merge stderr; capture separately for detailed errors
        pb.redirectErrorStream(false);
        Process proc = pb.start();

        // Write HEIC to stdin
        try (OutputStream os = proc.getOutputStream()) {
            os.write(heicBytes);
        }

        // Prepare to capture stdout and stderr
        ByteArrayOutputStream out = new ByteArrayOutputStream();
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
            stderrReader.join(2000); // wait up to 2s for stderr

            if (code != 0 || out.size() == 0) {
                String errorMsg = err.toString("UTF-8").trim();
                throw new IOException(
                        String.format("ImageMagick convert failed (exit %d): %s", code, errorMsg)
                );
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("ImageMagick convert interrupted", ie);
        }

        return out.toByteArray();
    }

    /** quick helper */
    public static boolean looksLikeHeic(String contentType, String filename) {
        if (contentType != null && contentType.toLowerCase().startsWith("image/hei")) return true;
        if (filename != null) {
            String n = filename.toLowerCase();
            return n.endsWith(".heic") || n.endsWith(".heif");
        }
        return false;
    }

}
