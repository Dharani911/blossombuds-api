package com.blossombuds.util;


import java.io.*;

public final class MagickBridge {
    private MagickBridge() {}

    /**
     * Convert HEIC/HEIF bytes to JPEG bytes using ImageMagick.
     * Requires the configured ImageMagick command ("magick" or full path) to be available.
     */
    public static byte[] heicToJpeg(byte[] heicBytes, String magickCmd) throws IOException {
        // NOTE: with IM7 you call "magick convert", then stream stdin → stdout
        ProcessBuilder pb = new ProcessBuilder(
                magickCmd, "convert", "heic:-", "jpeg:-"
        );
        pb.redirectErrorStream(true); // merge stderr into stdout for easier debugging
        Process proc = pb.start();

        // write HEIC to stdin
        try (OutputStream os = proc.getOutputStream()) {
            os.write(heicBytes);
        }

        // read JPEG from stdout
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream is = proc.getInputStream()) {
            is.transferTo(out);
        }

        try {
            int code = proc.waitFor();
            if (code != 0 || out.size() == 0) {
                throw new IOException("ImageMagick convert failed (exit " + code + ")");
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

