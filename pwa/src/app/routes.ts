import { createBrowserRouter } from "react-router";

import RootLayout from "./layouts/root-layout";
import DemoHome from "./screens/demo-home";
import Login from "./screens/login";
import Presentations from "./screens/presentations";
import PresentationsLoading from "./screens/presentations-loading";
import Menu from "./screens/menu";
import Settings from "./screens/settings";
import SettingsAdvanced from "./screens/settings-advanced";
import Account from "./screens/account";
import Sessions from "./screens/sessions";
import SessionDetail from "./screens/session-detail";
import CaseSelection from "./screens/case-selection";
import Viewer from "./screens/viewer";
import ViewerHotspots from "./screens/viewer-hotspots";
import Boot from "./screens/boot";
import BootFailure from "./screens/boot-failure";
import Install from "./screens/install";
import Diagnostics from "./screens/diagnostics";
import NotFound from "./screens/not-found";

const routerBase = (() => {
  const base = import.meta.env.BASE_URL || "/";
  return base === "/" ? "/" : base.replace(/\/$/, "");
})();

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: Boot,
      },
      {
        path: "demo-home",
        Component: DemoHome,
      },
      {
        path: "login",
        Component: Login,
      },
      {
        path: "boot",
        Component: Boot,
      },
      {
        path: "boot-failure",
        Component: BootFailure,
      },
      {
        path: "presentations",
        Component: Presentations,
      },
      {
        path: "presentations-loading",
        Component: PresentationsLoading,
      },
      {
        path: "menu",
        Component: Menu,
      },
      {
        path: "settings",
        Component: Settings,
      },
      {
        path: "settings/advanced",
        Component: SettingsAdvanced,
      },
      {
        path: "account",
        Component: Account,
      },
      {
        path: "sessions",
        Component: Sessions,
      },
      {
        path: "sessions/:id",
        Component: SessionDetail,
      },
      {
        path: "case-selection/:presentationId",
        Component: CaseSelection,
      },
      {
        path: "viewer/:presentationId/:caseId",
        Component: Viewer,
      },
      {
        path: "viewer-hotspots",
        Component: ViewerHotspots,
      },
      {
        path: "install",
        Component: Install,
      },
      {
        path: "diagnostics",
        Component: Diagnostics,
      },
      {
        path: "*",
        Component: NotFound,
      },
    ],
  },
], {
  basename: routerBase,
});
