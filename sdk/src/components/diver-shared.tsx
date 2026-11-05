import { Badge } from "@/components/ui/badge";

export type CheckStatus = "pass" | "warn" | "fail" | "unknown";
export type CheckResult = { id: string; label: string; status: CheckStatus; evidence: string };
export type Verdict = "green" | "yellow" | "red";

export const VERDICT_STYLES: Record<Verdict, string> = {
  green: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  yellow: "border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-400",
  red: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  green: "Dived — looks legitimate",
  yellow: "Caution — some signals are off",
  red: "Spoofed — do not trust this",
};

const STATUS_BADGE_VARIANT: Record<CheckStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pass: "secondary",
  warn: "outline",
  fail: "destructive",
  unknown: "outline",
};

export const SAMPLE_EMAIL = `From: "Google Support" <staff@googIe.com>
Reply-To: scammer@totally-not-google.ru
Authentication-Results: mx.example.com; spf=fail smtp.mailfrom=googIe.com; dkim=none; dmarc=fail
Subject: Your account has been suspended

<p>Click <a href="http://bit.ly/fake-redirect">google.com/account</a> to verify your account.</p>`;

export function VerdictBanner({ verdict }: { verdict: Verdict }) {
  return (
    <div className={`rounded-lg border px-4 py-3 font-medium ${VERDICT_STYLES[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </div>
  );
}

export function CheckResultsList({ checks }: { checks: CheckResult[] }) {
  if (checks.length === 0) {
    return <p className="text-sm text-muted-foreground">No checks were run.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {checks.map((check) => (
        <div key={check.id} className="flex flex-col gap-1 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[check.status]}>{check.status}</Badge>
            <span className="font-medium">{check.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{check.evidence}</p>
        </div>
      ))}
    </div>
  );
}

export function Narration({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="rounded-md border bg-muted/30 p-3 text-sm">{text}</div>;
}
