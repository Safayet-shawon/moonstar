/** Re-mounts on every navigation inside the public site: gives each page a soft entrance. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
