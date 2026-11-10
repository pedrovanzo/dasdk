/** Canonical spoofed-email sample — used by both the UI's "Try a spoofed sample" button and the eval suite, so there's one source of truth for its expected behavior. */
export const SAMPLE_EMAIL = `From: "Google Support" <staff@googIe.com>
Reply-To: scammer@totally-not-google.ru
Authentication-Results: mx.example.com; spf=fail smtp.mailfrom=googIe.com; dkim=none; dmarc=fail
Subject: Your account has been suspended

<p>Click <a href="http://bit.ly/fake-redirect">google.com/account</a> to verify your account.</p>`;
