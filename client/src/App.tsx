import { Route, Switch } from "wouter";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import NewQuote from "@/pages/new-quote";
import QuoteDetail from "@/pages/quote-detail";

export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/quotes/new" component={NewQuote} />
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route>
          <div className="p-10 text-muted-foreground">Page not found.</div>
        </Route>
      </Switch>
    </Layout>
  );
}
