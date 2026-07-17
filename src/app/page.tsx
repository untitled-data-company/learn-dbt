import { ExerciseRunner } from "@/components/ExerciseRunner";
import { DbtRunnerPanel } from "@/components/DbtRunnerPanel";

export default function Home() {
  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Learn dbt — Exercise Runner
        </h1>
        <p className="text-sm text-gray-600">
          Interactive SQL editor and lightweight dbt runner powered by
          DuckDB-WASM.
        </p>
      </header>

      <section className="mb-8 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          SQL Playground
        </h2>
        <div className="h-[500px]">
          <ExerciseRunner
            prompt="Write a query to join orders, customers, and products. Click Run SQL to execute and see results."
            expectedRows={[
              {
                order_id: 1,
                first_name: "Giulia",
                product_name: "Widget A",
                quantity: 2,
                order_date: "2023-04-01",
              },
              {
                order_id: 2,
                first_name: "Luca",
                product_name: "Widget B",
                quantity: 1,
                order_date: "2023-04-02",
              },
              {
                order_id: 3,
                first_name: "Giulia",
                product_name: "Thingamajig",
                quantity: 1,
                order_date: "2023-04-03",
              },
              {
                order_id: 4,
                first_name: "Marco",
                product_name: "Widget A",
                quantity: 5,
                order_date: "2023-04-04",
              },
            ]}
            matchKey="order_id"
          />
        </div>
      </section>

      <section className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">dbt Runner</h2>
        <div className="h-[700px]">
          <DbtRunnerPanel />
        </div>
      </section>
    </main>
  );
}