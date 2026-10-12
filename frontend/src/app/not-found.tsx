import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-paper px-4 text-center">
      <div>
        <p className="section-eyebrow">404</p>
        <h1 className="mt-2 text-4xl font-extrabold text-forest-900">Page not found</h1>
        <p className="mt-3 text-steel-600">The page you are looking for does not exist or has moved.</p>
        <Link href="/" className="btn btn-clay mt-6">Back to home</Link>
      </div>
    </main>
  );
}
