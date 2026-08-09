import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import KleinDemo from "./KleinDemo";
import "./klein.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KleinDemo />
  </StrictMode>,
);
