export function DatabaseUnavailable() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-xl border border-charcoal/10 bg-white p-8">
        <h2 className="mb-2 text-xl font-serif text-navy">Database Not Configured</h2>
        <p className="text-sm text-charcoal/70">
          Set{" "}
          <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-xs text-navy">
            DATABASE_URL
          </code>{" "}
          in your environment to use the admin panel.
        </p>
      </div>
    </div>
  );
}
