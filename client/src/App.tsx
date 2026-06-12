import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ExpenseList from "./pages/ExpenseList";
import ExpenseForm from "./pages/ExpenseForm";
import ExpenseDetail from "./pages/ExpenseDetail";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMasterData from "./pages/admin/AdminMasterData";
import AdminStorageSettings from "./pages/AdminStorageSettings";
import BatchList from "./pages/BatchList";
import BatchDetail from "./pages/BatchDetail";

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && user.role !== "admin") return <Redirect to="/" />;

  return <Component />;
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Redirect root to dashboard */}
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>

      {/* Dashboard */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>

      {/* Expenses */}
      <Route path="/expenses">
        <ProtectedRoute component={ExpenseList} />
      </Route>
      <Route path="/expenses/new">
        <ProtectedRoute component={ExpenseForm} />
      </Route>
      <Route path="/expenses/:id/edit">
        <ProtectedRoute component={ExpenseForm} />
      </Route>
      <Route path="/expenses/:id">
        <ProtectedRoute component={ExpenseDetail} />
      </Route>

      {/* Batches */}
      <Route path="/batches">
        <ProtectedRoute component={BatchList} />
      </Route>
      <Route path="/batches/:id">
        <ProtectedRoute component={BatchDetail} />
      </Route>

      {/* Admin */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} adminOnly />
      </Route>
      <Route path="/admin/master-data">
        <ProtectedRoute component={AdminMasterData} adminOnly />
      </Route>
      <Route path="/admin/storage-settings">
        <ProtectedRoute component={AdminStorageSettings} adminOnly />
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
