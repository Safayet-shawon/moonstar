"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-paper px-4 text-center">
      <div>
        <h1 className="text-3xl font-extrabold text-forest-900">Something went wrong</h1>
        <p className="mt-3 text-steel-600">Please try again. If the problem continues, call our support line.</p>
        <button onClick={reset} className="btn btn-clay mt-6">Try again</button>
      </div>
    </main>
  );
}
