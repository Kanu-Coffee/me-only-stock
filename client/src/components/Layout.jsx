export default function Layout({ title, subtitle, children, rightAction }) {
  return (
    <main className="app-shell">
      <header className="header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {rightAction}
      </header>
      {children}
    </main>
  );
}
