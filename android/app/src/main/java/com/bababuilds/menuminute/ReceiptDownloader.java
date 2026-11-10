package com.bababuilds.menuminute;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Redeems a short-lived print grant for ESC/POS bytes. The URL is a fixed HTTPS resource (never taken
 * from the launching intent), redirects are not followed, and the response is size-capped.
 */
final class ReceiptDownloader {
    private static final int MAX_BYTES = 256 * 1024;

    static final class PrintException extends IOException {
        PrintException(String message) {
            super(message);
        }
    }

    private ReceiptDownloader() {}

    static byte[] fetch(String endpoint, String grant) throws IOException {
        URL url = java.net.URI.create(endpoint).toURL();
        if (!"https".equals(url.getProtocol())) throw new PrintException("Unsafe print endpoint.");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(20_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/octet-stream");
            byte[] body = ("{\"grant\":\"" + grant + "\"}").getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body);
            }
            int status = connection.getResponseCode();
            if (status == 401 || status == 403) {
                throw new PrintException("This print request expired or you were signed out. Go back and tap Print again.");
            }
            if (status == 400 || status == 404 || status == 409 || status == 422) {
                throw new PrintException("This receipt cannot be printed from here. Use Print / save PDF in the app.");
            }
            if (status != 200) throw new PrintException("The server could not prepare the receipt (HTTP " + status + ").");
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (bytes.size() + read > MAX_BYTES) throw new PrintException("The receipt is too large to print.");
                    bytes.write(buffer, 0, read);
                }
                if (bytes.size() == 0) throw new PrintException("The server returned an empty receipt.");
                return bytes.toByteArray();
            }
        } finally {
            connection.disconnect();
        }
    }
}
