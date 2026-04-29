import { Switch, Route, Router } from "wouter";
import { useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Shared from "@/pages/shared";
import HistoryPage from "@/pages/history";
import ThreadsPage from "@/pages/threads";
import ThreadPage from "@/pages/thread";
import AdminPage from "@/pages/admin";
import AdminFeedbackPage from "@/pages/admin-feedback";
import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import { ThemeProvider } from "@/lib/theme";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/threads" component={ThreadsPage} />
      <Route path="/thread/:id" component={ThreadPage} />
      <Route path="/s/:id" component={Shared} />
      <Route path="/landing" component={Landing} />
      <Route path="/pricing" component={Pricing} />
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
          <Router hook={useLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
