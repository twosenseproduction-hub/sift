import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Shared from "@/pages/shared";
import HistoryPage from "@/pages/history";
import ThreadsPage from "@/pages/threads";
import GardenPage from "@/pages/garden";
import FieldNotesPage from "@/pages/field-notes";
import DemoSiftPage from "@/pages/demo-sift";
import ThreadPage from "@/pages/thread";
import ComparePage from "@/pages/compare";
import AdminPage from "@/pages/admin";
import AdminFeedbackPage from "@/pages/admin-feedback";
import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import PrivacyPage from "@/pages/privacy";
import { ThemeProvider } from "@/lib/theme";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/threads" component={ThreadsPage} />
      <Route path="/garden" component={GardenPage} />
      <Route path="/field-notes" component={FieldNotesPage} />
      <Route path="/demo-sift" component={DemoSiftPage} />
      <Route path="/thread/:id" component={ThreadPage} />
      <Route path="/compare" component={ComparePage} />
      <Route path="/s/:id" component={Shared} />
      <Route path="/landing" component={Landing} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/feedback" component={AdminFeedbackPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
