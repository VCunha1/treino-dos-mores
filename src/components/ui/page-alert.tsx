export function PageAlert({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error.slice(0, 300)}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
        {notice}
      </p>
    );
  }
  return null;
}
