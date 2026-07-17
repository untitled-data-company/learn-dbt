import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Learn dbt</h1>
        <p className="text-lg text-gray-600">
          A story-driven, interactive course where an analyst learns dbt by
          solving realistic exercises — right in the browser.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">The premise</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            <strong>Luca</strong> is an analyst at a small e-commerce company.
            Every morning he runs the same SQL query by hand to power a slow
            dashboard. One day his manager asks him to make it reliable, fast,
            and independent of his clicking finger.
          </p>
          <p>
            The company already uses <strong>dbt</strong>. Luca must learn how
            to use it — and you will help him, one chapter at a time.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          The characters
        </h2>
        <div className="grid gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-gray-900">Luca</h3>
            <p className="text-sm text-gray-600">
              Analyst, protagonist. Makes mistakes, learns.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-gray-900">The Manager</h3>
            <p className="text-sm text-gray-600">
              Asks for reliability and speed. Sets the stakes.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-gray-900">Giulia</h3>
            <p className="text-sm text-gray-600">
              Data engineer. Keeps the dbt project healthy. Teaches Luca the
              rules.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Module 1: from ad-hoc query to daily model
        </h2>
        <p className="text-gray-700 mb-4">
          Transform Luca&apos;s daily manual query into a reliable dbt model
          that can run every day without him.
        </p>
      </section>

      <div className="flex items-center gap-4">
        <Link
          href="/chapters/chapter-0"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Start Chapter 0 &rarr;
        </Link>
        <span className="text-sm text-gray-500">
          No dbt experience needed — just SQL.
        </span>
      </div>
    </main>
  );
}