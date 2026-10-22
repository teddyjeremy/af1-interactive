import { createRoot } from "react-dom/client";
import { Chamber } from "./chamber/Chamber";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<Chamber />);
