import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import { CompileProvider } from "./lib/CompileContext";
import HomePage from "./pages/HomePage";
import PlaygroundPage from "./pages/PlaygroundPage";
import HistoryPage from "./pages/HistoryPage";
import CompilerInternalsPage from "./pages/CompilerInternalsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DocumentationPage from "./pages/DocumentationPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  return (
    <CompileProvider>
      <div className="min-h-screen bg-[#0b0f14]">
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/internals" element={<CompilerInternalsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </div>
    </CompileProvider>
  );
}
