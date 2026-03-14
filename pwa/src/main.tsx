
  import { createRoot } from "react-dom/client";
  import "./app/lib/pwa";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  
