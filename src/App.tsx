import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { NodeDetail } from "./pages/NodeDetail";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/node/:nodeId" element={<NodeDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
