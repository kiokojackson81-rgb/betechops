export default function ReportsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Reports</h1>
      <ul className="list-disc ml-6 text-slate-300">
        <li>Sales Today</li>
        <li>Pending Pricing</li>
        <li>Returns Waiting Pickup</li>
      </ul>
      <p className="text-slate-400 mt-2">Detailed reports will be wired to API routes. Coming soon.</p>
    </div>
  );
}
