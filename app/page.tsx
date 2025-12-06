import Digest from "./components/Digest";
import Auth from "./components/Auth";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Bluesky Daily Digest
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              When you want to know what's going on without getting sucked into doomscrolling
            </p>
          </div>
          <Auth />
        </div>
        <Digest />
      </main>
    </div>
  );
}
