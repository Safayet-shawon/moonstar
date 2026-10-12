"use client";

export default function PortalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <h2 className="text-xl font-bold text-forest-900">We could not load this page</h2>
      <p className="mt-2 text-sm text-steel-600">{error.message.includes("unavailable") ? "The service is temporarily unavailable." : "Something went wrong."} Please try again.</p>
      <button onClick={reset} className="btn btn-clay mt-5">Retry</button>
    </div>
  );
}
