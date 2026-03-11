import { useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Pill } from "../components/ui/pill";
import { 
  LogIn, Grid, Loader, Menu as MenuIcon, Settings, 
  UserCircle, Clock, Folder, Play, Eye, Power, AlertTriangle, Download
} from "lucide-react";

const SCREEN_CATEGORIES = [
  {
    category: "Authentication & Boot",
    screens: [
      { name: "Login", path: "/login", icon: LogIn, description: "Main login screen" },
      { name: "Boot Loading", path: "/boot", icon: Loader, description: "App initialization" },
      { name: "Boot Failure", path: "/boot-failure", icon: AlertTriangle, description: "Error recovery screen" }
    ]
  },
  {
    category: "Main Screens",
    screens: [
      { name: "Presentations Gallery", path: "/presentations", icon: Grid, description: "Browse all presentations" },
      { name: "Gallery Loading", path: "/presentations-loading", icon: Loader, description: "Loading state" },
      { name: "Menu", path: "/menu", icon: MenuIcon, description: "Main navigation menu" }
    ]
  },
  {
    category: "Settings & Account",
    screens: [
      { name: "Settings", path: "/settings", icon: Settings, description: "App preferences" },
      { name: "Advanced Settings", path: "/settings/advanced", icon: Settings, description: "Debug & diagnostics" },
      { name: "My Account", path: "/account", icon: UserCircle, description: "User profile info" },
      { name: "Install Instructions", path: "/install", icon: Download, description: "PWA installation guide" }
    ]
  },
  {
    category: "Sessions & History",
    screens: [
      { name: "Sessions List", path: "/sessions", icon: Clock, description: "View all sessions" },
      { name: "Session Detail", path: "/sessions/1", icon: Clock, description: "Single session audit trail" }
    ]
  },
  {
    category: "Presentation Flow",
    screens: [
      { name: "Case Selection", path: "/case-selection/1", icon: Folder, description: "Choose presentation case" },
      { name: "Viewer", path: "/viewer/1/1", icon: Play, description: "Presentation viewer" },
      { name: "Viewer with Hotspots", path: "/viewer-hotspots", icon: Eye, description: "Debug mode with hotspots" }
    ]
  }
];

export default function DemoHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">One Detailer</h1>
          <p className="text-slate-600">
            Enterprise medical presentation PWA • Demo Navigation
          </p>
          <Pill variant="default" className="mt-3">Mobile-first iOS/Android</Pill>
        </div>

        {/* Screen Categories */}
        <div className="space-y-8">
          {SCREEN_CATEGORIES.map((category) => (
            <div key={category.category}>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">{category.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.screens.map((screen) => {
                  const Icon = screen.icon;
                  return (
                    <Card
                      key={screen.path}
                      onClick={() => navigate(screen.path)}
                      className="p-4 hover:border-blue-300"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 mb-1">{screen.name}</h3>
                          <p className="text-sm text-slate-500">{screen.description}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Design Notes */}
        <Card className="p-6 mt-8 bg-slate-50">
          <h3 className="font-semibold text-slate-900 mb-3">Design System Notes</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Soft blue/slate palette for enterprise medical aesthetic</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Rounded white cards on pale gradient backgrounds</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Translucent sticky headers with backdrop blur</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Touch-friendly controls optimized for field use</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Professional presentation viewer with landscape support</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}