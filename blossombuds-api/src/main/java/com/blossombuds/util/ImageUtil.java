

package com.blossombuds.util;

import javax.imageio.*;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.font.FontRenderContext;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.*;
import org.springframework.web.multipart.MultipartFile;



public final class ImageUtil {
    private ImageUtil() {}
    private static final long MAX_BYTES = 10L * 1024 * 1024;


    public static final int  MAX_DIM          = 1800;
    // ~250 KB cap
    public static final long MAX_OUTPUT_BYTES = 250L * 1024L;  // 256000 bytes

    public static final float QUALITY_START = 0.80f;
    public static final float QUALITY_FLOOR = 0.20f;  // allow more aggressive compression

    // Accept by MIME *or* filename extension (Chrome often sends HEIC as octet-stream)
    public static void validateFileEnvelope(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Max 10 MB per image");
        }

        final String ct = (file.getContentType() == null ? "" : file.getContentType()).toLowerCase();
        final String name = (file.getOriginalFilename() == null ? "" : file.getOriginalFilename()).toLowerCase();

        // allow common image extensions (incl. HEIC/HEIF)
        boolean extOk = name.matches(".*\\.(jpe?g|png|webp|tiff?|heic|heif|bmp|gif)$");
        boolean looksImage = ct.startsWith("image/") || extOk || ct.equals("application/octet-stream");

