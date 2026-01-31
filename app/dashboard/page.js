"use client";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Otsuka Admin Dashboard</h1>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Products Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Products</p>
                <p className="text-4xl font-bold text-gray-900">4</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Doctors Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Doctors</p>
                <p className="text-4xl font-bold text-gray-900">5</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Appointments Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-2">Appointments</p>
                <p className="text-4xl font-bold text-gray-900">6</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Appointments Overview</h2>
            <p className="text-gray-600 text-sm">Number of appointments per day</p>
          </div>

          {/* Simple Bar Chart */}
          <div className="flex items-end justify-around h-64 border-b border-gray-200 pb-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 bg-blue-600 rounded-t-lg" style={{ height: '40%' }}></div>
              <div className="text-white bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold">2</div>
              <span className="text-gray-600 text-sm mt-2">Dec 15</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 bg-blue-600 rounded-t-lg" style={{ height: '20%' }}></div>
              <div className="text-white bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold">1</div>
              <span className="text-gray-600 text-sm mt-2">Dec 16</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 bg-blue-600 rounded-t-lg" style={{ height: '20%' }}></div>
              <div className="text-white bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold">1</div>
              <span className="text-gray-600 text-sm mt-2">Dec 17</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 bg-blue-600 rounded-t-lg" style={{ height: '20%' }}></div>
              <div className="text-white bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold">1</div>
              <span className="text-gray-600 text-sm mt-2">Dec 18</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
