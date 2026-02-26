export default function FileBrowserLoading() {
  return (
    <main className="min-h-screen bg-bg-deep px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl animate-pulse flex-col gap-4">
        <div className="h-8 w-72 rounded-md bg-bg-secondary" />
        <div className="h-5 w-52 rounded-md bg-bg-secondary" />
        <div className="h-12 w-full rounded-xl bg-bg-secondary" />
        <div className="h-12 w-full rounded-xl bg-bg-secondary" />
        <div className="h-[420px] w-full rounded-xl bg-bg-secondary" />
      </div>
    </main>
  );
}
