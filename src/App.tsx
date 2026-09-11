import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { NotificationPanel } from "./components/NotificationPanel";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { NodeDetail } from "./pages/NodeDetail";
import { RiskScore } from "./pages/RiskScore";
import { StructuralHealth } from "./pages/StructuralHealth";
import { TrendAnalysis } from "./pages/TrendAnalysis";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-base text-slate-300 selection:bg-teal-500/30">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/structural-health" element={<StructuralHealth />} />
          <Route path="/risk-score" element={<RiskScore />} />
          <Route path="/node/:nodeId" element={<NodeDetail />} />
          <Route path="/trend-analysis" element={<TrendAnalysis />} />
        </Routes>
        <NotificationPanel />
      </div>
    </BrowserRouter>
  );
}
