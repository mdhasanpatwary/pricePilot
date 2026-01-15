import DocsLayoutShell from "./docs-shell";

export default function DocsPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DocsLayoutShell>
      {children}
    </DocsLayoutShell>
  );
}
