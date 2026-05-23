import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Shared from "@/pages/shared";
import SiftChatPage from "@/pages/sift-chat";
import OnboardingPreview from "@/pages/onboarding-preview";
import ShellPreview from "@/pages/shell-preview";
import ResetPassphrasePage from "@/pages/reset-passphrase";
import RedirectHome from "@/pages/redirect-home";
import AdminPage from "@/pages/admin";
import AdminFeedbackPage from "@/pages/admin-feedback";
import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import PrivacyPage from "@/pages/privacy";
import LibraryPage from "@/pages/library";
import { ThemeProvider } from "@/lib/theme";

function AppRouter() {
  return (
    <Switch>
      <Route path="/onboarding-preview" component={OnboardingPreview} />
      <Route path="/shell-preview" component={ShellPreview} />
      <Route path="/reset-passphrase" component={ResetPassphrasePage} />
      <Route path="/companion" component={RedirectHome} />
      <Route path="/history" component={RedirectHome} />
      <Route path="/threads" component={RedirectHome} />
      <Route path="/garden" component={RedirectHome} />
      <Route path="/ways-in" component={RedirectHome} />
      <Route path="/field-notes" component={RedirectHome} />
      <Route path="/demo-sift" component={RedirectHome} />
      <Route path="/thread/:id" component={RedirectHome} />
      <Route path="/compare" component={RedirectHome} />
      <Route path="/scene/rooftop" component={RedirectHome} />
      <Route path="/s/:id/chat" component={SiftChatPage} />
      <Route path="/s/:id" component={Shared} />
      <Route path="/landing" component={Landing} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/library/:id" component={LibraryPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/feedback" component={AdminFeedbackPage} />
      <Route path="/sift" component={Home} />
      <Route path="/" component={Home} />
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
