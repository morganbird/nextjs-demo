import Feed from "./components/Feed";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Bluesky Feed
        </h1>
        <Feed />
      </main>
    </div>
  );
}