        if (!looksImage) {
            throw new IllegalArgumentException("Only image files are supported (JPG, PNG, WebP, HEIC…)");
        }
    }



    public static byte[] toJpegBytes(BufferedImage img) throws IOException {
        return toJpegUnderCap(img); // uses the 250 KB cap now
    }

    public static BufferedImage readAny(MultipartFile file) throws IOException {
        try (InputStream in = file.getInputStream()) {
            BufferedImage img = ImageIO.read(in);
            if (img == null) throw new IllegalArgumentException("Unsupported or corrupted image format");
            return img;
        }
    }

    public static BufferedImage fitWithin(BufferedImage src, int maxDim) {
        int w = src.getWidth(), h = src.getHeight();
        double scale = Math.min(1.0, (double) maxDim / Math.max(w, h));
        if (scale >= 1.0) return ensureRGB(src);
        int nw = (int)Math.round(w * scale), nh = (int)Math.round(h * scale);
        BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.drawImage(src, 0, 0, nw, nh, Color.WHITE, null);
        g.dispose();
        return dst;
    }

    public static BufferedImage ensureRGB(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) return src;
        BufferedImage dst = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dst.createGraphics();
        g.drawImage(src, 0, 0, Color.WHITE, null);
        g.dispose();
        return dst;
    }

    /** Try file path, then classpath /watermark.png; null if both missing. */
    public static BufferedImage loadWatermarkOrNull(String pathOrNull) {
        // 1) explicit file path
        if (pathOrNull != null) {
            File f = new File(pathOrNull);
            if (f.exists() && f.isFile()) {
                try { return ImageIO.read(f); } catch (Exception ignored) {}
            }
        }
        // 2) classpath fallback
        try (InputStream in = ImageUtil.class.getClassLoader().getResourceAsStream("watermark.png")) {
            if (in != null) return ImageIO.read(in);
        } catch (Exception ignored) {}
        return null;
    }

    /** Apply watermark using provided path (falls back to classpath or text). */
    public static BufferedImage applyWatermark(BufferedImage base, String watermarkPath) {
        BufferedImage out = new BufferedImage(base.getWidth(), base.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.drawImage(base, 0, 0, null);

        BufferedImage wm = loadWatermarkOrNull(watermarkPath);
        float alpha = 0.12f;

        AffineTransform oldTx = g.getTransform();
        g.rotate(Math.toRadians(-30), base.getWidth() / 2.0, base.getHeight() / 2.0);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha));

        if (wm != null) {
            int target = Math.max(120, Math.min(base.getWidth(), base.getHeight()) / 3);
            double s = Math.min((double)target / wm.getWidth(), (double)target / wm.getHeight());
            int ww = (int)Math.round(wm.getWidth() * s);
            int wh = (int)Math.round(wm.getHeight() * s);
            for (int y = -wh; y < base.getHeight() + wh; y += wh + 80) {
                for (int x = -ww; x < base.getWidth() + ww; x += ww + 120) {
                    g.drawImage(wm, x, y, ww, wh, null);
                }
            }
        } else {
            // text fallback so you ALWAYS see a watermark
            String text = "Blossom Buds";
            g.setColor(new Color(0, 0, 0));
            int size = Math.max(18, Math.min(base.getWidth(), base.getHeight()) / 14);
            g.setFont(new Font("SansSerif", Font.BOLD, size));
            FontRenderContext frc = g.getFontRenderContext();
            int tw = (int) g.getFont().getStringBounds(text, frc).getWidth();
            int th = g.getFontMetrics().getAscent();
            for (int y = -th; y < base.getHeight() + th; y += th + 120) {
                for (int x = -tw; x < base.getWidth() + tw; x += tw + 160) {
                    g.drawString(text, x, y);
                }
            }
        }
        g.setTransform(oldTx);
        g.dispose();
        return out;
    }
    /** Subtle diagonal watermark: sparse tiling + softer alpha + outline for contrast. */
    // ImageUtil.java
    public static BufferedImage applyWatermarkBalanced(BufferedImage src, BufferedImage wmBadge) throws IOException, InterruptedException {
        // Semi-opaque, drop shadow, works on light & dark
        return watermarkViaIM(
                src, wmBadge,
                new WatermarkOptions()
                        .mode(WatermarkMode.CENTER)
                        .opacity(0.18)         // ↑ stronger than before (e.g., 18%)
                        .scaleToWidthFrac(0.35) // badge ~35% of image width
                        .blend("overlay")       // overlay works across tones; try "softlight" if you prefer
                        .shadow(true)
        );
    }

    public static BufferedImage applyWatermarkTiled(BufferedImage src, BufferedImage wmBadge) throws IOException, InterruptedException {
        // Denser tile grid + visible opacity
        return watermarkViaIM(
                src, wmBadge,
                new WatermarkOptions()
                        .mode(WatermarkMode.TILE)
                        .opacity(0.12)         // was too faint; bump to 12–15%
                        .tileSpacingPx(260)    // ↓ tighter spacing (adjust 180–320 as taste)
                        .angle(30)             // diagonal
                        .blend("overlay")      // or "softlight"
                        .shadow(false)
        );
    }

    /** Much stronger, contrast-safe watermark (image or text fallback). */
    /** Subtle translucent band at bottom with logo/text; minimal obstruction. */
    public static BufferedImage applyWatermarkBand(BufferedImage base, BufferedImage wm) {
        BufferedImage out = new BufferedImage(base.getWidth(), base.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(base, 0, 0, null);

        final int W = base.getWidth(), H = base.getHeight();
        final int bandH = Math.max( (int)(H * 0.10), 72);        // ~10% height
        final int y0 = H - bandH;

        // soft gradient band
        Paint oldPaint = g.getPaint();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.18f));
        g.setPaint(new GradientPaint(0, y0, new Color(0,0,0,140), 0, H, new Color(0,0,0,40)));
        g.fillRect(0, y0, W, bandH);
        g.setPaint(oldPaint);

        // logo or text on top, centered-left
        int padding = 18;
        if (wm != null) {
            int targetH = bandH - padding * 2;
            double s = Math.min((double) targetH / wm.getHeight(), (double) (W * 0.3) / wm.getWidth());
            int ww = (int) Math.round(wm.getWidth() * s);
            int wh = (int) Math.round(wm.getHeight() * s);
            BufferedImage buf = new BufferedImage(ww, wh, BufferedImage.TYPE_INT_ARGB);
            Graphics2D gb = buf.createGraphics();
            gb.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            gb.drawImage(wm, 0, 0, ww, wh, null);
            gb.dispose();

            // gentle outline + face
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.25f));
            drawTinted(g, buf, padding + 1, y0 + (bandH - wh) / 2 + 1, Color.BLACK);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.20f));
            drawTinted(g, buf, padding,     y0 + (bandH - wh) / 2,     Color.WHITE);
        } else {
            String text = "Blossom & Buds";
            g.setFont(new Font("SansSerif", Font.BOLD, Math.max(20, (int)(bandH * 0.45))));
            FontMetrics fm = g.getFontMetrics();
            int tx = padding;
            int ty = y0 + (bandH + fm.getAscent() - fm.getDescent()) / 2;
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.25f));
            g.setColor(Color.BLACK); g.drawString(text, tx + 2, ty + 2);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.20f));
            g.setColor(Color.WHITE); g.drawString(text, tx, ty);
        }

        g.dispose();
        return out;
    }


    /** Helper: draw an image tinted to a solid color while keeping alpha. */
    private static void drawTinted(Graphics2D g, BufferedImage src, int x, int y, Color tint) {
        g.drawImage(src, x, y, null);
        Composite old = g.getComposite();
        g.setComposite(AlphaComposite.SrcAtop);
        g.setColor(tint);
        g.fillRect(x, y, src.getWidth(), src.getHeight());
        g.setComposite(old);
    }



    /** Encode JPEG under MAX_OUTPUT_BYTES, reducing quality until the cap is met. */
    public static byte[] toJpegUnderCap(BufferedImage img) throws IOException {
        float q = QUALITY_START;
        byte[] out;
        while (true) {
            out = writeJpeg(img, q);
            if (out.length <= MAX_OUTPUT_BYTES || q <= QUALITY_FLOOR) return out;
            q -= 0.05f;
        }
    }

    public static byte[] writeJpeg(BufferedImage img, float quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
        ImageWriteParam p = writer.getDefaultWriteParam();
        p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        p.setCompressionQuality(quality);
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), p);
        } finally {
            writer.dispose();
        }
        return baos.toByteArray();
    }
    // ImageUtil.java (cont.)
    enum WatermarkMode { CENTER, TILE }
    static class WatermarkOptions {
        WatermarkMode mode = WatermarkMode.CENTER;
        double opacity = 0.15;            // 0..1
        String blend = "overlay";         // overlay|softlight|multiply|screen
        double scaleToWidthFrac = 0.33;   // for CENTER mode
        boolean shadow = true;            // drop shadow for CENTER
        int tileSpacingPx = 300;          // for TILE mode
        int angle = 30;                   // for TILE mode
        // setters...
        WatermarkOptions mode(WatermarkMode m){ this.mode=m; return this; }
        WatermarkOptions opacity(double o){ this.opacity=o; return this; }
        WatermarkOptions blend(String b){ this.blend=b; return this; }
        WatermarkOptions scaleToWidthFrac(double f){ this.scaleToWidthFrac=f; return this; }
        WatermarkOptions shadow(boolean s){ this.shadow=s; return this; }
        WatermarkOptions tileSpacingPx(int px){ this.tileSpacingPx=px; return this; }
        WatermarkOptions angle(int a){ this.angle=a; return this; }
    }

    static BufferedImage watermarkViaIM(BufferedImage src, BufferedImage badge, WatermarkOptions opt)
            throws IOException, InterruptedException {

        File srcPng = File.createTempFile("wm-src", ".png");
        File wmPng  = File.createTempFile("wm-badge", ".png");
        File outPng = File.createTempFile("wm-out", ".png");

        try {
            javax.imageio.ImageIO.write(src, "png", srcPng);
            javax.imageio.ImageIO.write(badge, "png", wmPng);

            final String MAGICK = ImageMagickUtil.magickCmd(); // "magick"

            if (opt.mode == WatermarkMode.CENTER) {
                // Centered badge: scale relative to width, overlay blend, optional shadow for visibility
                String opacityPct = String.valueOf((int)Math.round(opt.opacity * 100));
                String scaleExpr  = String.format("%%[w]*%.3f", opt.scaleToWidthFrac);

                // Build command
                java.util.List<String> cmd = new java.util.ArrayList<>();
                cmd.addAll(java.util.Arrays.asList(
                        MAGICK, srcPng.getAbsolutePath(),
                        "(", wmPng.getAbsolutePath(),
                        "-resize", scaleExpr,  // scale badge
                        ")",
                        "-gravity", "center",
                        "-compose", opt.blend,   // overlay or softlight
                        "-define", "compose:args=" + opacityPct, // IM7 compose opacity
                        "-composite"
                ));

                if (opt.shadow) {
                    // subtle shadow to lift over busy backgrounds
                    // duplicate composite result and shadow the badge area:
                    // Easiest approach: do a second overlay with a blurred black badge under the main one.
                    // For simplicity we run a small second composite step:
                    File tempWithBadge = File.createTempFile("wm-mid", ".png");
                    cmd.add(tempWithBadge.getAbsolutePath());
                    ImageMagickUtil.execOrThrow(cmd.toArray(new String[0]));

                    String[] shadowCmd = {
                            MAGICK, tempWithBadge.getAbsolutePath(),
                            "(", wmPng.getAbsolutePath(),
                            "-resize", scaleExpr,
                            "-fill", "black",
                            "-colorize", "100",
                            "-blur", "0x2",
                            "-alpha", "set",
                            "-evaluate", "Multiply", "0.35", // shadow strength
                            ")",
                            "-gravity", "center",
                            "-compose", "over",
                            "-geometry", "+2+3",               // slight offset
                            "-composite",
                            outPng.getAbsolutePath()
                    };
                    ImageMagickUtil.execOrThrow(shadowCmd);
                    tempWithBadge.delete();
                } else {
                    cmd.add(outPng.getAbsolutePath());
                    ImageMagickUtil.execOrThrow(cmd.toArray(new String[0]));
                }

            } else {
                // Tiled diagonal text/badge: create a tile canvas then overlay
                // We’ll create a tile from the badge, rotated, with spacing via -splice.
                String opacityPct = String.valueOf((int)Math.round(opt.opacity * 100));
                String spacing = String.valueOf(opt.tileSpacingPx);
                String angle   = String.valueOf(opt.angle);

                // Create a tile pattern in memory: canvas with transparent bg, place rotated badge center, then tile.
                // Approach: use -size WxH to spacing, place center, rotate, then -tile over src.
                String[] cmd = {
                        MAGICK, srcPng.getAbsolutePath(),
                        "(",  // build a tile image
                        "-size", spacing + "x" + spacing,
                        "canvas:none",
                        "(", wmPng.getAbsolutePath(), "-resize", "40%", ")",           // scale each tile mark
                        "-gravity", "center", "-compose", "over", "-composite",
                        "-rotate", angle,
                        ")",
                        "-compose", opt.blend, "-define", "compose:args=" + opacityPct,
                        "-tile", "+0+0", "-composite",
                        outPng.getAbsolutePath()
                };
                ImageMagickUtil.execOrThrow(cmd);
            }

            return javax.imageio.ImageIO.read(outPng);

        } finally {
            srcPng.delete(); wmPng.delete(); outPng.delete();
        }
    }
    public static BufferedImage applyTextWatermarkTiled(
            BufferedImage src,
            String text,
            float alpha,            // 0..1 (e.g., 0.12f)
            double rotationDeg,     // e.g., -30
            double density          // tiles per min(width, height); e.g., 0.10 -> ~every 10% of min dim
    ) {
        int w = src.getWidth();
        int h = src.getHeight();

        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();

        // draw base image
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.drawImage(src, 0, 0, null);

        // choose font size relative to min dimension
        int minDim = Math.min(w, h);
        // each tile should be readable but not overwhelming
        float fontSize = Math.max(14f, (float)(minDim * 0.05)); // 5% of min dim
        Font font = new Font("SansSerif", Font.BOLD, Math.round(fontSize));

        // paint setup
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha));
        g.setColor(new Color(0, 0, 0, 180)); // dark text (alpha handled by Composite)

        // measure text
        g.setFont(font);
        FontMetrics fm = g.getFontMetrics();
        int tw = fm.stringWidth(text);
        int th = fm.getAscent(); // use ascent for vertical step feeling natural

        // tile spacing: based on density and text size
        // density: tiles per min dimension; step tries to make a grid that repeats often
        int baseStep = Math.max(th, Math.min(w, h) / (int)Math.max(1, Math.round(minDim * density)));
        int stepX = Math.max(tw + 20, baseStep + tw); // ensure space so text doesn't overlap too much
        int stepY = Math.max(th + 20, baseStep + th);

        // rotation
        double theta = Math.toRadians(rotationDeg);
        AffineTransform oldTx = g.getTransform();
        g.rotate(theta, w / 2.0, h / 2.0);

        // start slightly off-screen so corners get covered when rotated
        int startX = -w;
        int startY = -h;
        int endX = w * 2;
        int endY = h * 2;

        for (int y = startY; y < endY; y += stepY) {
            for (int x = startX; x < endX; x += stepX) {
                g.drawString(text, x, y);
            }
        }

        // restore
        g.setTransform(oldTx);
        g.dispose();
        return out;
    }
    public static BufferedImage watermarkDiagonalBand(BufferedImage src, String text) {
        int w = src.getWidth(), h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // draw original
        g.drawImage(src, 0, 0, null);

        // rotate canvas so the band runs along the image diagonal
        double angle = Math.atan2(h, w);
        g.translate(w / 2.0, h / 2.0);
        g.rotate(-angle);

        // band: thinner & lower alpha (subtle)
        int L = (int) Math.ceil(Math.hypot(w, h));                  // length across diagonal
        int band = Math.max(18, Math.round(Math.min(w, h) * 0.16f)); // ~16% of the short side
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.10f)); // band visibility
        g.setColor(Color.BLACK);
        g.fillRect(-L, -band / 2, L * 2, band);

        // text: smaller, spaced, low-contrast double pass for readability on light/dark
        float fontSize = Math.max(16f, Math.min(w, h) * 0.070f);     // ~7% of short side
        Font font = g.getFont().deriveFont(Font.BOLD, fontSize);
        g.setFont(font);
        FontMetrics fm = g.getFontMetrics();
        int textW = fm.stringWidth(text);
        int gap = Math.max(14, (int) (fontSize * 0.55f));
        int step = Math.max(20, textW + gap);
        int baselineY = Math.round(fm.getAscent() * 0.35f);

        // faint white ghost first (helps on very dark pixels)
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.07f));
        g.setColor(Color.WHITE);
        for (int x = -L * 2; x <= L * 2; x += step) {
            g.drawString(text, x, baselineY);
        }

        // then subtle black (helps on light pixels)
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.16f));
        g.setColor(Color.BLACK);
        for (int x = -L * 2; x <= L * 2; x += step) {
            g.drawString(text, x, baselineY);
        }

        g.dispose();
        return out;
    }


}
