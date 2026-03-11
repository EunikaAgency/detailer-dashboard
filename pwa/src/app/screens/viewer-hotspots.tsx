import { useState } from "react";
import { useNavigate } from "react-router";
import { Menu, ArrowLeft, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";

const MOCK_SLIDE = {
  id: 3,
  type: "image",
  url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwaW5mb2dyYXBoaWMlMjBkYXRhJTIwdmlzdWFsaXphdGlvbnxlbnwxfHx8fDE3NzMxODg1Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  title: "Clinical Data"
};

const HOTSPOTS = [
  { id: 1, x: 20, y: 15, width: 30, height: 20, label: "Chart A" },
  { id: 2, x: 55, y: 15, width: 35, height: 25, label: "Chart B" },
  { id: 3, x: 15, y: 50, width: 40, height: 30, label: "Key Findings" },
  { id: 4, x: 60, y: 55, width: 30, height: 25, label: "Next Slide" }
];

export default function ViewerHotspots() {
  const navigate = useNavigate();
  const [currentSlide] = useState(2);
  const totalSlides = 6;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-800/90 backdrop-blur-lg border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/menu")}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
        
        <div className="text-center flex-1 px-4">
          <div className="font-semibold text-white">CardioHealth Treatment Options</div>
          <div className="text-sm text-slate-400">Slide {currentSlide + 1} of {totalSlides}</div>
        </div>
        
        <button
          onClick={() => navigate("/presentations")}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        {/* Slide Container */}
        <div className="relative max-w-5xl w-full aspect-[16/9] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-2xl overflow-hidden">
          <img
            src={MOCK_SLIDE.url}
            alt={MOCK_SLIDE.title}
            className="w-full h-full object-contain"
          />

          {/* Hotspot Overlays */}
          {HOTSPOTS.map((hotspot) => (
            <div
              key={hotspot.id}
              className="absolute bg-blue-500/20 border-2 border-blue-400 rounded cursor-pointer hover:bg-blue-500/30 transition-colors group"
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.width}%`,
                height: `${hotspot.height}%`
              }}
            >
              <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {hotspot.label}
              </div>
            </div>
          ))}

          {/* Navigation Buttons */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          {/* Debug Badge */}
          <div className="absolute top-4 left-4 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full font-medium">
            Hotspots Visible
          </div>
        </div>

        {/* Fullscreen Toggle */}
        <button className="absolute top-6 right-6 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors">
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
