"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import moment from "moment";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

const DATE_FORMATS = [
  moment.ISO_8601,
  "YYYY-MM-DD",
  "YYYY-MM-DD h:mma",
  "YYYY-MM-DD hh:mma",
];

const parseDate = (value) => {
  if (!value) return null;
  const parsed = moment(value, DATE_FORMATS, true);
  return parsed.isValid() ? parsed : null;
};

const formatDateLabel = (value) => moment(value).format("ddd - MMM DD, YYYY");

const buildChartData = (appointments) => {
  const counts = new Map();

  appointments.forEach((appt) => {
    const rawDate = appt.date || appt.startedAt || appt.createdAt;
    const date = parseDate(rawDate);
    if (!date) return;
    const key = date.format("YYYY-MM-DD");
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const entries = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      label: formatDateLabel(key),
      value,
    }));

  return entries;
};

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, doctors: 0, appointments: 0 });
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [productsRes, doctorsRes, appointmentsRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/doctors"),
          fetch("/api/appointments"),
        ]);

        const productsData = productsRes.ok ? await productsRes.json() : [];
        const doctorsData = doctorsRes.ok ? await doctorsRes.json() : [];
        const appointmentsData = appointmentsRes.ok ? await appointmentsRes.json() : [];
        const validAppointments = Array.isArray(appointmentsData)
          ? appointmentsData.filter((appt) => {
              const rawDate = appt.date || appt.startedAt || appt.createdAt;
              return !!parseDate(rawDate);
            })
          : [];

        if (isMounted) {
          setStats({
            products: Array.isArray(productsData) ? productsData.length : 0,
            doctors: Array.isArray(doctorsData) ? doctorsData.length : 0,
            appointments: validAppointments.length,
          });
          setAppointments(validAppointments);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const chartData = useMemo(() => buildChartData(appointments), [appointments]);
  const chartLabels = chartData.map((item) => item.label);
  const chartValues = chartData.map((item) => item.value);

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Products Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-2">Products</p>
              <p className="text-4xl font-bold text-gray-900">
                {isLoading ? "-" : stats.products}
              </p>
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
              <p className="text-4xl font-bold text-gray-900">
                {isLoading ? "-" : stats.doctors}
              </p>
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
              <p className="text-4xl font-bold text-gray-900">
                {isLoading ? "-" : stats.appointments}
              </p>
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

        {chartData.length === 0 ? (
          <div className="text-sm text-gray-500">No appointment data yet.</div>
        ) : (
          <div className="border-b border-gray-200 pb-6">
            <div className="h-52">
              <Line
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      label: "Appointments",
                      data: chartValues,
                      borderColor: "#2563eb",
                      backgroundColor: "rgba(37, 99, 235, 0.15)",
                      pointBackgroundColor: "#2563eb",
                      pointBorderColor: "#ffffff",
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 6,
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "#111827",
                      titleColor: "#ffffff",
                      bodyColor: "#ffffff",
                      padding: 10,
                      displayColors: false,
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: "#6b7280", maxRotation: 0 },
                    },
                    y: {
                      beginAtZero: true,
                      grid: { color: "#e5e7eb" },
                      ticks: { color: "#6b7280", precision: 0 },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
