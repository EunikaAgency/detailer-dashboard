import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { Smartphone, Share, PlusSquare, Home } from "lucide-react";

export default function Install() {
  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Install App" showBack backTo="/menu" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        <p className="text-slate-600">
          Install One Detailer on your device for quick access and offline functionality. Follow the steps below for your device type.
        </p>

        {/* iOS Instructions */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">iOS (iPhone/iPad)</h2>
          </div>

          <ol className="space-y-3 text-slate-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <span>Open this page in Safari browser</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button at the bottom</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <span>Scroll down and tap "Add to Home Screen" <PlusSquare className="inline w-4 h-4 mx-1" /></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <span>Tap "Add" to confirm</span>
            </li>
          </ol>
        </Card>

        {/* Android Instructions */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Smartphone className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Android</h2>
          </div>

          <ol className="space-y-3 text-slate-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <span>Open this page in Chrome browser</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <span>Tap the menu (three dots) in the top right</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <span>Select "Add to Home screen" or "Install app"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <span>Tap "Install" to confirm</span>
            </li>
          </ol>
        </Card>

        {/* Benefits */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            Benefits of Installing
          </h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Quick access from your home screen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Works offline with cached presentations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Full-screen presentation mode</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Faster loading and better performance</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
