package com.blossombuds.util;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;

public final class ImageMagickUtil {

    private ImageMagickUtil(){}

    /* ------------------------- Small helpers ------------------------- */

    public static boolean isHeicLike(String filename, String contentType) {
        String n = filename == null ? "" : filename.toLowerCase();
        String ct = contentType == null ? "" : contentType.toLowerCase();
        return n.endsWith(".heic") || n.endsWith(".heif")
                || ct.startsWith("image/heic") || ct.startsWith("image/heif");
    }

    /** Return the ImageMagick CLI. Adjust if you need a full path or IM6's "convert". */
    public static String magickCmd() {
        return "magick"; // IM7 on Windows/macOS/Linux; change to "convert" if you use IM6
    }

    static void execOrThrow(String[] cmd) throws IOException, InterruptedException {
        Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        String log = new String(p.getInputStream().readAllBytes());
        int code = p.waitFor();
        if (code != 0) {
            throw new IOException("ImageMagick failed (" + code + "): " + log);
        }
    }

    /* -------------------- Core functions used by service -------------------- */

    /**
     * Normalize any input to sRGB JPEG (no resize here, just rotation fix & stripping metadata).
     * We keep quality moderate (90) since final size clamping is done by {@link #targetSizeJpeg(BufferedImage)}.
     */
    public static byte[] ensureJpeg(byte[] input, String filename, String contentType)
            throws IOException, InterruptedException {

        // If it's already a JPEG, short-circuit
        String n = filename == null ? "" : filename.toLowerCase();
        String ct = contentType == null ? "" : contentType.toLowerCase();
        boolean alreadyJpeg = n.endsWith(".jpg") || n.endsWith(".jpeg")
                || ct.contains("jpeg") || ct.endsWith("/jpg");
        if (alreadyJpeg) return input;

        File in  = File.createTempFile("im-in-", ".bin");
        File out = File.createTempFile("im-out-", ".jpg");
        try (FileOutputStream fos = new FileOutputStream(in)) { fos.write(input); }
        try {
            String[] cmd = {
                    magickCmd(), in.getAbsolutePath(),
                    "-colorspace", "sRGB",
                    "-auto-orient",
                    "-strip",
                    "-quality", "90",
                    out.getAbsolutePath()
            };
            execOrThrow(cmd);
            return Files.readAllBytes(out.toPath());
        } finally {
            // best-effort cleanup
            //noinspection ResultOfMethodCallIgnored
            in.delete();
            //noinspection ResultOfMethodCallIgnored
            out.delete();
        }
    }

    /** Read a BufferedImage from bytes safely (throws on unsupported/corrupt). */
    public static BufferedImage readImage(byte[] bytes) throws IOException {
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            BufferedImage bi = ImageIO.read(in);
            if (bi == null) throw new IOException("Unsupported/corrupt image");
            return bi;
        }
    }

    /**
     * Produce a visually crisp JPEG under ~300 KB.
     * - Downscales long edge to 1600px if larger.
     * - Uses IM options for good quality/size: Lanczos, slight unsharp, progressive, optimize coding.
     * - Binary searches quality (55..88) to stay ≤ 300 KB.
     */
    public static byte[] targetSizeJpeg(BufferedImage src) throws IOException, InterruptedException {
        final int TARGET_BYTES = 300 * 1024;  // 300 KB
        final int MAX_W = 1600;               // clamp long edge
        final int MIN_Q = 55, MAX_Q = 88;     // safe visual band
        final String MAGICK = magickCmd();

        File in = File.createTempFile("im-in", ".png");
        File out = File.createTempFile("im-out", ".jpg");
        try {
            javax.imageio.ImageIO.write(src, "png", in);

            int lo = MIN_Q, hi = MAX_Q;
            byte[] best = null;

            while (lo <= hi) {
                int q = (lo + hi) / 2;
                if (out.exists()) out.delete();

                String[] cmd = {
                        MAGICK, in.getAbsolutePath(),
                        "-colorspace", "sRGB",
                        "-auto-orient",
                        "-filter", "Lanczos",
                        "-resize", MAX_W + "x" + MAX_W + ">",   // only shrink
                        "-unsharp", "0x0.6+0.6+0.004",
                        "-strip",
                        "-interlace", "Plane",
                        "-sampling-factor", "4:2:0",
                        "-define", "jpeg:optimize-coding=true",
                        "-define", "jpeg:dct-method=float",
                        "-quality", String.valueOf(q),
                        out.getAbsolutePath()
                };
                execOrThrow(cmd);

                byte[] bytes = Files.readAllBytes(out.toPath());
                if (bytes.length <= TARGET_BYTES) {
                    best = bytes;         // keep this as current best
                    lo = q + 1;           // try higher quality
                } else {
                    hi = q - 1;           // too big → lower quality
                }
            }

            if (best != null) return best;

            // Fallback at MIN_Q (always produce something)
            String[] cmdMin = {
                    MAGICK, in.getAbsolutePath(),
                    "-colorspace", "sRGB",
                    "-auto-orient",
                    "-filter", "Lanczos",
                    "-resize", MAX_W + "x" + MAX_W + ">",
                    "-unsharp", "0x0.6+0.6+0.004",
                    "-strip",
                    "-interlace", "Plane",
                    "-sampling-factor", "4:2:0",
                    "-define", "jpeg:optimize-coding=true",
                    "-define", "jpeg:dct-method=float",
                    "-quality", String.valueOf(MIN_Q),
                    out.getAbsolutePath()
            };
            execOrThrow(cmdMin);
            return Files.readAllBytes(out.toPath());

        } finally {
            //noinspection ResultOfMethodCallIgnored
            in.delete();
            //noinspection ResultOfMethodCallIgnored
            out.delete();
        }
    }
}
