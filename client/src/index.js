import "./styles/global.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";   // <-- FIXED, added .js extension

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
