export default function App() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="p-6 rounded-xl shadow-sm border bg-white">
        <h1 className="text-2xl font-bold text-green-600">Tailwind is working ✅</h1>
        <p className="mt-2 text-sm text-gray-600">If this text is styled, you're good to go.</p>
        <button className="mt-4 px-4 py-2 rounded-md bg-black text-white">Button</button>
      </div>
    </div>
  );
}
console.log(import.meta.env.VITE_API_BASE_URL);
