// ✅ Section 3 complete — FieldError

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-xs font-medium mt-1">{message}</p>;
}
