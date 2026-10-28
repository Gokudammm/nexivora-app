import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";

test("sendEmail delivers messages over SMTP", async () => {
  let rawMessage = "";
  const server = createServer((socket) => {
    let buffer = "";
    let readingMessage = false;

    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      while (buffer.includes("\r\n")) {
        const boundary = buffer.indexOf("\r\n");
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        if (readingMessage) {
          if (line === ".") {
            readingMessage = false;
            socket.write("250 Message accepted\r\n");
          } else {
            rawMessage += `${line}\r\n`;
          }
        } else if (line.startsWith("EHLO") || line.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 8BITMIME\r\n");
        } else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) {
          socket.write("250 Accepted\r\n");
        } else if (line === "DATA") {
          readingMessage = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else {
          socket.write("250 Accepted\r\n");
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.EMAIL_TRANSPORT = "smtp";
  process.env.EMAIL_FROM = "no-reply@example.test";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(address.port);
  process.env.SMTP_USER = "test-user";
  process.env.SMTP_PASSWORD = "test-password";

  try {
    const { sendEmail } = await import("./send");
    await sendEmail({
      to: "person@example.test",
      subject: "Verify your address",
      text: "Open the verification link.",
      html: "<p>Open the verification link.</p>",
    });

    assert.match(rawMessage, /From: no-reply@example\.test/i);
    assert.match(rawMessage, /To: person@example\.test/i);
    assert.match(rawMessage, /Subject: Verify your address/i);
    assert.match(rawMessage, /Open the verification link\./);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
