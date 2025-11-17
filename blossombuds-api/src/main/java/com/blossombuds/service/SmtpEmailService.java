package com.blossombuds.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** SMTP implementation using Spring Mail (HTML + plain text with inline brand logo + masked links). */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;
    private final SettingsService settings; // read brand.support_email / brand.whatsapp / brand.name / brand.url

    @Value("${app.mail.from:noreply@example.com}")
    private String from;

    /**
     * Frontend base URL, same idea as PasswordResetService.
     * - In PROD, set: app.frontend.baseUrl=https://www.blossom-buds-floral-artistry.com
     * - In LOCAL/DEV, leave blank to generate relative links (/profile?code=...).
     */
    @Value("${app.frontend.baseUrl:}")
    private String frontendBase;

    // Default/fallback brand if setting not provided
    private static final String BRAND_FALLBACK = "Blossom Buds Floral Artistry";

    // Inline logo classpath paths (prefer PNG for better client support; fallback to SVG)
    @Value("${app.mail.logo.png:static/BB_logo.png}")
    private String logoPngPath;

    @Value("${app.mail.logo.svg:static/BB_logo.svg}")
    private String logoSvgPath;

    private static final String LOGO_CID = "bb-logo";

    /* ========================= Link masking helpers ========================= */

    /** Marker: {{A|Label|URL}}  -> HTML <a href="URL">Label</a> ; Plain: "Label" */
    private static final Pattern A_MARKER = Pattern.compile("\\{\\{A\\|([^|}]+)\\|([^}]+)}}");

    // Marker: {{A|Label|URL}}  -> HTML: 🔗 Label (blue) ; Plain: just "Label"
    private static String maskToHtml(String src) {
        if (src == null) return "";
        Matcher m = A_MARKER.matcher(src);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String label = escape(m.group(1));
            String href = escapeAttr(m.group(2));
            // Blue link + leading "link" symbol; nbsp keeps spacing tight in clients
            String repl =
                    "<a href=\"" + href + "\" " +
                            "style=\"color:#1a73e8;text-decoration:underline;\">" +
                            "🔗&#160;" + label + "</a>";
            m.appendReplacement(sb, repl);
        }
        m.appendTail(sb);
        return sb.toString();
    }


    private static String maskToPlain(String src) {
        if (src == null) return "";
        return A_MARKER.matcher(src).replaceAll("$1"); // keep only the label in plain text
    }

    /* ========================= Public API (implements EmailService) ========================= */

    /** Sends an email verification link to a customer. */
    @Override
    public void sendVerificationEmail(String toEmail, String verifyUrl) {
        log.info("[EMAIL][VERIFICATION] to='{}'", toEmail);
        String subject = "Verify your email";
        String body = """
            Hi there,

            Welcome to %s!
            Please verify your email address to activate your account:

            {{A|Verify your email|%s}}

            %s

            Warm regards,
            %s
            """.formatted(brandName(), verifyUrl, contactLineText(), brandName());

        sendRichMasked(toEmail, subject, body);
    }

    /** Sends a password reset link to a customer/admin. */
    @Override
    public void sendPasswordResetEmail(String toEmail, String resetUrl) {
        log.info("[EMAIL][RESET] to='{}'", toEmail);
        String subject = "Reset your password";
        String body = """
            Hi there,

            We received a request to reset your password.
            You can set a new password using the link below:

            {{A|Reset your password|%s}}

            %s

            Warm regards,
            %s
            """.formatted(resetUrl, contactLineText(), brandName());

        sendRichMasked(toEmail, subject, body);
    }

    /** Sends order confirmation with code and total (public code is YYNNNN; rendered as BBYYNNNN). */
    @Override
    public void sendOrderConfirmation(String toEmail, String toName,
                                      String publicCodeYYNNNN, String currency, BigDecimal grandTotal) {
        log.info("[EMAIL][ORDER_CONFIRMED] to='{}' code='{}'", toEmail, publicCodeYYNNNN);
        String subject = "Your order " + publicCodeYYNNNN + " is confirmed";
        String total = formatMoney(grandTotal, currency);
        String body = """
            Hi %s,

            Thank you for your order with %s.

            Order:  %s
            Total:  %s

            You’ll receive another update as soon as your items are dispatched.

            %s

            Warm regards,
            %s
            """.formatted(safeName(toName), brandName(), publicCodeYYNNNN, total, contactLineText(), brandName());

        sendRichMasked(toEmail, subject, body);
    }

    /** Sends a notification when order status changes, optionally with note and tracking link. */
    @Override
    public void sendOrderStatusChanged(String toEmail, String toName,
                                       String publicCodeYYNNNN, String newStatus, String note, String trackingUrl) {
        // Backward-compatible entry point; delegates to the overload that can add a review link.
        log.info("[EMAIL][ORDER_STATUS] to='{}' code='{}' status='{}'", toEmail, publicCodeYYNNNN, newStatus);
        sendOrderStatusChanged(toEmail, toName, publicCodeYYNNNN, newStatus, note, trackingUrl, null, null, null);
    }

    /** Overload that allows passing review URL & context; auto-injects if DELIVERED and null. */
    public void sendOrderStatusChanged(String toEmail, String toName,
                                       String publicCodeYYNNNN, String newStatus,
                                       String note, String trackingUrl,
                                       String reviewUrl, Long productId, Long orderItemId) {

        String subject = "Order " + publicCodeYYNNNN + " \u2192 " + newStatus;

        // If delivered and caller didn’t provide a link, build a default one.
        String effectiveReviewUrl = reviewUrl;
        if ("DELIVERED".equalsIgnoreCase(String.valueOf(newStatus))
                && (effectiveReviewUrl == null || effectiveReviewUrl.isBlank())) {
            effectiveReviewUrl = buildReviewUrl(publicCodeYYNNNN, productId, orderItemId);
        }

        StringBuilder b = new StringBuilder();
        b.append("Hi ").append(safeName(toName)).append(",\n\n")
                .append("Your order ").append(publicCodeYYNNNN)
                .append(" status has been updated to: ").append(newStatus).append(".\n");

        if (hasText(note)) {
            b.append("\nAdditional note:\n").append(note.trim()).append("\n");
        }
        if (hasText(trackingUrl)) {
            b.append("\nTrack your shipment:\n")
                    .append("{{A|Track your shipment|").append(trackingUrl.trim()).append("}}\n");
        }
        if (hasText(effectiveReviewUrl)) {
            b.append("\nWe’d love your feedback:\n")
                    .append("{{A|Leave a review|").append(effectiveReviewUrl.trim()).append("}}\n");
        }

        b.append("\n").append(contactLineText()).append("\n\n")
                .append("Warm regards,\n")
                .append(brandName()).append("\n");

        sendRichMasked(toEmail, subject, b.toString());
    }

    /** Sends a short request asking the customer to leave a review for the order. */
    @Override
    public void sendReviewRequest(String toEmail, String toName,
                                  String publicCodeYYNNNN, String reviewUrl) {
        log.info("[EMAIL][REVIEW_REQ] to='{}' code='{}'", toEmail, publicCodeYYNNNN);
        String subject = "Review your order " + publicCodeYYNNNN;
        String body = """
            Hi %s,

            We hope you’re enjoying your purchase from %s.
            When you have a moment, we’d love to hear your feedback:

            {{A|Leave a review|%s}}

            %s

            Thank you for supporting us!

            Warm regards,
            %s
            """.formatted(safeName(toName), brandName(), reviewUrl, contactLineText(), brandName());

        sendRichMasked(toEmail, subject, body);
    }

    /* ========================= Core sender (HTML + masked plain alternative) ========================= */

    private void sendRichMasked(String toEmail, String subject, String maskedBodyWithMarkers) {
        // Produce plain-text WITHOUT raw URLs and HTML with anchors
        String plainMasked = maskToPlain(maskedBodyWithMarkers);
        try {
            HtmlParts html = renderHtmlEmail(maskedBodyWithMarkers); // does HTML anchor conversion
            InlineLogo logo = loadInlineLogo(); // may be null if not found

            boolean multipart = (logo != null);
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, multipart, "UTF-8");
            helper.setFrom(from);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainMasked, html.htmlBody);

            if (logo != null) {
                helper.addInline(logo.cid, new ByteArrayResource(logo.bytes), logo.contentType);
            }

            mailSender.send(mime);
            log.info("[EMAIL][SEND] HTML sent to='{}' subject='{}'", toEmail, subject);
        } catch (Exception ex) {
            // Fallback to plain text only (still without exposing raw URLs)
            log.warn("[EMAIL][SEND] Fallback to plain text for='{}' subject='{}' due to error={}", toEmail, subject, ex.getMessage());
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(toEmail);
            msg.setSubject(subject);
            msg.setText(plainMasked + "\n\n--\n" + brandName() + " • " + contactLineText());
            mailSender.send(msg);
        }
    }

    /* ========================= HTML Renderer ========================= */

    private record HtmlParts(String htmlBody) {}

    private HtmlParts renderHtmlEmail(String maskedSource) {
        // 1) Convert markers to <a> tags
        String withAnchors = maskToHtml(escape(maskedSource));
        // 2) Preserve newlines
        String bodyHtml = withAnchors.replace("\n", "<br/>");
        String contact = contactLineHtml();

        String logoImgTag = """
          <img src="cid:%s" alt="%s logo"
               style="height:40px; display:block; margin:0 auto 8px;" />
        """.formatted(LOGO_CID, escape(brandName()));

        String html = """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <title>%s</title>
            </head>
            <body style="margin:0; padding:0; background:#faf9fb; color:#2b2b2b; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <div style="max-width:640px; margin:0 auto; padding:18px;">
                <div style="background:#ffffff; border:1px solid #eee; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.06); overflow:hidden;">
                  <div style="padding:18px;">
                    <h1 style="margin:0 0 8px; font:600 18px/1.2 'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#4A4F41;">%s</h1>
                    <div style="height:1px; background:#f0f0f0; margin:8px 0 14px;"></div>
                    <div style="font-size:14px; color:#2b2b2b;">%s</div>
                  </div>
                  <div style="background:linear-gradient(135deg,rgba(246,195,32,.12),rgba(240,93,139,.10)); padding:14px; text-align:center;">
                    %s
                    <div style="font-size:12px; color:#333; margin-top:4px;">%s</div>
                    <div style="font-size:11px; color:#666; margin-top:6px;">%s</div>
                  </div>
                </div>
                <div style="text-align:center; color:#9a9a9a; font-size:11px; margin-top:10px;">
                  © %d %s
                </div>
              </div>
            </body>
            </html>
            """.formatted(
                escape(brandName()),
                escape(brandName()),
                bodyHtml,
                logoImgTag,
                contact,
                "Please do not reply to this automated message.",
                ZonedDateTime.now().getYear(),
                escape(brandName())
        );

        return new HtmlParts(html);
    }

    /* ========================= Inline Logo Loader ========================= */

    private record InlineLogo(String cid, byte[] bytes, String contentType) {}

    private InlineLogo loadInlineLogo() {
        // Prefer PNG (better Outlook support), then SVG
        byte[] bytes = readClassPathBytes(logoPngPath);
        String ct = "image/png";
        if (bytes == null) {
            log.warn("[EMAIL][LOGO] PNG not found at '{}', trying SVG", logoPngPath);
            bytes = readClassPathBytes(logoSvgPath);
            ct = (bytes != null) ? "image/svg+xml" : null;
        }
        if (bytes == null) {
            log.warn("[EMAIL][LOGO] Both PNG and SVG logos missing");
        }
        return (bytes != null && ct != null) ? new InlineLogo(LOGO_CID, bytes, ct) : null;
    }

    private byte[] readClassPathBytes(String path) {
        try {
            Resource r = new ClassPathResource(path);
            if (!r.exists()) return null;
            try (var in = r.getInputStream(); var out = new java.io.ByteArrayOutputStream()) {
                in.transferTo(out);
                return out.toByteArray();
            }
        } catch (Exception e) {
            return null;
        }
    }

    /* ========================= Links / URL builders ========================= */

    /**
     * Build a public review URL.
     * - If app.frontend.baseUrl is configured, returns ABSOLUTE URL: {base}/profile?...
     * - If it's blank/missing, returns RELATIVE URL: /profile?...
     */
    private String buildReviewUrl(String publicCodeYYNNNN, Long productId, Long orderItemId) {
        String base = (frontendBase == null) ? "" : frontendBase.trim();
        String path = "/profile"; // important: ProfilePage route, not /profile/orders

        StringBuilder qs = new StringBuilder();
        if (publicCodeYYNNNN != null && !publicCodeYYNNNN.isBlank()) {
            qs.append("code=").append(URLEncoder.encode(publicCodeYYNNNN, StandardCharsets.UTF_8));
        }
        if (productId != null && productId > 0) {
            if (qs.length() > 0) qs.append("&");
            qs.append("pid=").append(productId);
        }
        if (orderItemId != null && orderItemId > 0) {
            if (qs.length() > 0) qs.append("&");
            qs.append("itemId=").append(orderItemId);
        }

        String rel = path + (qs.length() > 0 ? "?" + qs : "");
        if (base.isEmpty()) return rel;                  // dev: relative
        if (!base.startsWith("http")) base = "https://" + base;
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + rel;
    }

    /* ========================= Helpers / Settings-backed values ========================= */

    private String brandName() {
        String s = setting("brand.name", BRAND_FALLBACK);
        return hasText(s) ? s : BRAND_FALLBACK;
    }

    /** Plain-text contact line for the body / plain alternative. */
    private String contactLineText() {
        String email = supportEmail();
        String wa = whatsapp();
        if (hasText(wa)) {
            return "Please do not reply to this email. For support, contact " + email + " or WhatsApp: " + wa + ".";
        }
        return "Please do not reply to this email. For support, contact " + email + ".";
    }

    /** HTML contact line (with basic mailto:/WhatsApp linking). */
    private String contactLineHtml() {
        String email = escape(supportEmail());
        String wa = escape(whatsapp());
        String mail = "<a href=\"mailto:" + email + "\" style=\"color:#4A4F41; text-decoration:underline;\">" + email + "</a>";
        if (hasText(wa)) {
            String w = "<a href=\"tel:" + wa + "\" style=\"color:#4A4F41; text-decoration:underline;\">" + wa + "</a>";
            return "For support, contact " + mail + " or WhatsApp: " + w + ".";
        }
        return "For support, contact " + mail + ".";
    }

    private String supportEmail() {
        return setting("brand.support_email", "support@example.com");
    }

    private String whatsapp() {
        return setting("brand.whatsapp", "");
    }

    private String setting(String key, String defVal) {
        try {
            var s = settings.get(key);
            String v = (s != null ? s.getValue() : null);
            return (v == null || v.isBlank()) ? defVal : v.trim();
        } catch (Exception ignored) {
            return defVal;
        }
    }

    private String safeName(String name) {
        return (name == null || name.isBlank()) ? "there" : name.trim();
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private String formatMoney(BigDecimal amount, String currency) {
        String cur = (currency == null || currency.isBlank()) ? "INR" : currency.trim().toUpperCase();
        BigDecimal amt = (amount == null) ? BigDecimal.ZERO : amount.setScale(2, RoundingMode.HALF_UP);
        return cur + " " + amt.toPlainString();
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String s) {
        if (s == null) return "";
        // Minimal attribute escaping; avoids breaking quotes
        return s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
