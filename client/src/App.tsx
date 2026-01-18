import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ApiDocs from "@/pages/api-docs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ApiDocs} />
      <Route path="/docs" component={ApiDocs} />
      <Route path="/api-docs" component={ApiDocs} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
