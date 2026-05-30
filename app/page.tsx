import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-black/25 p-8 backdrop-blur-2xl">
        <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">
          AmbientEcho
        </div>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          面向中文用户的 AI 英语陪练
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          用后摄像头做第三只眼，用 Gemini Live 做实时教练，用一整块沉浸式通话界面练口语、练反应、练表达。
        </p>
        <div className="mt-8">
          <Link
            href="/call"
            className="inline-flex items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/14 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
          >
            开始体验
          </Link>
        </div>
      </div>
    </main>
  );
}
