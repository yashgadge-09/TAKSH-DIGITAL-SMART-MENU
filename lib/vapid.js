export function getVapidSubject(subject) {
  const value = String(subject || "").trim();

  if (!value) {
    return "mailto:admin@example.com";
  }

  if (/^(mailto:|https?:)/i.test(value)) {
    return value;
  }

  return `mailto:${value}`;
}