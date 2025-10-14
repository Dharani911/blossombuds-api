// src/main/java/com/blossombuds/service/FileImageService.java
package com.blossombuds.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.apache.commons.io.FilenameUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileImageService {

    @Value("${feature.images.dir:media/feature-tiles}")
    private String featureImagesDir;

    // Aspect/size for your FeatureTiles (feel free to tweak)
    private static final int TARGET_WIDTH = 1200;   // displayed large on desktop
    private static final int TARGET_HEIGHT = 800;   // 3:2-ish; set your desired tile aspect

    public record SavedImage(String key, String url) {}

    public SavedImage saveFeatureTile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        // Ensure directory exists
        Path baseDir = Paths.get(featureImagesDir).toAbsolutePath().normalize();
        Files.createDirectories(baseDir);

        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String ext = extFrom(file, origName);
        boolean isHeic = ext.equalsIgnoreCase("heic") || ext.equalsIgnoreCase("heif");

        // Normalize final extension (we’ll store as JPEG if HEIC/HEIF)
        String finalExt = isHeic ? "jpg" : ext.toLowerCase(Locale.ROOT);

        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String safeBase = FilenameUtils.getBaseName(origName).replaceAll("[^a-zA-Z0-9-_]+","-");
        if (safeBase.isBlank()) safeBase = "img";
        String fname = safeBase + "-" + stamp + "." + finalExt;

        Path out = baseDir.resolve(fname);

        // Decode → resize/crop → encode
        if (isHeic) {
            // Try ImageMagick if available
            // convert input(heic bytes) -> jpg temp → read → thumb → save
            Path tmpIn = Files.createTempFile("heic-in-", ".heic");
            Path tmpJpg = Files.createTempFile("heic-out-", ".jpg");
            try (OutputStream os = Files.newOutputStream(tmpIn, StandardOpenOption.TRUNCATE_EXISTING)) {
                os.write(file.getBytes());
            }
            boolean converted = convertHeicToJpg(tmpIn, tmpJpg);
            if (!converted) {
                Files.deleteIfExists(tmpIn);
                Files.deleteIfExists(tmpJpg);
                throw new IOException("HEIC/HEIF not supported on server. Please upload JPEG/PNG.");
            }
            try (InputStream is = Files.newInputStream(tmpJpg)) {
                BufferedImage src = ImageIO.read(is);
                BufferedImage thumb = cropResize(src, TARGET_WIDTH, TARGET_HEIGHT);
                saveJpeg(thumb, out);
            } finally {
                Files.deleteIfExists(tmpIn);
                Files.deleteIfExists(tmpJpg);
            }
        } else {
            try (InputStream is = file.getInputStream()) {
                BufferedImage src = ImageIO.read(is);
                if (src == null) throw new IOException("Unsupported image format");
                BufferedImage thumb = cropResize(src, TARGET_WIDTH, TARGET_HEIGHT);
                if (finalExt.equals("png")) {
                    ImageIO.write(thumb, "png", out.toFile());
                } else if (finalExt.equals("webp")) {
                    ImageIO.write(thumb, "webp", out.toFile());
                } else {
                    saveJpeg(thumb, out);
                }
            }
        }

        String key = "feature-tiles/" + out.getFileName();
        String url = "/media/" + key;
        return new SavedImage(key, url);
    }

    public void deleteFeatureTile(String key) throws IOException {
        if (key == null || key.isBlank()) return;
        Path baseDir = Paths.get(featureImagesDir).toAbsolutePath().normalize();
        Path target = baseDir.resolve(Paths.get(key).getFileName().toString());
        Files.deleteIfExists(target);
    }

    private static BufferedImage cropResize(BufferedImage src, int targetW, int targetH) throws IOException {
        double targetRatio = (double) targetW / targetH;
        int sw = src.getWidth();
        int sh = src.getHeight();
        double srcRatio = (double) sw / sh;

        // center-crop to match aspect
        int cw = sw;
        int ch = sh;
        if (srcRatio > targetRatio) {
            // too wide -> cut sides
            cw = (int)(sh * targetRatio);
        } else {
            // too tall -> cut top/bottom
            ch = (int)(sw / targetRatio);
        }
        int x = (sw - cw)/2;
        int y = (sh - ch)/2;

        return Thumbnails.of(src)
                .sourceRegion(x, y, cw, ch)
                .size(targetW, targetH)
                .keepAspectRatio(false)
                .asBufferedImage();
    }

    private static void saveJpeg(BufferedImage bi, Path out) throws IOException {
        // Thumbnailator does nice JPEG compression via OutputQuality
        Thumbnails.of(bi)
                .size(bi.getWidth(), bi.getHeight())
                .outputFormat("jpg")
                .outputQuality(0.82f) // tweak if you want smaller files
                .toFile(out.toFile());
    }

    private static String extFrom(MultipartFile f, String original) {
        // prefer content-type, fallback to filename
        String ct = f.getContentType();
        if (ct != null) {
            if (ct.equalsIgnoreCase(MediaType.IMAGE_JPEG_VALUE)) return "jpg";
            if (ct.equalsIgnoreCase(MediaType.IMAGE_PNG_VALUE)) return "png";
            if (ct.equalsIgnoreCase("image/webp")) return "webp";
            if (ct.equalsIgnoreCase("image/heic") || ct.equalsIgnoreCase("image/heif")) return "heic";
        }
        String e = FilenameUtils.getExtension(original);
        return (e == null || e.isBlank()) ? "jpg" : e;
    }

    private static boolean convertHeicToJpg(Path in, Path outJpg) {
        try {
            // Requires ImageMagick (convert) installed with HEIC support
            Process p = new ProcessBuilder("convert", in.toString(), outJpg.toString())
                    .redirectErrorStream(true)
                    .start();
            int code = p.waitFor();
            return code == 0 && Files.exists(outJpg);
        } catch (Exception e) {
            return false;
        }
    }
}
