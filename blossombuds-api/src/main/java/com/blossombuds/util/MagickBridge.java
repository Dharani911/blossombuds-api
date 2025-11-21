package com.blossombuds.util;

import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MagickBridge {
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

        // DON'T merge stderr - we need to capture it separately for errors
        pb.redirectErrorStream(false);
        Process proc = pb.start();

        // Write HEIC to stdin
        try (OutputStream os = proc.getOutputStream()) {
            os.write(heicBytes);
        }

        // Read JPEG from stdout
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // Capture stderr in parallel (errors appear here)
        ByteArrayOutputStream err = new ByteArrayOutputStream();

        Thread stderrReader = new Thread(() -> {
            try (InputStream es = proc.getErrorStream()) {
                es.transferTo(err);
            } catch (IOException e) {
                // Ignore
            }
        });
        stderrReader.start();

        // Read stdout
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        try {
            int code = proc.waitFor();
            stderrReader.join(1000); // Wait for stderr to finish

            if (code != 0 || out.size() == 0) {
                String errorMsg = err.toString(StandardCharsets.UTF_8);
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

    /** Quick helper */
    public static boolean looksLikeHeic(String contentType, String filename) {
        if (contentType != null && contentType.toLowerCase().startsWith("image/hei")) return true;
        if (filename != null) {
            String n = filename.toLowerCase();
            return n.endsWith(".heic") || n.endsWith(".heif");
        }
        return false;
    }
}
